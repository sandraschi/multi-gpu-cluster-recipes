# Worker Orchestration

How to route continuous tasks, run concurrent local models across separate VRAM
pools, and never thrash context again.

The core idea: **three physical VRAM pools, three job classes, zero overlap.**
Each pool is a process group pinned to one card. Background work waits in a
queue rather than stealing VRAM from the interactive instance.

---

## 1. Pool topology

```text
GPU 0  RTX 4090 24 GB ...... PRIMARY pool  (interactive)
GPU 1  RTX 4060 Ti 16 GB ... RESIDENT pool (always-on assistant model)
GPU 2  RTX 4060 Ti 16 GB ... WORKER pool   (batch / long-running loops)
```

| Pool | Card | Job class | SLO |
| --- | --- | --- | --- |
| Primary | 4090 | Interactive coding, reasoning, single-shot heavy inference | Millisecond-to-second latency, always free |
| Resident | 4060 Ti #1 | Lightweight assistant model (Muse Glimmer class, Q4) | Warm: first token < 1 s, 24/7 |
| Worker | 4060 Ti #2 | Numerical loops, geodetic/inertial simulation, CFD/OpenFOAM meshing, Lean solver jobs | Hours OK, one job at a time |

### Physical vs logical topology: the host matrix

The pools above are **logical**; the orchestrator does not care which
physical host a card hangs off. Cards appear in `nvidia-smi` the same way on
every link, so every pattern in this document works unchanged. The practical
host matrix:

| Host | Link | Typical pool assignment |
| --- | --- | --- |
| Desktop, open frame (ATX) | Native slot + risers | Primary (4090) + secondaries on the frame |
| Desktop, closed tower / ITX | Native slot + MCIO 8i adapter card | Primary (4090) + secondaries in GPD G2 docks |
| OCuLink notebook (GPD DUO class) | Native OCuLink port (SFF-8611) | Resident or worker box + the notebook's own mobile dGPU |
| Notebook without OCuLink | USB4 v2 / TB4/TB5, or M.2 to OCuLink adapter | GPD G2 over USB4, or OCuLink box via M.2 |

**Pool mobility rule:** a pool is a role (interactive / resident / worker),
not a permanent address. If the desktop is off, the notebook + external box
picks up the resident role; if the notebook is docked to the desk, its dGPU
can take the worker role while the 4060 Tis on the rig keep running. The
daemons bind to a card by index on *their* host (`CUDA_VISIBLE_DEVICES`), and
the queue assigns jobs to whichever host currently advertises an idle worker
card.

Bandwidth differences between links matter only for job placement:
OCuLink runs at PCIe 4.0 x4 (~7.9 GB/s), MCIO 8i at PCIe 4.0 x8
(~15.75 GB/s), USB4 v2 at 80-120 Gbps (~9.6-14.5 GB/s). All three are fine
for the VRAM-bound inference this cluster runs; streaming-heavy training
stays on the 4090's native slot.

---

## 2. Pool isolation

### CUDA device pinning (Linux)

```bash
# Primary pool: everything default
# Resident pool: pin the always-on model daemon
CUDA_VISIBLE_DEVICES=1 resident-daemon start

# Worker pool: pin heavy jobs to GPU 2 only
CUDA_VISIBLE_DEVICES=2 worker-daemon run job --id mesh-0123
```

The daemons must **never** be started without `CUDA_VISIBLE_DEVICES` - a
careless `ollama serve` on the bare host will grab GPU 0 and wreck the
interactive pool.

### Windows

PowerShell background jobs or NSSM services, same environment variable:

```powershell
$env:CUDA_VISIBLE_DEVICES = "1"
Start-Job { uv run resident-daemon }
```

### Pitfall: frameworks that pin device 0 by default

PyTorch `cuda:0`, TensorFlow `GPU:0`, and llama.cpp without `--device` all
default to the first visible device - which is why the visible-device trick
is mandatory. A model that silently lands on GPU 0 next to the interactive
instance is exactly the thrash this repo exists to prevent.

---

## 3. Resident model pattern (GPU 1)

Purpose: an assistant that is always awake, always cheap.

- Model class: **lightweight (3-8 B), quantized to Q4/Q5** (~6-8 GB VRAM),
  e.g. a Muse Glimmer-class model. It must fit in 16 GB with headroom for KV
  cache growth.
- **Keepalive daemon**: preloads the model at boot, keeps the process alive,
  serves an HTTP endpoint, and never unloads on idle. Cold-start is banned;
  this pool exists so first-token latency stays under 1 s.
- **Never move it**: the resident model owns GPU 1. If a one-off task needs
  16 GB, it waits for the worker pool - it does not evict the resident model.

```bash
# /etc/systemd/system/resident-daemon.service (example)
[Service]
Environment=CUDA_VISIBLE_DEVICES=1
ExecStart=/usr/local/bin/resident-daemon --model muse-glimmer-q4 --port 12080
Restart=always
```

---

## 4. Background worker pattern (GPU 2)

Purpose: long-running heavy loops that used to hang the interactive session.

Typical workloads for this pool:

| Workload | Tooling | Characteristics |
| --- | --- | --- |
| CFD / OpenFOAM mesh generation | freecad-mcp + OpenFOAM | Hours-long, memory-bound |
| Geodetic / inertial simulation | numpy / scipy / custom kernels | Dense loops, checkpointable |
| Numerical / symbolic solving | leanforge-mcp (Lean solver) | Bursty, high single-iteration cost |

### Pattern: worker daemon + queue, not spawn-per-job

1. One **worker daemon** owns GPU 2 (`CUDA_VISIBLE_DEVICES=2`) and runs a
   FIFO queue.
2. Jobs are submitted over HTTP (or the MCP server's stdio proxy): the
   interactive agent calls the worker endpoint, gets a `job_id`, and polls.
3. The worker runs **one job at a time**. Parallelism is achieved by scaling
   worker daemons across cards, never by co-scheduling on one card.
4. Jobs **checkpoint** (state file every N minutes) so an interruption resumes,
   not restarts.

### Fleet tool integration (freecad-mcp, leanforge-mcp)

The same servers that drive interactive CAD and Lean work can run headless on
the worker pool:

- Run the server in **HTTP daemon mode** bound to the worker card, e.g.
  `freecad-mcp` serving on `127.0.0.1:10944` with `CUDA_VISIBLE_DEVICES=2`.
- Clients (interactive agent on GPU 0) talk to it over HTTP - zero VRAM
  touched on the primary pool.
- Standard stdio clients connect through a lightweight **stdio proxy** that
  forwards to the daemon. One daemon, many thin proxies, one VRAM owner.
- Mesh generation, simulation sweeps, and solver loops submitted this way
  never starve the 4090.

---

## 5. Concurrency and VRAM budget rules

### Hard rules

1. **A process may only touch its pool's card.** Enforced by
   `CUDA_VISIBLE_DEVICES` at launch, verified by `nvidia-smi` monitoring.
2. **Resident pool budget: 12 GB of 16 GB.** Leave 4 GB headroom for KV cache
   growth; if the resident model's context grows past the budget, truncate -
   do not let it spill to host RAM and thrash.
3. **Worker pool budget: 14 GB of 16 GB.** Checkpoint before the budget is
   hit, not after OOM.
4. **Primary pool is sacrosanct.** No background job may land on GPU 0. If
   both worker cards are busy and a third heavy job arrives, it queues.
5. **Streaming-heavy jobs stay off external links.** GPU 1/2 attached via
   external boxes run at PCIe 4.0 x4 (OCuLink, ~7.9 GB/s) or x8 (MCIO 8i,
   ~15.75 GB/s). VRAM-bound inference is fine; workloads that stream data
   host-to-device continuously (training, large batch preprocessing) belong
   on the 4090's native x16 slot.

### Why this kills context thrashing

Context thrashing is not a VRAM problem, it is a **scheduling** problem: a
machine with 24 GB tries to be an interactive workstation, a resident assistant,
and a batch cluster at once. By pinning each job class to its own physical
pool you get:

- Deterministic memory: each process sees one card with a stable budget.
- No eviction cascades: loading a worker job can never evict the assistant
  the user is mid-conversation with.
- Predictable latency: the 4090's memory bandwidth belongs to interactive
  work, period.

---

## 6. Monitoring and health

```bash
# Per-pool view
nvidia-smi --query-gpu=index,memory.used,memory.total,utilization.gpu,power.draw \
  --format=csv

# Watch a specific card (e.g. worker)
watch -n 2 nvidia-smi -i 2
```

Thresholds that should page you:

| Signal | Threshold | Action |
| --- | --- | --- |
| Resident pool > 14 GB used | Resident budget breach | Truncate context, verify no spill |
| Worker pool > 15 GB used | Near OOM | Preempt current job at its checkpoint |
| Primary pool utilization > 0 % from a worker PID | Isolation breach | Kill the job, fix its env |
| OCuLink/MCIO card reports x1 link (expected x4/x8) | Bad cable / reseat needed | Check `nvidia-smi -q -d PCI`, reseat with power off |
| Hotspot > 95 C on any card | Thermal | Throttle worker pool until cool |

---

## 7. Failure policy

- **Worker job dies** -> worker daemon restarts it from the last checkpoint
  and re-queues the remainder. Primary pool never notices.
- **External link drops** (OCuLink or MCIO card disappears) -> the card's
  daemons stop cleanly at their checkpoints; `nvidia-smi -q -d PCI` shows the
  link state. Re-plug while powered down (cool-plug), reboot, resume.
- **Host goes offline** (notebook unplugged, desktop off) -> the remaining
  host advertises its idle cards and the queue re-routes; jobs resume from
  their last checkpoint instead of restarting.
- **Resident daemon dies** -> systemd/NSSM restarts it; the interactive agent
  degrades gracefully (no assistant until reload) instead of launching a
  fallback on GPU 0.
- **GPU 0 dies** -> that is an operator incident. The cluster keeps running
  for resident + worker pools while you swap the 4090.

---

## 8. Linux vs Windows notes

| Concern | Linux | Windows |
| --- | --- | --- |
| Isolation primitive | systemd services + `CUDA_VISIBLE_DEVICES` | NSSM services / scheduled tasks + same env var |
| GPU partitioning | No MIG on consumer cards - process pinning is the tool | Same, no MIG on consumer cards |
| Monitoring | `nvidia-smi dmon` / prometheus | `nvidia-smi` + Task Manager, or WSL2 |
| WSL2 caveat | - | WSL2 shares the host GPU namespace - pin inside WSL too, or run worker daemons as native Windows processes |

Consumer cards (4090, 4060 Ti) do **not** expose MIG partitioning. Process
pinning via visible devices + strict launch hygiene is the whole game, on both
platforms.
