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
      safety_guardrails: {
        max_consecutive_loops: 3, // Hard cap set to 3 steps max
        max_session_cost_usd: 5.00,
        blocked_keywords: []
      },
      context_optimization: { strategy: 'adaptive_compaction', trigger_threshold_tokens: 2000, preserve_system_prompt: true },
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
      safety_guardrails: {
        max_consecutive_loops: 3,
        max_session_cost_usd: 5.00,
        blocked_keywords: ['internal_error']
      },
      context_optimization: { strategy: 'adaptive_compaction', trigger_threshold_tokens: 2000, preserve_system_prompt: true },
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
      safety_guardrails: {
        max_consecutive_loops: 3,
        max_session_cost_usd: 5.00,
        blocked_keywords: ['internal_error']
      },
      context_optimization: { strategy: 'adaptive_compaction', trigger_threshold_tokens: 2000, preserve_system_prompt: true },
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
});
