import { Redis, type RedisOptions } from 'ioredis';
import type { AgentSessionState, ChatMessage } from '../types.js';
import type { IStateStore } from './IStateStore.js';

export interface RedisClientLike {
  get(key: string): Promise<string | null> | string | null;
  set(key: string, value: string, ...args: Array<string | number>): Promise<unknown> | unknown;
  del(key: string): Promise<unknown> | unknown;
  quit?(): Promise<unknown> | unknown;
  disconnect?(): void;
}

export interface RedisStateStoreOptions {
  client?: Redis | RedisClientLike;
  redisUrl?: string;
  redisOptions?: RedisOptions;
  namespace?: string;
  ttlSeconds?: number;
}

const DEFAULT_REDIS_URL = 'redis://localhost:6379';

export class RedisStateStore implements IStateStore {
  private readonly client: Redis | RedisClientLike;
  private readonly namespace: string;
  private readonly ttlSeconds?: number;
  private readonly ownsClient: boolean;

  constructor(options: RedisStateStoreOptions = {}) {
    this.client =
      options.client ??
      new Redis(options.redisUrl ?? process.env.REDIS_URL ?? DEFAULT_REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        ...options.redisOptions,
      });
    this.namespace = options.namespace ?? process.env.REDIS_NAMESPACE ?? 'harnesskit';
    this.ttlSeconds = options.ttlSeconds ?? readOptionalPositiveInteger('REDIS_TTL_SECONDS');
    this.ownsClient = options.client === undefined;
  }

  async saveState(sessionId: string, state: AgentSessionState): Promise<void> {
    const key = this.buildKey(sessionId);
    const serializedState = JSON.stringify(state);

    if (this.ttlSeconds === undefined) {
      await this.client.set(key, serializedState);
      return;
    }

    await setWithTtl(this.client, key, serializedState, this.ttlSeconds);
  }

  async getState(sessionId: string): Promise<AgentSessionState | null> {
    const serializedState = await this.client.get(this.buildKey(sessionId));

    if (serializedState === null) {
      return null;
    }

    return parseStoredState(serializedState);
  }

  async clearState(sessionId: string): Promise<void> {
    await this.client.del(this.buildKey(sessionId));
  }

  async close(): Promise<void> {
    if (!this.ownsClient) {
      return;
    }

    if (this.client.quit !== undefined) {
      await this.client.quit();
      return;
    }

    this.client.disconnect?.();
  }

  private buildKey(sessionId: string): string {
    return `${this.namespace}:state:${sessionId}`;
  }
}

async function setWithTtl(
  client: Redis | RedisClientLike,
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<void> {
  if (client instanceof Redis) {
    await client.set(key, value, 'EX', ttlSeconds);
    return;
  }

  await client.set(key, value, 'EX', ttlSeconds);
}

function readOptionalPositiveInteger(name: string): number | undefined {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue === '') {
    return undefined;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
}

function parseStoredState(value: string): AgentSessionState {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(value);
  } catch (error) {
    throw new Error('Stored session state is not valid JSON', { cause: error });
  }

  if (!isStoredState(parsedValue)) {
    throw new Error('Stored session state is malformed');
  }

  return parsedValue;
}

function isStoredState(value: unknown): value is AgentSessionState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const state = value as Partial<AgentSessionState>;

  return (
    typeof state.sessionId === 'string' &&
    typeof state.tenantId === 'string' &&
    typeof state.currentStep === 'number' &&
    typeof state.variables === 'object' &&
    state.variables !== null &&
    !Array.isArray(state.variables) &&
    Array.isArray(state.history) &&
    state.history.every(isChatMessage)
  );
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const message = value as Partial<ChatMessage>;

  return typeof message.role === 'string' && typeof message.content === 'string';
}
