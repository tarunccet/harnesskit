# HarnessKit v0.1 Implementation Plan
**Date:** 2026-05-29  
**Status:** Complete  
**Publish policy:** Do not publish to GitHub or npm in this pass.

---

## Goal

Prepare HarnessKit v0.1 as a public-release candidate by tightening launch messaging, adding provider-neutral examples, and making the package metadata ready for a later publish step.

---

## Work Plan

### 1. Documentation and launch positioning

- Rewrite `README.md` so a developer understands the problem, value, install path, quickstart, configuration, examples, and architecture in under one minute.
- Keep the README aligned with the current v0.1 runtime. Do not document deferred config fields or methods.

### 2. Provider-neutral examples

- Keep `examples/openai-loop.ts` as the OpenAI-compatible example.
- Add `examples/anthropic-loop.ts` with a local mock Anthropic-compatible client interface.
- Avoid adding provider SDK dependencies.

### 3. Publish-readiness metadata

- Add `.gitignore` for generated files, local environment files, and dependency directories.
- Add MIT `LICENSE`.
- Update `package.json` with public package metadata and npm package contents.
- Do not run `npm publish`, `gh repo create`, `git push`, or any release tagging.

### 4. Validation

- Run `npm run check`.
- Run `npm pack --dry-run`.
- Treat failures as blockers for v0.1 readiness.

---

## Acceptance Criteria

- `npm run check` passes.
- `npm pack --dry-run` succeeds and shows only intentional package contents.
- README references only runtime behavior that exists today.
- Anthropic example type-checks without installing an Anthropic SDK.
- Package is ready to publish later, but no publish action is performed.

---

## Validation Results

- `npm run check`: passed
- `npm pack --dry-run`: passed
- Publish actions: not run
