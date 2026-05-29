# Dependency Analysis

## Scope

This analysis covers the dependencies considered for Phase 1 configuration parsing and validation.

## Runtime dependencies

### `ioredis`

- Use: production Redis-backed state persistence for `RedisStateStore`.
- Version: `^5.8.2`.
- Reason: Phase 5 requires a production Redis adapter using the standard `ioredis` library.
- Scope: runtime dependency, because production deployments need Redis persistence without injecting a mock client.
- Risk: adds a networked datastore dependency path, so tests keep unit coverage through an injected fake client and gate real Redis integration behind `HARNESSKIT_REDIS_INTEGRATION=1`.

No runtime dependency was added for YAML parsing.

### YAML parser package

- Candidate use: parse `haas.config.yaml` with a general-purpose YAML library.
- Benefit: broader YAML syntax support, including anchors, multiline values, nested arrays, and richer error metadata.
- Cost: adds supply-chain surface area to the open-source runtime core before the MVP schema needs it.
- Constraint impact: project rules require explicit approval before installing outside libraries.
- Phase 1 decision: defer a YAML library and implement a deliberately small parser for the declared MVP schema only.

The current parser supports the schema shape in `SPEC.MD`: top-level scalar keys, one-level nested sections, booleans, numbers, quoted strings, inline arrays, and comments. It intentionally does not attempt to support full YAML.

## Development dependencies

The repository already contains a Vitest test file but did not contain local Node project scaffolding. To make compilation and tests reproducible, the local project now uses TypeScript, Vitest, and Node type definitions as development-only dependencies:

- `typescript` `^6.0.3`: compiles and type-checks the TypeScript source.
- `vitest` `^4.1.7`: executes the existing `src/config/config.test.ts` suite.
- `@types/node` `^25.9.1`: provides static types for Node APIs such as `fs.readFileSync`.

These dependencies do not ship in the HarnessKit runtime API and are used only to validate the TypeScript source and execute the existing test suite.

## Recommendation

Keep Phase 1 runtime dependency-free. Revisit a dedicated YAML parser only if the configuration schema grows beyond the current declarative MVP subset or if users need full YAML compatibility.
