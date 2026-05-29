# HarnessKit - Product & Engineering Specification

## 1. System Vision & Architecture Paradigm
HarnessKit is a FOSS-first, self-hosted runtime infrastructure layer for AI agents (Python & TypeScript). Unlike prompt frameworks (LangChain), HarnessKit is a state-preserving runtime executor. It sits between an enterprise application and external LLM APIs to handle durable state, token reduction, and hard safety limits via configuration files.

## 2. Core Technical Constraints (MVP)

### A. Runtime State Proxy (Durable Execution)
*   **Behavior:** Every agent workflow action must step through a HarnessKit runtime proxy layer. 
*   **State Machine:** After every LLM response or tool invocation, the agent session state (context payload, intermediate variables, timestamp) must automatically be serialized to a pluggable data layer.
*   **Target Backend Support:** Local Memory (Development) and standard Redis/PostgreSQL (Production).
*   **Rehydration Engine:** If a request session resumes with an existing `session_id`, the runtime must automatically query the state layer, rehydrate the message array, and provide the historical pointer back to the host application without forcing a replay.

### B. Adaptive Context Compaction Engine
*   **Behavior:** Protect the LLM context window from expanding exponentially.
*   **Trigger Mechanism:** Monitor token tracking on every loop step. When active token utilization passes a configurable YAML threshold (default: 4000 tokens), trigger compaction.
*   **Compaction Rule:** A lightweight token utility utility must preserve the original `system_prompt` and the last `N` messages, while extracting a structured summary markdown log of intermediate historical steps. Replace old conversational turns with this single historical block.

### C. Declarative Inline Guardrails (Financial Airbags)
*   **Behavior:** Stop runaway processes *before* they pass external API endpoints.
*   **Validation Gate:** Every step execution must increment an absolute session counter and evaluate budget logic.
*   **Hard Limits:** 
    *   `max_consecutive_loops` (Abort loop execution if the model hits the tool execution maximum consecutively).
    *   `max_session_cost_usd` (Read model pricing arrays and kill session if calculated token cost exceeds threshold).

## 3. Configuration Interface Standard (`haas.config.yaml`)
The agent must parse and validate the following structural schema on system startup:

```yaml
version: "1.0"
agent_id: "string"
safety_guardrails:
  max_consecutive_loops: integer
  max_session_cost_usd: float
  blocked_keywords: [string]
context_optimization:
  strategy: "adaptive_compaction"
  trigger_threshold_tokens: integer
  preserve_system_prompt: boolean
persistence:
  save_point: "every_step"
  ttl_seconds: integer
```

## 4. API Surface Area (Interface Architecture)
The runtime engine must expose an instantiation endpoint and a execution loop gate.

### TypeScript / JavaScript SDK Interface Mockup:
```typescript
export interface SessionConfig {
  configPath: string;
  userId: string;
  sessionId?: string;
}

export class HarnessKitRuntime {
  static async createSession(config: SessionConfig): Promise<AgentSession>;
}

export class AgentSession {
  isResumed: boolean;
  currentStep: number;
  getOptimizedHistory(): Promise<any[]>;
  runLoop(executionCallback: (context: any) => Promise<any>): Promise<any>;
}
```

## 5. Development Milestones & Definition of Done
- [ ] Parse and assert structure of local `haas.config.yaml`.
- [ ] Implement active memory serialization hook into localized Redis instance.
- [ ] Create token counter utility with automatic system-prompt preservation.
- [ ] Build execution exception handler to terminate loop when budget constraints are reached.
