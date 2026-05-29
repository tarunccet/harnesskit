import type { HarnessKitConfig } from './config/configManager.js';

export type SummarizerFn = (messagesToCompress: ChatMessage[]) => Promise<string>;

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentSessionState {
  sessionId: string;
  tenantId: string;
  currentStep: number;
  variables: Record<string, unknown>;
  history: ChatMessage[];
  consecutiveLoopCount?: number;
  totalTokensUsed?: number;
  totalCostUsd?: number;
  updatedAt?: string;
}

export interface RuntimeTelemetry {
  totalLoopIterations: number;
  totalTokensUsed: number;
  totalCostUsd: number;
}

export interface ExecutionContext {
  sessionId: string;
  tenantId: string;
  currentStep: number;
  activeConfig: HarnessKitConfig;
  history: ChatMessage[];
  variables: Record<string, unknown>;
  telemetry: RuntimeTelemetry;
}

export interface TokenUsageReport {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  inputCostPer1KUsd?: number;
  outputCostPer1KUsd?: number;
  costUsd?: number;
}

export interface RuntimeResultWithUsage {
  tokenUsage?: TokenUsageReport;
}

export type RuntimeEventName = 'onStepStart' | 'onStepComplete' | 'onLimitBreached';

export interface RuntimeEventPayload {
  sessionId: string;
  tenantId: string;
  currentStep: number;
  telemetry: RuntimeTelemetry;
  reason?: string;
}

export type RuntimeEventHandler = (payload: RuntimeEventPayload) => void | Promise<void>;
