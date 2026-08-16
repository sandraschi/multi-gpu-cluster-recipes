# Multi-GPU Cluster Recipes

A practical, battle-tested guide for **solo developers and tinkerers** building a
budget-friendly, highly scalable **multi-GPU local AI cluster** on an open-frame
server. No cloud subscriptions, no per-token metering, no VRAM thrashing.

The reference configuration pairs a **primary RTX 4090 tensor engine** (24 GB)
with **budget 16 GB secondary cards** (e.g. dual RTX 4060 Ti 16 GB): **~56 GB
total VRAM for roughly the price of one mid-range cloud contract.**

Two ways to attach the secondaries, both covered here:

| Connectivity | How it works | Best for |
| --- | --- | --- |
| **Internal risers** | PCIe 4.0 x16 riser/extender from the board to each card, mounted on the open frame | All cards in one rig, maximum bandwidth |
| **External GPD combo - MCIO 8i (current gen)** | MCIO 8i adapter card in the server + GPD G2 eGPU dock linked by an SFF-TA-1016 cable | Double the OCuLink bandwidth, box has a built-in 800 W PSU |
| **External GPD combo - OCuLink (previous gen)** | PCIe x16 to OCuLink adapter card in the server + external GPU boxes linked by SFF-8611 cables | Cards living outside the rig at half the MCIO bandwidth |

## Every host combination is covered

The pools are logical, not physical - any host with a PCIe-capable link can
run a pool. The repo covers the full ladder:

| # | Combo | Host | Link | Cards |
| --- | --- | --- | --- | --- |
| 1 | **Budget open-frame rig** | Desktop (ATX) | Internal risers | RTX 4090 native + 2x RTX 4060 Ti on risers |
| 2 | **Closed tower / ITX + MCIO docks** | Desktop (closed case or ITX) | MCIO 8i adapter card | RTX 4090 native + 2x RTX 4060 Ti in GPD G2 docks (800 W PSU each) |
| 3 | **OCuLink notebook + external box** | Notebook with native OCuLink (e.g. GPD DUO class: dual screen, AMD) | OCuLink SFF-8611 | External 4060 Ti box + the notebook's own mobile dGPU |
| 4 | **Notebook without OCuLink** | Notebook with USB4/TB or an M.2 NVMe slot | USB4 v2 / TB4/TB5, or M.2 2230 to OCuLink adapter | GPD G2 dock over USB4, or an OCuLink box via M.2 adapter |

A developer with a powerful OCuLink notebook (with or without a good mobile
NVIDIA GPU) plugs the same external boxes into the laptop and gets a portable
resident/worker pool - no desktop required.

---

## Why build this

### 1. Escape cloud token and hour-metering costs

Cloud GPU rentals look cheap per hour and are brutal per month:

| Scenario | Cost model | Monthly bill (8 h/day, 22 days) |
| --- | --- | --- |
| A100 80 GB (on-demand) | ~$2.50-4.00 / hr | **$440 - $700** |
| RTX 4090 cloud instance | ~$0.50-1.00 / hr | **$90 - $175** |
| RTX 4090 + 2x RTX 4060 Ti 16 GB (local) | ~$2,700 one-time + power | **~$25 - $110** (power only) |

Even at 24/7 operation, the local cluster pays for itself within one year of
light cloud usage - and the hardware keeps working afterward as an asset.

### 2. Kill VRAM thrashing

A single 24 GB card forces a brutal triage loop: quantize the model, offload
layers to RAM, evict the resident assistant to load the batch job, reload,
evict again. Each cycle costs seconds to minutes of latency and destroys
interactive feel.

With 3 physical VRAM pools the triage stops:

| Pool | Card | VRAM | Role |
| --- | --- | --- | --- |
| Primary | RTX 4090 | 24 GB | Interactive coding / reasoning / big model inference |
| Resident | RTX 4060 Ti #1 | 16 GB | Persistent lightweight assistant model (Muse Glimmer-class) |
| Worker | RTX 4060 Ti #2 | 16 GB | Long-running background loops, simulations, meshing |

---

## Reference architecture

```text
Open-frame rig (Goliath-style)
|
|-- GPU 0  RTX 4090 24 GB ........ PRIMARY pool
|        `- interactive agent, heavy single-shot inference
|
|-- GPU 1  RTX 4060 Ti 16 GB ..... RESIDENT pool
|        `- always-on lightweight model (Muse Glimmer class, Q4)
|
|-- GPU 2  RTX 4060 Ti 16 GB ..... WORKER pool
|        `- CFD/OpenFOAM meshing, geodetic + inertial simulation,
|           numerical loops, Lean solver jobs (freecad-mcp, leanforge-mcp)
```

The **4090 stays in the primary x16 slot** (full bandwidth for interactive
work). The secondaries connect either through **PCIe 4.0 x16 risers** on the
frame, or - the cooler trick - through the **GPD-style external combo**: an
adapter card in the server plus an external GPU box over a latched cable.

- **Current gen: MCIO 8i** (GPD G2 dock) - 8 lanes at PCIe 4.0 (~15.75 GB/s,
  double OCuLink), built-in 800 W Gold PSU, and GPD measures ~2% performance
  loss with an RTX 4090.
- **Previous gen: OCuLink** (GPD G1 ecosystem, SFF-8611 cables) - 4 lanes at
  PCIe 4.0 (~7.9 GB/s), external box needs its own PSU.

Either way, external boxes can live in another room entirely: worker heat and
fan noise leave the rig zone. Notebooks slot into the same orchestration: a
GPD DUO-class AMD notebook with a native OCuLink port (or USB4 v2 / TB for the
G2 dock) becomes a portable host for the resident or worker pools when the
desktop is off or away.

Each card gets its own power budget, its own cooling lane, and its own
`CUDA_VISIBLE_DEVICES`-isolated process group - so nothing ever steals VRAM
from anything else.

---

## Hardware recommendations (summary)

Full detail in [docs/hardware-blueprint.md](docs/hardware-blueprint.md).

| Component | Recommendation | Notes |
| --- | --- | --- |
| Main GPU | RTX 4090 (24 GB) | 450 W TDP, ~600 W transient - plan PSU for it |
| Secondary GPU | 2x RTX 4060 Ti 16 GB | 165 W each, huge VRAM-per-dollar |
| Chassis | Goliath-style open-frame rig | Exposed cards, no airflow dead zones, easy riser runs |
| PSU | 1000-1300 W, ATX 3.0/3.1, 80+ Gold or Platinum | 12VHPWR/12V-2x6 native for the 4090 |
| Connectivity (option A) | PCIe 4.0 x16 risers, shielded, 100-200 mm | Strain relief mandatory, avoid sharp bends |
| Connectivity (option B) | PCIe x16 to OCuLink adapter card + external GPU boxes (GPD-style combo) | SFF-8611 cables, cards live outside the rig |
| Connectivity (option C) | MCIO 8i adapter card + GPD G2 eGPU dock | SFF-TA-1016 cable, PCIe 4.0 x8 (2x OCuLink), built-in 800 W PSU |
| Cooling | 2-3 slot card spacing + one axial fan per card | Keep GPU hotspots < 85 C under load |
| Notebook hosts | GPD DUO-class (native OCuLink) or any USB4 v2 / TB4/TB5 machine | Portable resident/worker pool - see combo matrix above |

### Connectivity options in detail

- **Option A - internal risers**: all three cards on the open frame. Simple,
  full PCIe x16 bandwidth, but three GPUs in one room-sized heat bubble.
- **Option B - external OCuLink combo**: a
  PCIe x16 to OCuLink SFF-8612 adapter card goes in the server (one slot
  yields 1-4 external ports); the 4060 Tis sit in external GPU boxes linked by
  SFF-8611 OCuLink cables. OCuLink is a PCI-SIG PCIe standard (the same
  signaling as NVMe), so there is no Thunderbolt-style controller, no CPU
  pass-through, and the hardware costs a fraction of TB3/USB4 eGPU boards.
  Trade-off: each link is **PCIe 4.0 x4 (~7.9 GB/s)** instead of x16.
- **Option C - external MCIO 8i combo (current gen)**: same idea, newer
  connector. An **MCIO 8i adapter card** (SFF-TA-1016, e.g. ICY DOCK EXLink
  MB409A5) goes in the server; the GPU lives in a **GPD G2 eGPU dock** with a
  built-in 800 W Gold ATX 3.1 PSU and a USB4 v2.0 port for universal hosts.
  MCIO 8i doubles OCuLink bandwidth to **PCIe 4.0 x8 (~15.75 GB/s)**, which is
  why GPD pairs it with RTX 4090/5090-class cards at ~2% measured loss. GPD
  also documents multi-GPU HPC builds (4x docks off one PCIe 5 switch card).
  Caveats: GPD confirmed the dock runs MCIO at PCIe 4.0 (not 5.0) when USB4 v2
  is wired alongside, Linux needs kernel 6.17+, and MCIO is not hot-swappable.

All three options are documented in detail in
[docs/hardware-blueprint.md](docs/hardware-blueprint.md), sections 3 and 3b.

### Workload orchestration strategy (summary)

Full detail in [docs/worker-orchestration.md](docs/worker-orchestration.md).

1. **Primary interactive instance** stays on GPU 0, untouched by batch work.
2. **Resident lightweight models** (Muse Glimmer-class, quantized to ~6-8 GB)
   pin to GPU 1 and stay warm for instant assistant responses.
3. **Long-running heavy loops** (numerical computations, geodetic/inertial
   simulations, CFD/OpenFOAM mesh generation via freecad-mcp and leanforge-mcp)
   run on GPU 2 as isolated background worker daemons with their own queues.
4. **Never co-locate** a background job on the primary pool - if the worker
   pool is busy, the job waits in the queue instead of stealing 4090 VRAM.

---

## Repository layout

```text
multi-gpu-cluster-recipes/
|-- README.md                       # This file - overview and rationale
|-- CONTRIBUTING.md                 # Recipe format, hard rules, validation gates
|-- CHANGELOG.md                    # Version history
|-- AGENTS.md                       # Agent navigation map for this repo
|-- llms.txt                        # LLM-facing index
|-- docs/
|   |-- README.md                   # Docs landing page
|   |-- hardware-blueprint.md       # Power, undervolting, layout, connectivity
|   |-- worker-orchestration.md     # GPU pools, resident models, worker daemons
|   |-- monitoring-and-ops.md       # Monitoring, thresholds, runbooks
|   `-- scale-up-hpc.md             # Multi-dock and multi-host scale-out
|-- website/                        # Docusaurus static site over docs/
|   |-- docusaurus.config.js        # Site config (port 11136, GitHub Pages baseUrl)
|   `-- src/                        # Homepage + theme
`-- .github/
    `-- workflows/
        |-- docs-validation.yml     # Hourly doc lint + link check + auto-commit
        `-- deploy-website.yml      # Build + publish the site to GitHub Pages
```

This is a **documentation/recipe-only repository** - no code, no ports, no
webapp. The docs are published as a static playbook website - see
[Website](#website).

## Website

The docs are published as a **Docusaurus static site** (dark theme, fleet
palette) - no backend, it renders the same `docs/` Markdown that GitHub
shows.

- **Published**:
  [https://sandraschi.github.io/multi-gpu-cluster-recipes/](https://sandraschi.github.io/multi-gpu-cluster-recipes/)
  (rebuilt on every push to `main` via `deploy-website.yml`)
- **Funnel (public)**:
  [https://goliath.tailfab45.ts.net/multigpu/](https://goliath.tailfab45.ts.net/multigpu/)
  (served from this machine via Tailscale Funnel, path `/multigpu/` -> port
  11136; fleet funnel policy: `mcp-central-docs/operations/TailscaleFunnel.md`)
- **Local**: `start.bat` (or `start.ps1`) at the repo root - builds the
  funnel variant if stale, serves it on port 11136, opens the browser.
  Dev server for editing: `cd website && npm run start`.
- **Local dev** (port 11136, registered in the fleet port reservoir):

```bash
cd website
npm install
npm run start        # http://127.0.0.1:11136/multi-gpu-cluster-recipes/
npm run build        # production build into website/build/
```

The `docs/` folder is the single source of truth: the CI lint workflow and
the site build both consume it. Changes to docs are validated by the
`docs-validation` workflow (hourly + on push) and published by
`deploy-website`.

## Quick start

1. Clone this repo.
2. Read [docs/hardware-blueprint.md](docs/hardware-blueprint.md) and build the rig.
3. Read [docs/worker-orchestration.md](docs/worker-orchestration.md) and lay out
   the three GPU pools.
4. Contribute your own recipes back via pull request - see
   [CONTRIBUTING.md](CONTRIBUTING.md) for the recipe format and validation
   gates.

## Roadmap

- [x] Core docs: hardware blueprint, worker orchestration, monitoring, scale-up
- [x] Local playbook website (Docusaurus static site over `docs/`, port 11136, GitHub Pages deploy)
- [ ] GPU pool isolation templates (Linux systemd + Windows PowerShell jobs)
- [ ] Prometheus/Grafana per-pool dashboard compose
- [ ] Undervolting presets per card SKU
- [ ] OpenFOAM/freecad-mcp worker container recipes
- [ ] GPD G2 (MCIO 8i) multi-dock build guide and benchmarks
- [ ] Resident-model keepalive daemon reference implementation
- [ ] Enhanced chat + skill batch webapp (fleet-standard React webapp, planned)

## License

MIT - see [LICENSE](LICENSE).
