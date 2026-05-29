# HarnessKit Agent Instructions

This repository builds **HarnessKit**: a self-hosted TypeScript runtime layer for AI agents.

## Source of truth

1. `SPEC.MD` — immediate technical constraints.
2. `Vision.md` — product direction and positioning.
3. `TODO.md` — execution phases and current work.
4. `README.md` — public usage and build instructions.
5. `package.json` — canonical scripts and package format.

## Operating rules

- Keep the core engine framework-agnostic and provider-neutral.
- Do not add runtime dependencies without explicit approval or a matching phase requirement.
- Preserve the `IStateStore` abstraction; vendor-specific logic stays in adapters.
- Enforce every field promised by `haas.config.yaml`.
- Follow TDD: add or update tests with the code they validate.
- Make surgical changes; do not rewrite unrelated systems.
- Keep the ESM build deployable: relative imports must remain compatible with `dist/`.

## Workflow

1. Read `TODO.md` and mark the active phase **In Progress** before editing.
2. Implement the smallest complete change that satisfies the phase.
3. Add or update tests first when behavior changes.
4. Run the repo checks before finishing:
   - `npm run check`
   - `npm run test:redis` when Redis integration is intended and available
5. Mark the phase **Completed** only after the checks pass.

## Architecture

- `src/config/` — config parsing and validation.
- `src/state/` — state persistence abstractions and adapters.
- `src/context/` — context compaction.
- `src/runtime/` — session execution loop and guardrails.
- `src/types.ts` — shared runtime types.

## Packaging

- Build output goes to `dist/`.
- Shipping artifacts must include `.d.ts` files and sourcemaps.
- The compiled package should smoke-import with Node ESM.

## Guardrails

- Enforce `blocked_keywords` and other declared safety constraints.
- Keep telemetry and event hooks intact for future observability work.
- Prefer explicit failures over silent fallback behavior.

