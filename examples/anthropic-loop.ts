import {
  HarnessKitRuntime,
  RedisStateStore,
  type ChatMessage,
  type ExecutionContext,
} from '../src/index.js';

type AnthropicMessageRole = 'user' | 'assistant';

interface AnthropicCompatibleClient {
  messages: {
    create(input: {
      model: string;
      max_tokens: number;
      system?: string;
      messages: Array<{ role: AnthropicMessageRole; content: string }>;
    }): Promise<{
      content: Array<{ type: 'text'; text: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    }>;
  };
}

const mockAnthropicClient: AnthropicCompatibleClient = {
  messages: {
    async create() {
      return {
        content: [{ type: 'text', text: 'Vendor payout review completed safely.' }],
        usage: { input_tokens: 96, output_tokens: 54 },
      };
    },
  },
};

export async function runHarnessedAnthropicLoop(
  client: AnthropicCompatibleClient = mockAnthropicClient,
): Promise<{ output: string; tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
  const store = new RedisStateStore({
    redisUrl: process.env.REDIS_URL,
    ttlSeconds: 86400,
  });

  try {
    const runtime = await HarnessKitRuntime.createSession({
      configPath: './haas.config.yaml',
      userId: 'tenant_demo',
      sessionId: 'session_vendor_payout_demo',
      store,
    });

    runtime.on('onLimitBreached', ({ reason }) => {
      console.error(`HarnessKit stopped execution: ${reason}`);
    });

    return await runtime.runLoop(async (context: ExecutionContext) => {
      context.history.push(
        { role: 'system', content: 'You review vendor payouts for safety and policy compliance.' },
        { role: 'user', content: 'Review whether this vendor payout can be approved.' },
      );

      const response = await client.messages.create({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1024,
        system: findSystemPrompt(context.history),
        messages: toAnthropicMessages(context.history),
      });
      const output = response.content.find((block) => block.type === 'text')?.text ?? '';
      const inputTokens = response.usage?.input_tokens ?? 0;
      const outputTokens = response.usage?.output_tokens ?? 0;

      context.history.push({ role: 'assistant', content: output });

      return {
        output,
        tokenUsage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
      };
    });
  } finally {
    await store.close();
  }
}

function findSystemPrompt(history: ChatMessage[]): string | undefined {
  return history.find((message) => message.role === 'system')?.content;
}

function toAnthropicMessages(history: ChatMessage[]): Array<{ role: AnthropicMessageRole; content: string }> {
  return history.filter(isAnthropicMessage).map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function isAnthropicMessage(message: ChatMessage): message is ChatMessage & { role: AnthropicMessageRole } {
  return message.role === 'user' || message.role === 'assistant';
}
