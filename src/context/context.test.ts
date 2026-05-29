import { describe, it, expect } from 'vitest';
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
});
