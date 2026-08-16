# Scale-Up: HPC Ladder

Where this cluster goes when three cards stop being enough. Everything below
is the *next* step from the reference rig in
[hardware-blueprint.md](hardware-blueprint.md) - not requirements for day one.

---

## 1. The ladder

| Rung | Config | What it buys you | Cost class |
| --- | --- | --- | --- |
| 1 | 4090 + 2x 4060 Ti (this repo) | ~56 GB VRAM, three pools | ~$2.7k |
| 2 | 4090 + 3-4x 4060 Ti | A second worker pool or a bigger resident model | +$450/card |
| 3 | Desktop + OCuLink notebook fleet | Portable resident pool, desktop keeps overnight work | +$0 (you own the laptop) |
| 4 | MCIO multi-dock (GPD G2 x2-4) | 16 GB cards at x8 links, no per-box PSUs | +G2 pricing |
| 5 | PCIe 5 switch/retimer + 4x docks | 4+ GPUs off one workstation slot (GPD's quad-V100 128 GB HBM2 build is the reference) | switch card + docks |

Move up a rung when the **worker queue is consistently full**, not before.
An idle card is a $450 paperweight; a full queue is the only honest signal.

## 2. Multi-dock builds (rung 4-5)

GPD documents the pattern for its G2 dock: a **PCIe Gen 5 switch or retimer
expansion card** (Linkreal class) in one x16 slot exposes 2-4 MCIO 8i ports,
each feeding a G2 dock with its own GPU and built-in 800 W PSU.

- One host PSU for the board, one wall plug per dock - no external PSU
  shelves, no riser spaghetti.
- The switch card replaces "riser cards and external power setups" (GPD's
  words) - this is the clean path from 3 cards to 4-6.
- Example from GPD's own material: 4x Tesla V100 32 GB (128 GB HBM2 total)
  off a single switch card as an LLM inference platform. Same topology, any
  cards you own.
- Caveat: consumer desktop chipsets cap lane counts; a switch card is the
  tool when the board runs out of physical x16 slots, and MCIO keeps links
  short and signal-clean.

## 3. Multi-host fleets (rung 3+)

The orchestration doc's **pool mobility** rule scales as-is:

- Hosts (desktop rig, notebook + OCuLink box, a second box in the garage)
  each run daemons bound to their own cards via `CUDA_VISIBLE_DEVICES`.
- One central queue (any small task queue - arq, toil, or a 50-line
  HTTP worker daemon) assigns jobs to whichever host advertises an idle
  worker card.
- Checkpoint discipline is the contract: a job may be preempted at any time
  by a host going offline, and must resume from its last checkpoint.
- A central config repo (this repo's patterns) keeps daemon configs,
  undervolt presets, and runbooks versioned per host.

Do **not** reach for a real scheduler (Slurm/Kubernetes) until you have
>4 hosts and >8 cards. Before that, a queue is simpler, debuggable, and
loses nothing.

## 4. Honest limits of the platform

| Limit | Why | Workaround |
| --- | --- | --- |
| No NVLink between consumer cards | NVIDIA cuts it off below workstation class | Tensor parallelism across cards is not an option; model-parallel/queued jobs are |
| No MIG partitioning on consumer cards | Hardware feature, server-only | Process pinning via `CUDA_VISIBLE_DEVICES` (this repo's pattern) |
| PCIe x4/x8 external links | OCuLink x4 ~7.9 GB/s, MCIO x8 ~15.75 GB/s | Keep streaming-heavy jobs on the native slot |
| Notebooks not built for 24/7 | Fans, battery, paste | Daytime/portable pool only; overnight work on the desktop |
| No ECC, no official server support | Consumer cards are not Tesla-class | For hobby loads: fine. For money loads: buy server parts |

## 5. Cost curve

| Card | VRAM | Approx price | $/GB VRAM | Power (undervolted) |
| --- | --- | --- | --- | --- |
| RTX 4060 Ti 16 GB | 16 GB | $450 | ~$28 | ~115 W |
| RTX 4090 24 GB | 24 GB | $1,700 | ~$71 | ~330 W |
| Tesla V100 32 GB (used, HPC shelf) | 32 GB | variable | variable | ~250 W |

The 4060 Ti is the only card worth adding to a *VRAM-hungry* cluster. When
the next rung needs compute instead of memory, that is the signal to look at
workstation cards - and the docs in this repo stop applying.

## 6. When to stop scaling

- Your worker queue empties faster than jobs arrive -> scale down.
- Electricity + hardware cost per job beats cloud spot pricing for your
  workload -> the cluster has outlived its economic case for that workload.
- You need NVLink/ECC/TPU-class -> this is a different project; archive this
  repo's advice and buy appropriately.
