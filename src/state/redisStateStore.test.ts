import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RedisStateStore, type RedisClientLike } from './redisStateStore';
import type { AgentSessionState } from '../types';

class FakeRedisClient implements RedisClientLike {
  readonly values = new Map<string, string>();
  readonly setArgs = new Map<string, Array<string | number>>();

  get(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  set(key: string, value: string, ...args: Array<string | number>): void {
    this.values.set(key, value);
    this.setArgs.set(key, args);
  }

  del(key: string): void {
    this.values.delete(key);
  }

}

describe('Phase 2: Redis State Adapter Tests', () => {
  const previousRedisTtl = process.env.REDIS_TTL_SECONDS;

  beforeEach(() => {
    process.env.REDIS_TTL_SECONDS = '120';
  });

  afterEach(() => {
    if (previousRedisTtl === undefined) {
      delete process.env.REDIS_TTL_SECONDS;
      return;
    }

    process.env.REDIS_TTL_SECONDS = previousRedisTtl;
  });

  it('should persist state through an injected Redis-compatible client', async () => {
    const client = new FakeRedisClient();
    const store = new RedisStateStore({ client, namespace: 'tenant_core' });
    const state: AgentSessionState = {
      sessionId: 'session_redis_001',
      tenantId: 'enterprise_client_abc',
      currentStep: 2,
      variables: { refundAuthorized: false },
      history: [{ role: 'system', content: 'Stay safe.' }],
    };

    await store.saveState('enterprise_client_abc:session_redis_001', state);

    const key = 'tenant_core:state:enterprise_client_abc:session_redis_001';
    expect(client.values.has(key)).toBe(true);
    expect(client.setArgs.get(key)).toEqual(['EX', 120]);
    await expect(store.getState('enterprise_client_abc:session_redis_001')).resolves.toEqual(state);

    await store.clearState('enterprise_client_abc:session_redis_001');
    await expect(store.getState('enterprise_client_abc:session_redis_001')).resolves.toBeNull();
  });
});
