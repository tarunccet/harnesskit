import type { AgentSessionState } from '../types.js';

export interface IStateStore {
  saveState(sessionId: string, state: AgentSessionState): Promise<void>;
  getState(sessionId: string): Promise<AgentSessionState | null>;
  clearState(sessionId: string): Promise<void>;
}
