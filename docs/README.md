# Multi-GPU Cluster Recipes - Docs

The practical guides for building and running a budget multi-GPU local AI
cluster: an RTX 4090 primary engine with RTX 4060 Ti 16 GB secondaries,
connected via internal risers, OCuLink, or MCIO 8i (GPD G2) external docks -
including notebook host combos and worker orchestration.

## The guides

| Guide | What it covers |
| --- | --- |
| [Hardware Blueprint](hardware-blueprint.md) | Power budget, PSU sizing, undervolting presets, open-frame layout, riser/OCuLink/MCIO connectivity, host combos |
| [Worker Orchestration](worker-orchestration.md) | Primary / resident / worker GPU pools, device pinning, keepalive daemons, worker queues, VRAM budgets, host matrix |
| [Monitoring and Ops](monitoring-and-ops.md) | Per-pool metrics, thresholds, runbooks, power accounting |
| [Scale-Up: HPC Ladder](scale-up-hpc.md) | Multi-dock builds, multi-host fleets, cost curve, honest limits |

## Where to start

- New to the idea? Read the
  [project overview](https://github.com/sandraschi/multi-gpu-cluster-recipes/blob/main/README.md)
  first - the economics and the host combo matrix.
- Building the rig? Start with the [Hardware Blueprint](hardware-blueprint.md).
- Running it? [Worker Orchestration](worker-orchestration.md), then
  [Monitoring and Ops](monitoring-and-ops.md).
