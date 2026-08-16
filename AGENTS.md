# multi-gpu-cluster-recipes

Documentation and recipe collection for budget multi-GPU local AI clusters:
an RTX 4090 primary engine with RTX 4060 Ti 16 GB secondaries, connected via
internal risers, OCuLink (SFF-8611), or MCIO 8i (GPD G2 dock, SFF-TA-1016)
external links, including notebook host combos and worker orchestration.

## Reading order

1. `README.md` - overview, economics, host combo matrix
2. `docs/hardware-blueprint.md` - power budget, undervolting, layout, connectivity
3. `docs/worker-orchestration.md` - GPU pools, resident models, worker daemons
4. `docs/monitoring-and-ops.md` - monitoring, thresholds, runbooks
5. `docs/scale-up-hpc.md` - multi-dock and multi-host scale-out

## Website

`website/` is a Docusaurus static site that renders the `docs/` folder
directly (path: `../docs` - single source of truth, no copy). Dev server on
port 11136 (`npm run start`), GitHub Pages deploy via
`.github/workflows/deploy-website.yml`. Any docs change must pass
`cd website && npm run build` (onBrokenLinks throws).

## Rules

- ASCII only in every file - no em dashes. The CI unicode gate fails on them.
- Real measured numbers or explicitly labeled estimates, never invented
  benchmarks (see CONTRIBUTING.md).
- Tabular data (power, bandwidth, costs) goes in Markdown tables.
- Validate locally before PRs: markdownlint-cli2, relative-link check, and
  the unicode gate - commands are in CONTRIBUTING.md.

## Docs status

This is a recipe repo, not an MCP server: no code, no ports, no webapp.
A local playbook website (static site over these docs) is a planned roadmap
item - see README.md Roadmap.
