import type { AgentSessionState } from '../types.js';
import type { IStateStore } from './IStateStore.js';

export class MemoryStateStore implements IStateStore {
  private readonly states = new Map<string, AgentSessionState>();

  async saveState(sessionId: string, state: AgentSessionState): Promise<void> {
    this.states.set(sessionId, structuredClone(state));
  }

  async getState(sessionId: string): Promise<AgentSessionState | null> {
    const state = this.states.get(sessionId);

    return state === undefined ? null : structuredClone(state);
  }

  async clearState(sessionId: string): Promise<void> {
    this.states.delete(sessionId);
  }
}
