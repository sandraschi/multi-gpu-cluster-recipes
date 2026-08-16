# Changelog

All notable changes to this repository.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Scale-out and multi-host fleet recipes (planned): PCIe 5 switch-card docks,
  notebook+desktop pool mobility at fleet scale.

## [0.2.0] - 2026-08-16

### Added
- Docusaurus static playbook website in `website/` (dark theme, fleet
  palette) rendering the canonical `docs/` folder directly - no content
  duplication.
- Website dev port 11136 (registered in the fleet port reservoir).
- `deploy-website.yml` workflow: build + publish to GitHub Pages on every
  push to `main`.
- `docs/README.md` landing page (also the `/docs/` route on the site).

## [0.1.0] - 2026-08-16

### Added
- Initial scaffold of the multi-GPU cluster recipe collection.
- `README.md`: economics rationale (cloud cost vs local build), VRAM
  thrashing problem, reference architecture, host combo matrix (open-frame
  desktop, closed tower + MCIO docks, OCuLink notebook, USB4/M.2 notebook).
- `docs/hardware-blueprint.md`: power budget and PSU sizing, undervolting
  presets for RTX 4090 and RTX 4060 Ti, open-frame physical layout,
  connectivity guides for internal risers, OCuLink (SFF-8611), and MCIO 8i
  (GPD G2 dock, SFF-TA-1016).
- `docs/worker-orchestration.md`: three-pool topology (primary / resident /
  worker), CUDA device pinning, resident-model keepalive pattern, background
  worker daemon + queue pattern, VRAM budget rules, monitoring thresholds,
  failure policy, host matrix with pool mobility.
- `docs/monitoring-and-ops.md`: per-pool monitoring, health checks, runbooks.
- `docs/scale-up-hpc.md`: multi-dock and multi-host scale-out path.
- CI: hourly `docs-validation` workflow (markdownlint, relative-link check,
  unicode gate, auto-commit of doc fixups).
- `LICENSE` (MIT), `CONTRIBUTING.md`, `AGENTS.md`, `llms.txt`, `.gitignore`.
