# HarnessKit Launch Design
**Date:** 2026-05-29  
**Status:** v0.1 implemented; v0.2 deferred

---

## Overview

HarnessKit v0.1 should be a credible public-release candidate, not a broad runtime expansion. The first release needs to prove the existing MVP is real, provider-neutral, installable, documented, and ready to publish later without surprising users.

Publishing to GitHub or npm is explicitly out of scope for this implementation pass. The goal is publish readiness only.

---

## v0.1 Scope: Launch Hardening

### 1. Provider-neutral Anthropic example

**File:** `examples/anthropic-loop.ts`

Add a second provider example mirroring `examples/openai-loop.ts`. It must use a local structural interface and mock client, not `@anthropic-ai/sdk`, so HarnessKit does not gain a provider dependency. The example should:

- Export `runHarnessedAnthropicLoop()`
- Wrap provider execution in `HarnessKitRuntime`
- Extract token usage from `input_tokens + output_tokens`
- Demonstrate the same Redis-backed persistence path as the OpenAI-compatible example

### 2. README rewrite

Rewrite the public README around the launch message:

1. Hook: agents fail through lost state, context overflow, runaway loops, and budget blowouts.
2. What HarnessKit does in plain English.
3. Install command for consumers.
4. Local development commands.
5. Minimal quickstart.
6. Configuration reference matching the current v0.1 runtime fields.
7. Provider examples linking to OpenAI-compatible and Anthropic mock loops.
8. Architecture summary: state, compaction, guardrails.
9. Contributing and license footer.

### 3. Publish-readiness metadata

Prepare package/repo metadata without publishing:

- Add `.gitignore`
- Add MIT `LICENSE`
- Remove `"private": true`
- Add package description, keywords, license, repository, bugs, homepage, engines, and package file includes
- Keep existing build/test/publish scripts intact

### 4. Validation

Run the existing repository check script:

```bash
npm run check
```

Also run a dry package check that does not publish:

```bash
npm pack --dry-run
```

---

## Explicit v0.1 Non-goals

The following items are valuable, but they expand the runtime API and should ship after the first public release candidate:

- Async summarizer callbacks for context compaction
- `preserve_first_n_messages`
- `regex_only_summarization` / local-only summarization mode
- `conversational: false`
- `runOnce()`
- Public `getTelemetry()` method

---

## v0.2 Candidate Scope: Runtime Expansion

### Context compaction improvements

Future compaction should allow users to preserve orientation messages and optionally provide their own summarizer callback. This needs an API-design pass because `ContextCompactor.optimize()` is currently synchronous.

Potential future config:

```yaml
context_optimization:
  strategy: "adaptive_compaction"
  trigger_threshold_tokens: 4000
  preserve_system_prompt: true
  preserve_first_n_messages: 3
  local_only_summarization: false
```

Define dedupe semantics before implementation so the same message cannot appear in the preserved system prompt, preserved first messages, and tail messages simultaneously.

### Single-request mode

Future runtime support may add one-shot service-to-service execution:

```yaml
conversational: true
```

When `conversational: false`, a future `runOnce()` method should enforce cost and blocked-keyword guardrails without mutating persisted conversation history.

### Observability surface

Telemetry is already present in event payloads. A future `getTelemetry()` helper may expose a snapshot API for users that prefer polling over event handlers.

---

## v0.1 Files Changed

| File | Change |
|------|--------|
| `docs/superpowers/specs/2026-05-29-harnesskit-launch-design.md` | Scope launch plan into v0.1 hardening and v0.2 deferred runtime expansion |
| `docs/superpowers/specs/2026-05-29-harnesskit-v0.1-implementation-plan.md` | New implementation plan |
| `examples/anthropic-loop.ts` | New provider-neutral Anthropic mock example |
| `README.md` | Public launch rewrite |
| `package.json` | Publish-readiness metadata |
| `.gitignore` | New |
| `LICENSE` | New MIT license |
