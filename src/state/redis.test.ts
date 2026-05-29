import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RedisStateStore } from './redisStateStore';
import type { AgentSessionState } from '../types';

const shouldRunRedisIntegration = process.env.HARNESSKIT_REDIS_INTEGRATION === '1';

describe.skipIf(!shouldRunRedisIntegration)('Phase 5: Production RedisStateStore Integration Tests', () => {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  let client: Redis;

  beforeAll(async () => {
    client = new Redis(redisUrl, {
      lazyConnect: true,
      connectTimeout: 1000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });

    await client.connect();
    await client.flushdb();
  });

  afterAll(async () => {
    if (client.status === 'end') {
      return;
    }

    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  });

  it('should persist, hydrate, expire, and clear state through a real ioredis connection', async () => {
    const store = new RedisStateStore({
      client,
      namespace: 'harnesskit_integration',
      ttlSeconds: 60,
    });
    const state: AgentSessionState = {
      sessionId: 'session_real_redis_001',
      tenantId: 'tenant_prod_like',
      currentStep: 4,
      variables: { paymentCaptured: true },
      history: [
        { role: 'system', content: 'Preserve runtime state.' },
        { role: 'assistant', content: 'State saved.' },
      ],
    };

    await store.saveState('tenant_prod_like:session_real_redis_001', state);

    const key = 'harnesskit_integration:state:tenant_prod_like:session_real_redis_001';
    await expect(store.getState('tenant_prod_like:session_real_redis_001')).resolves.toEqual(state);
    await expect(client.ttl(key)).resolves.toBeGreaterThan(0);

    await store.clearState('tenant_prod_like:session_real_redis_001');
    await expect(store.getState('tenant_prod_like:session_real_redis_001')).resolves.toBeNull();
  });
});