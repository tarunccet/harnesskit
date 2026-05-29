import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HarnessKitRuntime } from './runtime';
import { MemoryStateStore } from '../state/memoryStateStore';
import type { AgentSessionState } from '../types';

describe('Phase 4: Runtime Loop Gate (Financial Airbag) Tests', () => {
  let mockStore: MemoryStateStore;

  beforeEach(() => {
    mockStore = new MemoryStateStore();
  });

  it('should trigger an explicit process abort when consecutive loop cycles pass max_consecutive_loops', async () => {
    const configPath = './haas.config.yaml';
    const runtime = await HarnessKitRuntime.createSession({
      configPath,
      userId: 'dev_user_12',
      store: mockStore
    });

    // Mock configuration properties inside memory runtime context
    runtime.activeConfig = {
      version: '1.0',
      agent_id: 'airbag-test',
      conversational: true,
      safety_guardrails: {
        max_consecutive_loops: 3, // Hard cap set to 3 steps max
        max_session_cost_usd: 5.00,
        blocked_keywords: []
      },
      context_optimization: { strategy: 'adaptive_compaction', trigger_threshold_tokens: 2000, preserve_system_prompt: true, preserve_first_n_messages: 0, regex_only_summarization: false },
      persistence: { save_point: 'every_step', ttl_seconds: 3600 }
    };

    let loopExecutionCount = 0;

    // Simulate an agent stuck in a repetitive loop invocation scenario
    const processLoopBlock = async () => {
      await runtime.runLoop(async (context) => {
        loopExecutionCount++;
        return { status: 'looping_forever' };
      });
    };

    // Execute first 3 steps smoothly
    await processLoopBlock();
    await processLoopBlock();
    await processLoopBlock();

    // The 4th consecutive attempt MUST trigger a runtime exception execution breach
    await expect(processLoopBlock()).rejects.toThrow(
      /HarnessKit Guardrail Breach: max_consecutive_loops limit reached/
    );
    expect(loopExecutionCount).toBe(3); // Code loops hard-stopped from executing further
  });

  it('should invoke programmatic telemetry events on execution steps for scaling analytics hooks', async () => {
    const configPath = './haas.config.yaml';
    const runtime = await HarnessKitRuntime.createSession({
      configPath,
      userId: 'dev_user_12',
      store: mockStore
    });

    const stepStartSpy = vi.fn();
    runtime.on('onStepStart', stepStartSpy); // Validates monetization infrastructure requirement from VISION.MD

    await runtime.runLoop(async () => {
      return { output: 'success' };
    });

    expect(stepStartSpy).toHaveBeenCalledTimes(1);
  });

  it('should block execution before callback invocation when hydrated history contains a blocked keyword', async () => {
    const configPath = './haas.config.yaml';
    const sessionId = 'session_blocked_input';
    const state: AgentSessionState = {
      sessionId,
      tenantId: 'dev_user_12',
      currentStep: 0,
      variables: {},
      history: [{ role: 'user', content: 'The tool returned internal_error details.' }],
    };
    await mockStore.saveState('dev_user_12:session_blocked_input', state);
    const runtime = await HarnessKitRuntime.createSession({
      configPath,
      userId: 'dev_user_12',
      sessionId,
      store: mockStore
    });

    runtime.activeConfig = {
      version: '1.0',
      agent_id: 'blocked-keyword-test',
      conversational: true,
      safety_guardrails: {
        max_consecutive_loops: 3,
        max_session_cost_usd: 5.00,
        blocked_keywords: ['internal_error']
      },
      context_optimization: { strategy: 'adaptive_compaction', trigger_threshold_tokens: 2000, preserve_system_prompt: true, preserve_first_n_messages: 0, regex_only_summarization: false },
      persistence: { save_point: 'every_step', ttl_seconds: 3600 }
    };
    const callback = vi.fn(async () => ({ status: 'should_not_run' }));

    await expect(runtime.runLoop(callback)).rejects.toThrow(
      /HarnessKit Guardrail Breach: blocked_keywords matched "internal_error"/
    );
    expect(callback).not.toHaveBeenCalled();
  });

  it('should reject callback output that introduces a blocked keyword before persisting state', async () => {
    const configPath = './haas.config.yaml';
    const sessionId = 'session_blocked_output';
    const runtime = await HarnessKitRuntime.createSession({
      configPath,
      userId: 'dev_user_12',
      sessionId,
      store: mockStore
    });

    runtime.activeConfig = {
      version: '1.0',
      agent_id: 'blocked-output-test',
      conversational: true,
      safety_guardrails: {
        max_consecutive_loops: 3,
        max_session_cost_usd: 5.00,
        blocked_keywords: ['internal_error']
      },
      context_optimization: { strategy: 'adaptive_compaction', trigger_threshold_tokens: 2000, preserve_system_prompt: true, preserve_first_n_messages: 0, regex_only_summarization: false },
      persistence: { save_point: 'every_step', ttl_seconds: 3600 }
    };

    await expect(runtime.runLoop(async (context) => {
      context.history.push({ role: 'assistant', content: 'INTERNAL_ERROR leaked.' });
      return { status: 'blocked' };
    })).rejects.toThrow(
      /HarnessKit Guardrail Breach: blocked_keywords matched "internal_error"/
    );
    await expect(mockStore.getState('dev_user_12:session_blocked_output')).resolves.toBeNull();
  });

  it('should return a telemetry snapshot via getTelemetry() that reflects completed steps', async () => {
    const runtime = await HarnessKitRuntime.createSession({
      configPath: './haas.config.yaml',
      userId: 'dev_user_telemetry',
      store: new MemoryStateStore(),
    });

    runtime.activeConfig = {
      version: '1.0',
      agent_id: 'telemetry-test',
      conversational: true,
      safety_guardrails: { max_consecutive_loops: 10, max_session_cost_usd: 5.00, blocked_keywords: [] },
      context_optimization: { strategy: 'adaptive_compaction', trigger_threshold_tokens: 2000, preserve_system_prompt: true, preserve_first_n_messages: 0, regex_only_summarization: false },
      persistence: { save_point: 'every_step', ttl_seconds: 3600 },
    };

    const before = runtime.getTelemetry();
    expect(before.totalLoopIterations).toBe(0);
    expect(before.totalTokensUsed).toBe(0);

    await runtime.runLoop(async () => ({
      output: 'done',
      tokenUsage: { totalTokens: 100 },
    }));

    const after = runtime.getTelemetry();
    expect(after.totalLoopIterations).toBe(1);
    expect(after.totalTokensUsed).toBe(100);
  });

  it('getTelemetry() should return a snapshot, not a live reference', async () => {
    const runtime = await HarnessKitRuntime.createSession({
      configPath: './haas.config.yaml',
      userId: 'dev_user_snapshot',
      store: new MemoryStateStore(),
    });

    runtime.activeConfig = {
      version: '1.0',
      agent_id: 'snapshot-test',
      conversational: true,
      safety_guardrails: { max_consecutive_loops: 10, max_session_cost_usd: 5.00, blocked_keywords: [] },
      context_optimization: { strategy: 'adaptive_compaction', trigger_threshold_tokens: 2000, preserve_system_prompt: true, preserve_first_n_messages: 0, regex_only_summarization: false },
      persistence: { save_point: 'every_step', ttl_seconds: 3600 },
    };

    const snapshot = runtime.getTelemetry();
    await runtime.runLoop(async () => ({ output: 'done', tokenUsage: { totalTokens: 50 } }));

    // snapshot captured before runLoop should not have been mutated
    expect(snapshot.totalLoopIterations).toBe(0);
  });

  it('runOnce() should enforce budget guardrail without incrementing loop counter', async () => {
    const runtime = await HarnessKitRuntime.createSession({
      configPath: './haas.config.yaml',
      userId: 'dev_user_once',
      store: new MemoryStateStore(),
    });

    runtime.activeConfig = {
      version: '1.0',
      agent_id: 'run-once-test',
      conversational: false,
      safety_guardrails: { max_consecutive_loops: 3, max_session_cost_usd: 0.003, blocked_keywords: [] },
      context_optimization: { strategy: 'adaptive_compaction', trigger_threshold_tokens: 2000, preserve_system_prompt: true, preserve_first_n_messages: 0, regex_only_summarization: false },
      persistence: { save_point: 'every_step', ttl_seconds: 3600 },
    };

    // Spend up to (but not exceeding) the budget in the first call
    await runtime.runOnce(async () => ({
      output: 'done',
      tokenUsage: { totalTokens: 0, costUsd: 0.002 },
    }));

    // Second call pushes total over the budget limit (0.002 + 0.002 = 0.004 > 0.003)
    await expect(
      runtime.runOnce(async () => ({
        output: 'done',
        tokenUsage: { totalTokens: 0, costUsd: 0.002 },
      })),
    ).rejects.toThrow(/HarnessKit Guardrail Breach: max_session_cost_usd limit reached/);

    // Loop counter should never have incremented
    expect(runtime.getTelemetry().totalLoopIterations).toBe(0);
  });

  it('runOnce() should fire onStepStart and onStepComplete hooks', async () => {
    const runtime = await HarnessKitRuntime.createSession({
      configPath: './haas.config.yaml',
      userId: 'dev_user_once_hooks',
      store: new MemoryStateStore(),
    });

    runtime.activeConfig = {
      version: '1.0',
      agent_id: 'run-once-hooks-test',
      conversational: false,
      safety_guardrails: { max_consecutive_loops: 3, max_session_cost_usd: 5.00, blocked_keywords: [] },
      context_optimization: { strategy: 'adaptive_compaction', trigger_threshold_tokens: 2000, preserve_system_prompt: true, preserve_first_n_messages: 0, regex_only_summarization: false },
      persistence: { save_point: 'every_step', ttl_seconds: 3600 },
    };

    const startSpy = vi.fn();
    const completeSpy = vi.fn();
    runtime.on('onStepStart', startSpy);
    runtime.on('onStepComplete', completeSpy);

    await runtime.runOnce(async () => ({ output: 'done' }));

    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(completeSpy).toHaveBeenCalledTimes(1);
  });

  it('runOnce() should not persist history to the state store', async () => {
    const store = new MemoryStateStore();
    const runtime = await HarnessKitRuntime.createSession({
      configPath: './haas.config.yaml',
      userId: 'dev_user_once_nostate',
      sessionId: 'session_once_nostate',
      store,
    });

    runtime.activeConfig = {
      version: '1.0',
      agent_id: 'run-once-nostate-test',
      conversational: false,
      safety_guardrails: { max_consecutive_loops: 3, max_session_cost_usd: 5.00, blocked_keywords: [] },
      context_optimization: { strategy: 'adaptive_compaction', trigger_threshold_tokens: 2000, preserve_system_prompt: true, preserve_first_n_messages: 0, regex_only_summarization: false },
      persistence: { save_point: 'every_step', ttl_seconds: 3600 },
    };

    await runtime.runOnce(async (context) => {
      context.history.push({ role: 'user', content: 'ephemeral message' });
      return { output: 'done' };
    });

    const savedState = await store.getState('dev_user_once_nostate:session_once_nostate');
    expect(savedState).toBeNull();
  });
});
