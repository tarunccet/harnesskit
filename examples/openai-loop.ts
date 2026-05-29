import { HarnessKitRuntime, RedisStateStore, type ExecutionContext } from 'harnesskit';

interface OpenAICompatibleClient {
  chat: {
    completions: {
      create(input: {
        model: string;
        messages: Array<{ role: string; content: string }>;
      }): Promise<{
        choices: Array<{ message: { content: string } }>;
        usage?: { total_tokens?: number };
      }>;
    };
  };
}

const mockOpenAIClient: OpenAICompatibleClient = {
  chat: {
    completions: {
      async create() {
        return {
          choices: [{ message: { content: 'Refund workflow completed safely.' } }],
          usage: { total_tokens: 128 },
        };
      },
    },
  },
};

export async function runHarnessedOpenAILoop(
  client: OpenAICompatibleClient = mockOpenAIClient,
): Promise<{ output: string; tokenUsage: { totalTokens: number } }> {
  const store = new RedisStateStore({
    redisUrl: process.env.REDIS_URL,
    ttlSeconds: 86400,
  });

  try {
    const runtime = await HarnessKitRuntime.createSession({
      configPath: './haas.config.yaml',
      userId: 'tenant_demo',
      sessionId: 'session_refund_demo',
      store,
    });

    runtime.on('onLimitBreached', ({ reason }) => {
      console.error(`HarnessKit stopped execution: ${reason}`);
    });

    return await runtime.runLoop(async (context: ExecutionContext) => {
      context.history.push({
        role: 'user',
        content: 'Check whether this customer refund can be approved.',
      });

      const completion = await client.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: context.history.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      });
      const output = completion.choices[0]?.message.content ?? '';

      context.history.push({ role: 'assistant', content: output });

      return {
        output,
        tokenUsage: {
          totalTokens: completion.usage?.total_tokens ?? 0,
        },
      };
    });
  } finally {
    await store.close();
  }
}
