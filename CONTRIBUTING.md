# Contributing

This is a **documentation and recipe repository** - the product is the text.
Every recipe should be something a reader can build from without a single
phone call to support.

## What we accept

| Type | Example | Where |
| --- | --- | --- |
| Hardware recipes | Undervolting preset for a card SKU, riser/cable field report, open-frame build log | `docs/` or a new `recipes/` page |
| Connectivity reports | OCuLink or MCIO 8i dock results, cable length findings, link-speed screenshots | `docs/hardware-blueprint.md` |
| Orchestration patterns | Worker daemon snippets, resident-model keepalive configs, queue designs | `docs/worker-orchestration.md` |
| Ops runbooks | What to do when X fails, monitoring setups | `docs/monitoring-and-ops.md` |
| Scale-out stories | Multi-dock builds, notebook+desktop fleets | `docs/scale-up-hpc.md` |

## Recipe format

1. **Goal** - one paragraph, what the reader ends up with.
2. **Hardware** - exact SKUs, prices in USD, total cost line.
3. **Steps** - ordered, copy-pasteable commands or physical steps.
4. **Results** - measured numbers (watts, temps, GB/s, tokens/s). Never
   invent numbers; if you did not measure it, say "unverified".
5. **Caveats** - what went wrong, what to avoid, when not to do this.

## Hard rules

- **ASCII only.** No em dashes (U+2014) or other non-ASCII punctuation in
  any file - the CI unicode gate fails on them. Use ` - ` instead.
- **Real numbers.** Estimates are allowed but must be labeled
  (`~`, "vendor data", "unverified"). Fabricated benchmarks are grounds for
  rejection.
- **Tables for data.** Anything tabular (power, bandwidth, costs, temps)
  is a Markdown table, not a prose wall.
- **Dark mode irrelevant** - this is Markdown, but keep screenshots dark if
  you attach any.

## Local validation (mirrors CI)

```bash
npm install --global markdownlint-cli2
markdownlint-cli2 "**/*.md" "#node_modules" "#.git"

# Website build gate: the site renders docs/ directly and throws on
# broken links - a docs change that breaks the site fails here
cd website && npm ci && npm run build

# relative links + unicode check
python - <<'EOF'
import os, re, sys
broken = []
for root, _, files in os.walk("."):
    if ".git" in root or "node_modules" in root:
        continue
    for name in files:
        if not name.endswith(".md"):
            continue
        path = os.path.join(root, name)
        for m in re.finditer(r"\]\(([^)]+)\)", open(path, encoding="utf-8").read()):
            t = m.group(1).strip()
            if t.startswith(("http", "#", "mailto:")) or not t:
                continue
            if not os.path.exists(os.path.normpath(os.path.join(os.path.dirname(path), t.split("#")[0]))):
                broken.append(f"{path} -> {t}")
if broken:
    print("\n".join(broken)); sys.exit(1)
print("links OK")
EOF

grep -rn $'\u2014' README.md docs/ .github/ && echo "em dash found" && exit 1 || echo "unicode OK"
```

## PR flow

1. Branch off `main`, one topic per PR.
2. Pass the local validation above.
3. The hourly `docs-validation` workflow re-checks on push and auto-commits
   trivial fixups (it will touch your branch, pull before pushing again).
4. Keep PRs small; a recipe is a reviewable unit. No AI-batch-mega-PRs.
