import { randomUUID } from 'crypto';
import { ConfigManager, type HarnessKitConfig } from '../config/configManager.js';
import { ContextCompactor } from '../context/contextCompactor.js';
import { MemoryStateStore } from '../state/memoryStateStore.js';
import type { IStateStore } from '../state/IStateStore.js';
import type {
  AgentSessionState,
  ChatMessage,
  ExecutionContext,
  RuntimeEventHandler,
  RuntimeEventName,
  RuntimeEventPayload,
  RuntimeResultWithUsage,
  RuntimeTelemetry,
  TokenUsageReport,
} from '../types.js';

export interface SessionConfig {
  configPath: string;
  userId: string;
  sessionId?: string;
  store?: IStateStore;
}

export class HarnessKitRuntime {
  activeConfig: HarnessKitConfig;
  isResumed = false;
  currentStep = 0;

  private readonly tenantId: string;
  private readonly sessionId: string;
  private readonly stateKey: string;
  private readonly store: IStateStore;
  private readonly listeners = new Map<RuntimeEventName, RuntimeEventHandler[]>();
  private history: ChatMessage[] = [];
  private variables: Record<string, unknown> = {};
  private telemetry: RuntimeTelemetry = {
    totalLoopIterations: 0,
    totalTokensUsed: 0,
    totalCostUsd: 0,
  };

  private constructor(config: {
    activeConfig: HarnessKitConfig;
    tenantId: string;
    sessionId: string;
    store: IStateStore;
  }) {
    this.activeConfig = config.activeConfig;
    this.tenantId = config.tenantId;
    this.sessionId = config.sessionId;
    this.stateKey = buildStateKey(config.tenantId, config.sessionId);
    this.store = config.store;
  }

  static async createSession(config: SessionConfig): Promise<HarnessKitRuntime> {
    const activeConfig = ConfigManager.load(config.configPath);
    const sessionId = config.sessionId ?? `session_${randomUUID()}`;
    const runtime = new HarnessKitRuntime({
      activeConfig,
      tenantId: config.userId,
      sessionId,
      store: config.store ?? new MemoryStateStore(),
    });

    await runtime.rehydrateState();

    return runtime;
  }

  on(eventName: RuntimeEventName, handler: RuntimeEventHandler): this {
    const handlers = this.listeners.get(eventName) ?? [];
    handlers.push(handler);
    this.listeners.set(eventName, handlers);

    return this;
  }

  async getOptimizedHistory(): Promise<ChatMessage[]> {
    return ContextCompactor.optimize(this.history, {
      triggerThresholdTokens: this.activeConfig.context_optimization.trigger_threshold_tokens,
      preserveSystemPrompt: this.activeConfig.context_optimization.preserve_system_prompt,
      preserveFirstNMessages: this.activeConfig.context_optimization.preserve_first_n_messages,
      regexOnlySummarization: this.activeConfig.context_optimization.regex_only_summarization,
    });
  }

  getTelemetry(): RuntimeTelemetry {
    return structuredClone(this.telemetry);
  }

  async runLoop<TResult>(
    executionCallback: (context: ExecutionContext) => Promise<TResult>,
  ): Promise<TResult> {
    await this.rehydrateState();
    await this.assertCanStartStep();
    await this.emit('onStepStart');

    const context: ExecutionContext = {
      sessionId: this.sessionId,
      tenantId: this.tenantId,
      currentStep: this.currentStep,
      activeConfig: this.activeConfig,
      history: structuredClone(this.history),
      variables: structuredClone(this.variables),
      telemetry: structuredClone(this.telemetry),
    };

    const result = await executionCallback(context);
    const usage = readTokenUsage(result);

    await this.assertNoBlockedKeywords([
      { name: 'history', value: context.history },
      { name: 'variables', value: context.variables },
      { name: 'result', value: result },
    ]);

    this.history = context.history;
    this.variables = context.variables;
    this.currentStep += 1;
    this.telemetry.totalLoopIterations += 1;
    this.telemetry.totalTokensUsed += calculateTotalTokens(usage);
    this.telemetry.totalCostUsd += calculateCostUsd(usage);

    await this.persistState();
    await this.assertBudgetWithinGuardrails();
    await this.emit('onStepComplete');

    return result;
  }

  async runOnce<TResult>(
    executionCallback: (context: ExecutionContext) => Promise<TResult>,
  ): Promise<TResult> {
    await this.assertBudgetWithinGuardrails();

    const context: ExecutionContext = {
      sessionId: this.sessionId,
      tenantId: this.tenantId,
      currentStep: this.currentStep,
      activeConfig: this.activeConfig,
      history: [],
      variables: structuredClone(this.variables),
      telemetry: structuredClone(this.telemetry),
    };

    await this.assertNoBlockedKeywords([{ name: 'variables', value: context.variables }]);
    await this.emit('onStepStart');

    const result = await executionCallback(context);
    const usage = readTokenUsage(result);

    this.telemetry.totalTokensUsed += calculateTotalTokens(usage);
    this.telemetry.totalCostUsd += calculateCostUsd(usage);

    await this.assertNoBlockedKeywords([
      { name: 'history', value: context.history },
      { name: 'result', value: result },
    ]);

    await this.assertBudgetWithinGuardrails();
    await this.emit('onStepComplete');

    return result;
  }

  private async rehydrateState(): Promise<void> {
    const existingState = await this.store.getState(this.stateKey);

    if (existingState === null) {
      return;
    }

    this.isResumed = true;
    this.currentStep = existingState.currentStep;
    this.history = existingState.history;
    this.variables = existingState.variables;
    this.telemetry = {
      totalLoopIterations: existingState.currentStep,
      totalTokensUsed: existingState.totalTokensUsed ?? 0,
      totalCostUsd: existingState.totalCostUsd ?? 0,
    };
  }

  private async persistState(): Promise<void> {
    const state: AgentSessionState = {
      sessionId: this.sessionId,
      tenantId: this.tenantId,
      currentStep: this.currentStep,
      variables: this.variables,
      history: this.history,
      consecutiveLoopCount: this.currentStep,
      totalTokensUsed: this.telemetry.totalTokensUsed,
      totalCostUsd: this.telemetry.totalCostUsd,
      updatedAt: new Date().toISOString(),
    };

    await this.store.saveState(this.stateKey, state);
  }

  private async assertCanStartStep(): Promise<void> {
    if (this.currentStep >= this.activeConfig.safety_guardrails.max_consecutive_loops) {
      const reason = 'HarnessKit Guardrail Breach: max_consecutive_loops limit reached';
      await this.emit('onLimitBreached', reason);
      throw new Error(reason);
    }

    await this.assertBudgetWithinGuardrails();
    await this.assertNoBlockedKeywords([
      { name: 'history', value: this.history },
      { name: 'variables', value: this.variables },
    ]);
  }

  private async assertBudgetWithinGuardrails(): Promise<void> {
    if (this.telemetry.totalCostUsd > this.activeConfig.safety_guardrails.max_session_cost_usd) {
      const reason = 'HarnessKit Guardrail Breach: max_session_cost_usd limit reached';
      await this.emit('onLimitBreached', reason);
      throw new Error(reason);
    }
  }

  private async assertNoBlockedKeywords(
    surfaces: Array<{ name: string; value: unknown }>,
  ): Promise<void> {
    const matchedKeyword = findBlockedKeyword(
      surfaces,
      this.activeConfig.safety_guardrails.blocked_keywords,
    );

    if (matchedKeyword === null) {
      return;
    }

    const reason = `HarnessKit Guardrail Breach: blocked_keywords matched "${matchedKeyword.keyword}" in ${matchedKeyword.surface}`;
    await this.emit('onLimitBreached', reason);
    throw new Error(reason);
  }

  private async emit(eventName: RuntimeEventName, reason?: string): Promise<void> {
    const handlers = this.listeners.get(eventName) ?? [];
    const payload: RuntimeEventPayload = {
      sessionId: this.sessionId,
      tenantId: this.tenantId,
      currentStep: this.currentStep,
      telemetry: structuredClone(this.telemetry),
      reason,
    };

    await Promise.all(handlers.map((handler) => handler(payload)));
  }
}

function buildStateKey(tenantId: string, sessionId: string): string {
  return `${tenantId}:${sessionId}`;
}

function readTokenUsage(result: unknown): TokenUsageReport | undefined {
  if (typeof result !== 'object' || result === null || !('tokenUsage' in result)) {
    return undefined;
  }

  const maybeUsage = (result as RuntimeResultWithUsage).tokenUsage;

  if (maybeUsage === undefined) {
    return undefined;
  }

  return maybeUsage;
}

function calculateTotalTokens(usage: TokenUsageReport | undefined): number {
  if (usage === undefined) {
    return 0;
  }

  return usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
}

function calculateCostUsd(usage: TokenUsageReport | undefined): number {
  if (usage === undefined) {
    return 0;
  }

  if (usage.costUsd !== undefined) {
    return usage.costUsd;
  }

  const inputCost = ((usage.inputTokens ?? 0) / 1000) * (usage.inputCostPer1KUsd ?? 0);
  const outputCost = ((usage.outputTokens ?? 0) / 1000) * (usage.outputCostPer1KUsd ?? 0);

  return inputCost + outputCost;
}

function findBlockedKeyword(
  surfaces: Array<{ name: string; value: unknown }>,
  blockedKeywords: string[],
): { keyword: string; surface: string } | null {
  const normalizedKeywords = blockedKeywords
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);

  for (const surface of surfaces) {
    for (const keyword of normalizedKeywords) {
      if (containsKeyword(surface.value, keyword.toLowerCase())) {
        return { keyword, surface: surface.name };
      }
    }
  }

  return null;
}

function containsKeyword(value: unknown, normalizedKeyword: string, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'string') {
    return value.toLowerCase().includes(normalizedKeyword);
  }

  if (typeof value !== 'object' || value === null) {
    return false;
  }

  if (seen.has(value)) {
    return false;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.some((item) => containsKeyword(item, normalizedKeyword, seen));
  }

  return Object.values(value as Record<string, unknown>).some((item) => {
    return containsKeyword(item, normalizedKeyword, seen);
  });
}
