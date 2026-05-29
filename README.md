# HarnessKit

You can build and ship a production-grade AI agent in an afternoon. HarnessKit is the runtime layer that makes that true — it wraps your existing TypeScript agent loop with durable state, adaptive context compaction, and config-driven guardrails so you write agent logic, not infrastructure plumbing.

The hard parts are already solved. Session state survives crashes. Context never silently overflows. Runaway loops and budget blowouts are caught before they happen. You write the agent logic — HarnessKit handles the edge cases you haven't thought of yet.

## What it does

- Persists session state after every runtime step
- Rehydrates existing sessions by `userId` and `sessionId`
- Compacts long histories before they exceed your token threshold
- Preserves system prompts during compaction
- Stops runaway loops and budget breaches through `haas.config.yaml`
- Blocks configured unsafe keywords before replay or persistence
- Emits runtime hooks for audit, billing, and observability integrations
- Works with any LLM provider or agent framework

## Install

```bash
npm install harnesskit
```

## Local development

```bash
npm install
npm run check
```

`npm run check` type-checks the source and examples, runs tests, builds `dist/`, and smoke-imports the compiled ESM package.

## Quickstart

```ts
import { HarnessKitRuntime, MemoryStateStore } from 'harnesskit';

const runtime = await HarnessKitRuntime.createSession({
  configPath: './haas.config.yaml',
  userId: 'tenant_demo',
  sessionId: 'session_demo',
  store: new MemoryStateStore(),
});

await runtime.runLoop(async (context) => {
  context.history.push({ role: 'user', content: 'Run the next agent step.' });
  return { output: 'done', tokenUsage: { totalTokens: 42 } };
});
```

## Configuration

HarnessKit loads `haas.config.yaml` at session startup:

```yaml
version: "1.0"
agent_id: "harnesskit-local-agent"
safety_guardrails:
  max_consecutive_loops: 5       # stop before a runaway agent loop drains budget
  max_session_cost_usd: 1.50     # abort when tracked session spend exceeds this limit
  blocked_keywords: []           # reject unsafe replayed history or callback output
context_optimization:
  strategy: "adaptive_compaction"
  trigger_threshold_tokens: 4000 # compact history after estimated tokens cross this line
  preserve_system_prompt: true   # keep the original system prompt verbatim
persistence:
  save_point: "every_step"       # persist after every successful runtime step
  ttl_seconds: 86400             # optional Redis expiry for saved sessions
```

## Redis-backed sessions

Start Redis locally:

```bash
docker compose up -d harnesskit-cache
```

Then use the production adapter:

```ts
import { HarnessKitRuntime, RedisStateStore } from 'harnesskit';

const store = new RedisStateStore({ redisUrl: process.env.REDIS_URL });
const runtime = await HarnessKitRuntime.createSession({
  configPath: './haas.config.yaml',
  userId: 'tenant_demo',
  sessionId: 'session_123',
  store,
});
```

Run the gated Redis integration test with:

```bash
npm run test:redis
```

## Provider examples

HarnessKit does not own your model call. It gives your existing provider loop durable state, compaction, and guardrails.

- `examples/openai-loop.ts` shows an OpenAI-compatible chat-completions loop.
- `examples/anthropic-loop.ts` shows an Anthropic-compatible messages loop with a local mock client.

## Architecture

HarnessKit has three composable layers. The state layer stores and rehydrates session history through `IStateStore` implementations such as `MemoryStateStore` and `RedisStateStore`. The context layer estimates token pressure and compacts long histories into a structured execution summary while preserving the system prompt. The guardrail layer wraps each runtime step, enforces loop/cost/keyword limits, persists safe state, and emits telemetry-ready lifecycle hooks.

## Package output

The package builds to `dist/` with ESM JavaScript, source maps, `.d.ts` declarations, and declaration maps.

## Contributing

Keep the core runtime provider-neutral and infrastructure-focused. New runtime behavior should include tests, preserve the `IStateStore` abstraction, and avoid adding provider SDKs to the core package.

## License

MIT
