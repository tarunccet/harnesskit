import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStateStore } from './memoryStateStore';
import { AgentSessionState } from '../types';

describe('Phase 2: State Persistence Abstraction Tests', () => {
  let store: MemoryStateStore;

  beforeEach(() => {
    store = new MemoryStateStore();
  });

  it('should successfully serialize and save agent session state keys', async () => {
    const mockState: AgentSessionState = {
      sessionId: 'session_ecom_101',
      tenantId: 'enterprise_client_abc', // Multi-tenancy guard from VISION.MD
      currentStep: 3,
      variables: { refundAuthorized: true },
      history: [
        { role: 'system', content: 'You handle e-commerce refunds.' },
        { role: 'user', content: 'I want a refund.' }
      ]
    };

    await store.saveState('session_ecom_101', mockState);
    const retrievedState = await store.getState('session_ecom_101');

    expect(retrievedState).toBeDefined();
    expect(retrievedState?.currentStep).toBe(3);
    expect(retrievedState?.tenantId).toBe('enterprise_client_abc');
    expect(retrievedState?.variables.refundAuthorized).toBe(true);
    expect(retrievedState?.history).toHaveLength(2);
  });

  it('should return null smoothly if a session_id does not exist (Clean Hydration)', async () => {
    const retrievedState = await store.getState('non_existent_session_id');
    expect(retrievedState).toBeNull();
  });

  it('should successfully clear state logs on session closure or hard reset', async () => {
    const mockState: AgentSessionState = {
      sessionId: 'session_purge_test',
      tenantId: 'tenant_01',
      currentStep: 1,
      variables: {},
      history: []
    };

    await store.saveState('session_purge_test', mockState);
    await store.clearState('session_purge_test');
    
    const retrievedState = await store.getState('session_purge_test');
    expect(retrievedState).toBeNull();
  });
});
