# Hardware Blueprint

Power draw management, undervolting, and physical layout for a 3-GPU open-frame
cluster: one RTX 4090 (24 GB) + two RTX 4060 Ti 16 GB.

---

## 1. Power budget

| Component | TDP | Peak / transient | Notes |
| --- | --- | --- | --- |
| RTX 4090 | 450 W | ~600 W | 12VHPWR transient spikes |
| RTX 4060 Ti 16 GB (x2) | 165 W each | ~200 W each | Best VRAM-per-watt in the 16 GB class |
| CPU + motherboard | ~100-150 W | ~200 W | Open-frame boards idle low |
| Connectivity (risers or OCuLink) + fans + SSD | ~30-50 W | ~50 W | Include in the 12V rail budget |
| **Total** | **~910 W** | **~1,250 W worst case** | |

### PSU sizing rules

- **Minimum 1000 W, recommended 1200-1300 W** with ATX 3.0/3.1 (handles
  12VHPWR transients natively without tripping OCP).
- Use **80+ Gold or Platinum**: the efficiency curve peaks at 50-80% load, and
  this rig idles around 40-60% of its rating during normal use.
- **Prefer a single high-amp +12V rail** or a well-designed multi-rail unit;
  check the OCP (over-current protection) trip point against the 4090's
  ~600 W transient so a spike does not power-cycle the rig.
- Feed the 4090 with its **native 12V-2x6 (12VHPWR) cable**. Do not daisy-chain
  two 8-pin adapters from one rail through an unbranded splitter.
- Each 4060 Ti gets a dedicated 8-pin PCIe cable, not a Y-splitter.

### Monthly power math

Assume $0.25/kWh (typical US/EU):

| Duty cycle | Avg draw | kWh / day | Cost / month |
| --- | --- | --- | --- |
| 8 h/day interactive, rest idle (idle ~120 W) | ~430 W | ~7.2 | **~$54** |
| 24/7 with resident model + light workers | ~550 W | ~13.2 | **~$99** |
| Same, after undervolting (-20%) | ~440 W | ~10.6 | **~$79** |

Undervolting is the cheapest "second PSU" you will ever buy - see below.

---

## 2. Undervolting

Undervolting cuts power and heat at near-zero performance loss. The 4090 is
famously efficient at a fixed voltage ceiling; the 4060 Ti is power-limited at
stock but undervolts cleanly too.

### RTX 4090 (primary)

- Tool: MSI Afterburner curve editor (or NVIDIA Inspector on Linux via
  `nvidia-smi -lgc` / nvidia-settings).
- Target: **0.925-0.975 V at ~2600-2700 MHz** on the curve.
- Method: open the curve editor, Ctrl+F, drag the 2700 MHz point down to the
  chosen voltage, flatten the curve to the right, apply.
- Expected result: **~300-360 W under load instead of 450 W**, hotspot down
  5-10 C, less than 2-3% FPS/token loss.
- Also set **power limit 80-85%** as a second guardrail.

### RTX 4060 Ti 16 GB (secondaries)

- These are efficiency parts already (165 W); undervolting still pays off
  because the cluster runs them 24/7.
- Set **power limit 65-75%** and a **-50 to -100 MHz core offset**; keep memory
  at stock.
- Target: ~110-120 W per card under sustained load. Two cards = a ~90-110 W
  saving over stock, permanently.

### Verification

```bash
nvidia-smi --query-gpu=index,name,power.draw,temperature.gpu,utilization.gpu \
  --format=csv,noheader
```

Run a 10-minute inference or simulation workload before and after the curve
change. The metric that matters is **watts per token / watts per iteration**,
not peak FPS.

---

## 3. Physical layout on an open-frame rig

### Chassis choice

A **Goliath-style open-frame rig** (exposed aluminum extrusion bench with
vertical or horizontal card mounting) is the right form factor because:

- Cards hang exposed: no case airflow dead zones, no ducting required.
- PCIe risers run short and straight from the board to the card slots.
- Power cables are reachable for the inevitable rebuild.

Avoid closed towers: three 2.5-3 slot cards in a tower create a hot sandwich,
and riser routing through tower panels is painful.

### Card spacing

- Give each card at least **2 slots of gap** (3 preferred on the 4090 side).
- Order on the frame: 4090 on its own lane, the two 4060 Tis with one empty
  slot between them so intake fans pull cool air, not each other's exhaust.
- Keep the **4090's exhaust side facing open space**, never a wall or another
  card's backplate.

### PCIe riser stability

Risers are the #1 reliability risk in multi-GPU rigs. Rules:

| Rule | Why |
| --- | --- |
| Buy **PCIe 4.0 x16 shielded risers**, 100-200 mm | Unshielded or long risers drop link speed or corrupt transfers |
| **Zip-tie strain relief** at both ends | A sagging riser slowly works loose and causes random resets |
| Avoid 90-degree sharp bends | Damages signal integrity; if you must bend, use a reinforced 180-degree adapter at the card end only |
| Confirm **link speed** after boot | `nvidia-smi -q -d PCI` should show 16 GT/s (x16 or x8); if it shows x1/x4, reseat |
| Keep risers away from PSU/12VHPWR cables | Inductive noise from high-current wires can corrupt PCIe signaling |

The slot itself supplies up to 75 W; secondary cards get the rest from their
8-pin connectors, so an unpowered riser is fine - but **never** power a riser
from a SATA adapter and plug a 16 GB card through it alone.

### Cable management

- Label every PCIe power cable by GPU slot before assembly.
- Route 12VHPWR with a gentle loop - the 4090 connector is rated for ~30
  insertion cycles and dislikes being bent tight at the plug.
- Keep intake fan faces unobstructed; tie cables behind the frame, not across
  fan inlets.

---

## 3b. External GPUs via the GPD combo (OCuLink and MCIO 8i)

Instead of running both secondaries inside the frame, the modern approach is
the **two-piece external combo** popularized by GPD's eGPU ecosystem: an
**adapter card in the server** plus an **external GPU box** over a latched
cable. Two generations exist - OCuLink (previous) and MCIO 8i (current, the
GPD G2 dock).

```text
Server (open frame)
|
|-- GPU 0  RTX 4090 ................ native PCIe x16 slot (full bandwidth)
|
|-- external adapter card (Gen 1: PCIe x16 to OCuLink x4, or
|    Gen 2: MCIO 8i SFF-TA-1016, x8)
|        |
|        |-- cable ---- external GPU box #1: RTX 4060 Ti 16 GB (RESIDENT)
|        |-- cable ---- external GPU box #2: RTX 4060 Ti 16 GB (WORKER)
```

### Generation 1 - OCuLink (SFF-8611/SFF-8612)

OCuLink (optical-copper link) is a
PCI-SIG standard for PCIe connectivity, internal and external. It has been a
server-workhorse connector for a decade and hit the consumer market via GPD.
Because it carries **pure PCIe signaling** (the same link NVMe drives use),
there is no Thunderbolt controller, no protocol translation, and no CPU
pass-through - just a cable between two PCIe ends. That makes the hardware
**4-5x cheaper than TB3/USB4 eGPU boards** and immune to the CPU-bottleneck
behavior Thunderbolt has.

### The combo, piece by piece

| Piece | What it is | Cost |
| --- | --- | --- |
| PCIe-to-OCuLink adapter card | Plugs into a server PCIe slot; exposes 1-4 OCuLink SFF-8612 ports (x4 each; 4-port cards use x4x4x4x4 bifurcation from one x16 slot) | $25-40 |
| OCuLink SFF-8611 cable | Locking, latched cable; 30-50 cm standard, rigid | $10-20 |
| External GPU box / dock board | Holds the 4060 Ti; OCuLink dock boards (OCuP4V2, EXP GDC class), plexi/open boxes, or a GPD-style enclosure | $30-100 |

The adapter board needs a way to power the external card: dock boards carry
the standard 8-pin PCIe power connector and hook the box's ATX PSU to the
host's power-on signal so the whole cluster starts together.

### Why it wins for this cluster

- **Thermal and acoustic decoupling**: the 4060 Tis move out of the rig zone.
  The resident and worker cards can live in a basement/garage/other room - the
  SFF-8611 link is cable-distance friendly (30 cm to 1 m+ with a ReDriver).
- **No riser-stability roulette**: OCuLink connectors latch positively; there
  is no sagging extender to work loose mid-run.
- **Card swaps in minutes**: unplug one cable, swap the card in the box, plug
  back. No frame surgery.
- **Future-proofing**: OCuLink is a standard; the same boxes take any
  future 16 GB-class card.

### Generation 2 - MCIO 8i (the GPD G2 dock, current gen)

The 2026 successor to OCuLink in GPD's lineup is **MCIO 8i**. The connector
itself is not GPD's invention: MCIO (Mini Cool Edge IO) is an
**industry-standard server connector family** (SNIA SFF-TA-1016, built by
Amphenol, TE Connectivity, VSO) used for internal high-speed PCIe cabling in
servers and storage. What GPD contributed - and it is a genuinely good piece
of in-house engineering from a solid midsize Shenzhen hardware dev firm - is
the **consumer eGPU adaptation**: taking an internal server connector and
making it the link for the world's first MCIO GPU dock (the G2), complete
with an 800 W PSU and a USB4 v2 port. GPD's G2 dock pairs it with the same
adapter-card-in-server concept:

| GPD G2 dock feature | Detail |
| --- | --- |
| Link | MCIO 8i, **PCIe 4.0 x8** (~15.75 GB/s effective) - 2x OCuLink |
| Second port | USB4 v2.0 (80 Gbps sym / 120 Gbps asym, 100 W PD, TB3/4/5 compatible) |
| GPU slot | PCIe 5.0 x16 physical (8 lanes routed), fits RTX 4090/5090-class cards |
| PSU | **Built-in 800 W Gold ATX 3.1** (92%+ efficiency, 12V-2x6) - no external PSU needed |
| Extras | M.2 2280 slot, 2x USB 3.2 Gen 2, GbE, dual-fan cooling |
| Server side | MCIO 8i to PCIe adapter card (e.g. ICY DOCK EXLink MB409A5) |
| Measured loss | ~2% with an RTX 4090 at 4K (GPD benchmarks; vendor data) |

Why it matters for this cluster:

- **2x the OCuLink bandwidth** - the 4060 Tis are no longer x4-limited; even
  the 4090 could leave the frame without taking a visible hit (though keeping
  it native is still free bandwidth).
- **Zero extra PSU per box**: the 800 W Gold ATX 3.1 unit lives in the dock,
  with a proper 12V-2x6 connector for the GPU. One wall plug per external card.
- **HPC story is real**: GPD documents 4x GPD G2 docks off a single PCIe 5
  switch/retimer card (Linkreal class) - a 4-GPU cluster on one workstation
  slot, which is exactly the scale-up path this repo wants later.

Honest caveats:

- **PCIe 4.0, not 5.0, in practice**: GPD clarified (2026-05) that wiring the
  MCIO and USB4 v2 ports side by side creates interference that caps the link
  at PCIe 4.0 x8. Marketing says 512 Gbps; the real number is ~31.5 GB/s
  bidirectional. Still 2x OCuLink - but buy it as "2x OCuLink", not "5.0".
- **Linux needs kernel 6.17+** (plus USB4 v2 controller drivers on Windows).
- **Not hot-swappable** (same as OCuLink): cool-plug only.
- **Ecosystem age**: crowdfunding-era product; the OCuLink ecosystem is
  cheaper and battle-tested. For two 4060 Tis, x4 is already enough - MCIO is
  the upgrade path, not the entry point.

### Bandwidth reality check

| Link | Bandwidth | Use |
| --- | --- | --- |
| Native x16 (PCIe 4.0) | ~31.5 GB/s | The 4090 - interactive, stays in the slot |
| MCIO 8i (PCIe 4.0 x8) | ~15.75 GB/s | The 4060 Tis via GPD G2 dock - 2x OCuLink |
| OCuLink (PCIe 4.0 x4) | ~7.9 GB/s | The 4060 Tis via OCuLink boxes - entry tier |

For this cluster the x4 link is the right price to start, and MCIO 8i is the
upgrade path when the secondaries grow into heavier jobs. The worker cards
are capacity engines: the model fits in the card's VRAM, so the only thing
moving over the cable is the prompt, the result, and the weights at load time
(a 6 GB Q4 model loads in ~1 s over OCuLink). What does **not** belong on
either external link: training with continuous host-device streaming, or
anything that hammers the link per-iteration - that stays on the 4090's
native slot.

### Rules of thumb (both generations)

- **Keep the 4090 native.** The primary card never leaves the x16 slot.
- **Cables are rigid**: plan the run, add strain relief at both ends, do not
  coil them tight.
- **Cool-plug, not hot-plug**: neither OCuLink nor MCIO is hot-swappable on
  consumer platforms. Power down before unplugging.
- **Verify link speed after boot**: `nvidia-smi -q -d PCI` should report
  16 GT/s x4 (OCuLink), 16 GT/s x8 (MCIO 8i), or 32 GT/s x8 (MCIO with a
  native PCIe 5.0 host). x1 = reseat.
- **Power the box**: OCuLink enclosures need their own PSU; the GPD G2 has
  its 800 W Gold ATX 3.1 unit built in. Dock boards ship a power-on wire so
  the box powers up with the server.

### Host combos - matching the rig to the machine you own

| # | Combo | What you need | Notes |
| --- | --- | --- | --- |
| 1 | **Budget open-frame desktop** | ATX board with 3+ PCIe slots, risers | The cheapest entry: 4090 native + 2x 4060 Ti on risers |
| 2 | **Closed tower / ITX + MCIO docks** | MCIO 8i to PCIe adapter card (full-height or low-profile bracket, e.g. ICY DOCK EXLink MB409A5), 1x GPD G2 per external card | G2 has its own 800 W PSU - closed case only needs one PSU for the board. Scale to 4 docks via a PCIe 5 switch/retimer card |
| 3 | **OCuLink notebook + box** | Notebook with a native OCuLink port (GPD DUO, Win Max 2, GPD WIN 4, newer Aya/OneX handhelds) + any external box | The notebook's own mobile dGPU is an extra pool. Box has its own PSU, so laptop power delivery is a non-issue. Expect notebook thermals, not server thermals: it is a worker/portable host, not a 24/7 server |
| 4 | **Notebook without OCuLink** | USB4 v2 / TB4 / TB5 port, or an M.2 2230 NVMe slot + M.2 to OCuLink adapter (GPD publishes the schematic and 3D files for the 2230 adapter) | USB4 route: GPD G2 dock over USB4 v2 (80 Gbps sym / 120 Gbps asym, 100 W PD). M.2 route: OCuLink box over the NVMe slot - needs a bottom panel cutout or a 3D-printed access panel |

Notebook caveats that keep coming up:

- **Cool-plug only** on all three link types (OCuLink, MCIO, USB4 eGPU on
  consumer platforms) - attach before boot, not during.
- **The M.2 to OCuLink adapter eats your boot drive slot** unless the
  notebook has two M.2 slots. Plan the OS drive accordingly.
- **24/7 on a notebook is a durability gamble**: fans, battery and thermal
  paste are not rated for server duty. Use the notebook as a daytime/portable
  pool and let the desktop rig own the overnight workloads.
- Steve's rig - a GPD DUO (dual-screen AMD notebook, native OCuLink) - is
  combo #3: one external 4060 Ti box for the resident pool, the notebook's
  own dGPU for interactive work on the go, and the desktop rig for the heavy
  worker loops.

---

## 4. Thermal management

| Target | Value |
| --- | --- |
| GPU core (all cards) | < 80 C under sustained load |
| GPU hotspot | < 95 C |
| Ambient in rig zone | < 28 C |
| VRAM temps | < 90 C (check via HWiNFO / nvidia-smi dmon) |

- One **axial fan per card zone** (120-140 mm, 800-1200 rpm) blowing along the
  cards' length beats any case fan layout in an open frame.
- The 4060 Tis in a 24/7 worker role: cap their fan curves low (40-55%) and
  rely on the undervolt to keep temps down - fan noise compounds with three
  cards in the room.
- If the rig lives in a living space, a 5-10 C ambient drop (basement, garage,
  window-adjacent) is worth more than any cooler upgrade.

### Monitoring

```bash
# Live watch, updates every 2 s
watch -n 2 nvidia-smi
```

Wire `nvidia-smi --query-gpu=...` into the monitoring loop from
`worker-orchestration.md` so a hotspot breach or a worker that fell off its
power curve pages the operator instead of silently degrading.

---

## 5. Shopping list (reference configuration)

Two connectivity tracks - pick one:

| Item | Ballpark (2026) |
| --- | --- |
| RTX 4090 24 GB | $1,550 - $1,800 |
| RTX 4060 Ti 16 GB (x2) | $430 - $470 each |
| Open-frame rig (Goliath-style) | $150 - $400 |
| PSU 1300 W ATX 3.0 Platinum | $250 - $350 |
| **Track A - risers:** PCIe 4.0 x16 risers (x2, 4090 native in slot) | $25 - $40 each |
| **Track B - OCuLink:** PCIe x16 to OCuLink adapter card + 2x SFF-8611 cables + 2x external GPU boxes/docks | $25-40 + $10-20 + $30-100 each |
| **Track C - MCIO (GPD G2):** MCIO 8i adapter card + 2x GPD G2 docks (800 W PSU built in) | $60-100 + G2 pricing TBD (Indiegogo launch) |
| **Track D - notebook:** M.2 2230 to OCuLink adapter (for laptops without OCuLink) or USB4 v2 cable | $15 - $25, or $0 if the laptop has native OCuLink |
| Fans + cable kit + brackets | $50 - $100 |
| **Total (Track A)** | **~$2,600 - $2,950** |
| **Total (Track B)** | **~$2,700 - $3,150** |
| **Total (Track C)** | **~$2,700 + 2x GPD G2** (PSU cost for secondaries already included) |
