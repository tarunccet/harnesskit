import type { ChatMessage } from '../types.js';
import type { SummarizerFn } from '../types.js';

export interface ContextCompactionOptions {
  triggerThresholdTokens: number;
  preserveSystemPrompt: boolean;
  keepRecentMessages?: number;
  preserveFirstNMessages?: number;
  regexOnlySummarization?: boolean;
  summarizer?: SummarizerFn;
}

const DEFAULT_RECENT_MESSAGE_COUNT = 1;

export class ContextCompactor {
  static async optimize(history: ChatMessage[], options: ContextCompactionOptions): Promise<ChatMessage[]> {
    const activeTokenCount = estimateHistoryTokens(history);

    if (activeTokenCount <= options.triggerThresholdTokens) {
      return history;
    }

    const systemPromptIndex = options.preserveSystemPrompt
      ? history.findIndex((message) => message.role === 'system')
      : -1;
    const systemPrompt = systemPromptIndex >= 0 ? history[systemPromptIndex] : null;
    const historyWithoutSystemPrompt = history.filter((_, index) => index !== systemPromptIndex);

    const preserveFirstN = Math.max(0, options.preserveFirstNMessages ?? 0);
    const firstNMessages = historyWithoutSystemPrompt.slice(0, preserveFirstN);
    const remainingAfterFirstN = historyWithoutSystemPrompt.slice(preserveFirstN);

    const recentMessageCount = Math.max(1, options.keepRecentMessages ?? DEFAULT_RECENT_MESSAGE_COUNT);
    const recentMessages = remainingAfterFirstN.slice(-recentMessageCount);
    const messagesToSummarize = remainingAfterFirstN.slice(0, -recentMessageCount);

    const compactedHistory: ChatMessage[] = [];

    if (systemPrompt !== null) {
      compactedHistory.push(systemPrompt);
    }

    // Deduplicate: remove from firstNMessages any that overlap with recentMessages
    const recentContents = new Set(recentMessages.map((m) => m.role + ':' + m.content));
    const dedupedFirstN = firstNMessages.filter((m) => !recentContents.has(m.role + ':' + m.content));
    compactedHistory.push(...dedupedFirstN);

    if (messagesToSummarize.length > 0) {
      const useRegex = options.regexOnlySummarization === true || options.summarizer === undefined;
      const summaryContent = useRegex
        ? buildHistoricalSummary(messagesToSummarize)
        : await options.summarizer!(messagesToSummarize);

      compactedHistory.push({
        role: 'system',
        content: summaryContent,
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
