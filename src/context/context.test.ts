import { describe, it, expect, vi } from 'vitest';
import { ContextCompactor } from './contextCompactor';
import { ChatMessage } from '../types';

describe('Phase 3: Adaptive Context Compaction Engine Tests', () => {
  
  it('should pass history through untouched if it stays below the token threshold', async () => {
    const freshHistory: ChatMessage[] = [
      { role: 'system', content: 'You are a supportive tech helper.' },
      { role: 'user', content: 'Hello!' },
      { role: 'assistant', content: 'How can I assist you today?' }
    ];

    // Trigger threshold set artificially high at 4000 tokens
    const result = await ContextCompactor.optimize(freshHistory, {
      triggerThresholdTokens: 4000,
      preserveSystemPrompt: true
    });

    expect(result).toHaveLength(3);
    expect(result[0].role).toBe('system');
    expect(result[1].content).toBe('Hello!');
  });

  it('should isolate system prompt and compress mid-tier turns when exceeding thresholds', async () => {
    // Creating a simulated heavy conversational array
    const heavyHistory: ChatMessage[] = [
      { role: 'system', content: 'SYSTEM_PROMPT: CORE_LOGIC_DO_NOT_ERASE' },
      { role: 'user', content: 'Loop step 1: Query inventory database.' },
      { role: 'assistant', content: 'Tool execution logs: Found 12 units in stock.' },
      { role: 'user', content: 'Loop step 2: Check current shipping carrier grid price.' },
      { role: 'assistant', content: 'Tool execution logs: FedEx route estimated at $14.20.' },
      { role: 'user', content: 'Loop step 3: Apply coupon code discount.' },
      { role: 'assistant', content: 'Error response: Coupon code expired.' }
    ];

    // Trigger target set artificially low at 5 tokens to force immediate compaction
    const optimizedResult = await ContextCompactor.optimize(heavyHistory, {
      triggerThresholdTokens: 5,
      preserveSystemPrompt: true
    });

    // The result should be tightly condensed:
    // 1. System Prompt preserved at index 0
    // 2. Condensed Markdown summary card at index 1
    // 3. The final user query/turn preserved at the end
    expect(optimizedResult.length).toBeLessThan(heavyHistory.length);
    expect(optimizedResult[0].content).toContain('SYSTEM_PROMPT: CORE_LOGIC_DO_NOT_ERASE');
    expect(optimizedResult[1].role).toBe('system'); // Injected summary role block
    expect(optimizedResult[1].content).toContain('### Historical Execution Summary');
  });

  it('should preserve first N messages verbatim alongside the summary when preserveFirstNMessages is set', async () => {
    const history: ChatMessage[] = [
      { role: 'system', content: 'You are a compliance reviewer.' },
      { role: 'user', content: 'Initial goal: review vendor payout.' },
      { role: 'assistant', content: 'Step 1 complete.' },
      { role: 'user', content: 'Step 2: check fraud flags.' },
      { role: 'assistant', content: 'Step 2 complete.' },
      { role: 'user', content: 'Final step.' },
    ];

    const result = await ContextCompactor.optimize(history, {
      triggerThresholdTokens: 5,
      preserveSystemPrompt: true,
      preserveFirstNMessages: 1,
    });

    // system prompt at index 0
    expect(result[0].content).toBe('You are a compliance reviewer.');
    // first preserved message at index 1
    expect(result[1].content).toBe('Initial goal: review vendor payout.');
    // summary blob should follow
    const summaryMessage = result.find((m) => m.content.includes('### Historical Execution Summary'));
    expect(summaryMessage).toBeDefined();
  });

  it('should use regex summarization when regexOnlySummarization is true even if summarizer is provided', async () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'step one very long message that definitely exceeds threshold' },
      { role: 'assistant', content: 'step two very long response that also exceeds threshold' },
      { role: 'user', content: 'final step' },
    ];

    const fakeSummarizer = vi.fn(async () => 'LLM SUMMARY');

    const result = await ContextCompactor.optimize(history, {
      triggerThresholdTokens: 5,
      preserveSystemPrompt: false,
      regexOnlySummarization: true,
      summarizer: fakeSummarizer,
    });

    expect(fakeSummarizer).not.toHaveBeenCalled();
    const summaryMessage = result.find((m) => m.content.includes('### Historical Execution Summary'));
    expect(summaryMessage).toBeDefined();
  });

  it('should call the summarizer callback and use its return value when provided and regexOnlySummarization is false', async () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'step one very long message that definitely exceeds threshold' },
      { role: 'assistant', content: 'step two very long response that also exceeds threshold' },
      { role: 'user', content: 'final step' },
    ];

    const fakeSummarizer = vi.fn(async (_messages: ChatMessage[]) => 'CUSTOM LLM SUMMARY');

    const result = await ContextCompactor.optimize(history, {
      triggerThresholdTokens: 5,
      preserveSystemPrompt: false,
      regexOnlySummarization: false,
      summarizer: fakeSummarizer,
    });

    expect(fakeSummarizer).toHaveBeenCalledOnce();
    const summaryMessage = result.find((m) => m.content === 'CUSTOM LLM SUMMARY');
    expect(summaryMessage).toBeDefined();
  });
});
