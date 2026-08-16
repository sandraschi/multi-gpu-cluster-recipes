# Monitoring and Ops

How to watch the cluster, know what is normal, and recover fast when it is not.
Companion to [worker-orchestration.md](worker-orchestration.md) section 6.

---

## 1. What to watch

Per-pool signal table (poll every 2 s in normal operation):

| Signal | Primary (4090) | Resident (4060 Ti #1) | Worker (4060 Ti #2) |
| --- | --- | --- | --- |
| Memory used | < 22 GB | < 14 GB (budget 12 + 2 headroom) | < 15 GB (budget 14 + 1) |
| Utilization | interactive bursts | steady, low | 80-100% while a job runs |
| Power draw | 300-360 W (undervolted) | 110-130 W | 110-130 W |
| Core temp | < 80 C | < 80 C | < 80 C |
| Hotspot | < 95 C | < 95 C | < 95 C |
| Link (external cards) | n/a (native) | x4 (OCuLink) / x8 (MCIO) | x4 / x8 |

If a value sits outside its column for more than 5 minutes, it is an event,
not noise.

## 2. Tooling

### Minimal (always on)

```bash
# Live per-card watch
watch -n 2 nvidia-smi

# One-shot CSV for scripts
nvidia-smi --query-gpu=index,name,memory.used,memory.total,\
  utilization.gpu,power.draw,temperature.gpu,temperature.gpu_mem \
  --format=csv,noheader

# Per-card dmon loop (Linux)
nvidia-smi dmon -s pucvmet -d 5
```

Daemon health:

```bash
# Resident model daemon (GPU 1) - must answer in < 1 s
curl -sf http://127.0.0.1:12080/health

# Worker queue daemon (GPU 2) - must report idle or running + job id
curl -sf http://127.0.0.1:12081/status
```

### Optional (dashboard)

When the cluster grows beyond one box, run Prometheus + Grafana on the
network: `nvidia_gpu_exporter` per host scrapes the same metrics the watch
loop uses, plus node_exporter for CPU/RAM/disk. A single Grafana board with
three GPU panels (one per pool) is the whole UI. Everything above is a
threshold expression in that board.

## 3. Thresholds that page you

| Signal | Threshold | Action |
| --- | --- | --- |
| Resident pool > 14 GB used | Budget breach | Truncate context, verify no spill to host RAM |
| Worker pool > 15 GB used | Near OOM | Preempt current job at its checkpoint |
| Primary pool utilization > 0% from a worker PID | Isolation breach | Kill the job, fix its env |
| External card reports x1 link | Bad cable / reseat | Check `nvidia-smi -q -d PCI`, reseat with power off |
| Hotspot > 95 C on any card | Thermal | Throttle worker pool until cool |
| Resident /health unanswered > 60 s | Daemon down | systemd/NSSM restarts it; verify before alerting |
| Worker queue > 5 jobs queued | Capacity | Check worker daemon, or queue is working as designed |
| Any card > 5 min above its power column | Undervolt lost | Re-apply curve, check driver reset |

## 4. Runbooks

### External link drop (OCuLink or MCIO)

1. Confirm: card disappears from `nvidia-smi`, daemons stop cleanly at
   checkpoints.
2. Check cable seating at both ends (latched connectors come loose rarely,
   but 12V-2x6/8-pin side is the usual culprit).
3. **Power down the host** (cool-plug - neither link is hot-swappable).
4. Re-plug, boot, verify link speed via `nvidia-smi -q -d PCI`.
5. Worker daemon resumes jobs from their checkpoints automatically.

### Worker job OOM

1. Worker daemon marks the job failed at its last checkpoint.
2. Check whether the job's real VRAM need exceeds the 14 GB budget (measure,
   do not guess).
3. Either shrink the job (smaller batch, lower resolution mesh) or move it to
   the primary pool for a one-off run - never as a habit.

### Isolation breach (job landed on the primary)

1. Kill the job immediately.
2. Find why it ignored `CUDA_VISIBLE_DEVICES` (framework defaulted to device
   0, env var not propagated through the queue).
3. Fix the launcher template, then re-queue.

### Power outage / brownout

1. The 4090's ~600 W transient is the trip risk; a 1300 W ATX 3.0 PSU rides
   it, a marginal one does not.
2. After restart, verify all three cards negotiate links, the resident model
   preloads, and the worker queue resumes from checkpoint.
3. If the box is in a basement/garage: a UPS for the host + one external box
   is cheaper than re-running a 6-hour mesh job.

## 5. Power accounting

Monthly cost is a table row, not a mystery:

```bash
# Log one line per hour (cron): date, wall draw, kWh estimate
echo "$(date -Is) $(nvidia-smi --query-gpu=power.draw --format=csv,noheader | paste -sd+ | bc) W" >> /var/log/cluster-power.log
```

Or use a smart plug / kill-a-watt at the wall (simplest and most honest: it
includes the PSU's own losses). Compare month to month - a creeping baseline
is the first sign a daemon leaked GPU time or an undervolt was lost.

## 6. Logging

- Daemons log to journald (Linux) or Event Log (Windows); keep 7 days.
- `journalctl -u resident-daemon -u worker-daemon --since today` is the first
  diagnostic on any cluster weirdness.
- Checkpoint files are the source of truth for job state; logs are for why.
