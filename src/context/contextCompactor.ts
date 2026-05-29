import type { ChatMessage } from '../types.js';

export interface ContextCompactionOptions {
  triggerThresholdTokens: number;
  preserveSystemPrompt: boolean;
  keepRecentMessages?: number;
}

const DEFAULT_RECENT_MESSAGE_COUNT = 1;

export class ContextCompactor {
  static optimize(history: ChatMessage[], options: ContextCompactionOptions): ChatMessage[] {
    const activeTokenCount = estimateHistoryTokens(history);

    if (activeTokenCount <= options.triggerThresholdTokens) {
      return history;
    }

    const systemPromptIndex = options.preserveSystemPrompt
      ? history.findIndex((message) => message.role === 'system')
      : -1;
    const systemPrompt = systemPromptIndex >= 0 ? history[systemPromptIndex] : null;
    const historyWithoutSystemPrompt = history.filter((_, index) => index !== systemPromptIndex);
    const recentMessageCount = Math.max(1, options.keepRecentMessages ?? DEFAULT_RECENT_MESSAGE_COUNT);
    const recentMessages = historyWithoutSystemPrompt.slice(-recentMessageCount);
    const messagesToSummarize = historyWithoutSystemPrompt.slice(0, -recentMessageCount);
    const compactedHistory: ChatMessage[] = [];

    if (systemPrompt !== null) {
      compactedHistory.push(systemPrompt);
    }

    if (messagesToSummarize.length > 0) {
      compactedHistory.push({
        role: 'system',
        content: buildHistoricalSummary(messagesToSummarize),
      });
    }

    compactedHistory.push(...recentMessages);

    return compactedHistory;
  }

  static estimateTokens(content: string): number {
    return estimateTextTokens(content);
  }
}

function estimateHistoryTokens(history: ChatMessage[]): number {
  return history.reduce((totalTokens, message) => {
    return totalTokens + estimateTextTokens(message.role) + estimateTextTokens(message.content);
  }, 0);
}

function estimateTextTokens(content: string): number {
  return content.match(/[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu)?.length ?? 0;
}

function buildHistoricalSummary(messages: ChatMessage[]): string {
  const summaryLines = messages.map((message, index) => {
    return `${index + 1}. **${message.role}:** ${message.content}`;
  });

  return ['### Historical Execution Summary', ...summaryLines].join('\n');
}
