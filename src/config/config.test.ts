import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigManager } from './configManager';
import * as fs from 'fs';

vi.mock('fs');

describe('Phase 1: Configuration Engine Validation Tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should successfully parse a valid haas.config.yaml file', () => {
    const validYaml = `
version: "1.0"
agent_id: "test-agent-01"
safety_guardrails:
  max_consecutive_loops: 5
  max_session_cost_usd: 1.50
  blocked_keywords: ["internal_error"]
context_optimization:
  strategy: "adaptive_compaction"
  trigger_threshold_tokens: 4000
  preserve_system_prompt: true
persistence:
  save_point: "every_step"
  ttl_seconds: 86400
    `;

    vi.spyOn(fs, 'readFileSync').mockReturnValue(validYaml);

    const config = ConfigManager.load('./haas.config.yaml');
    
    expect(config.version).toBe("1.0");
    expect(config.agent_id).toBe("test-agent-01");
    expect(config.safety_guardrails.max_consecutive_loops).toBe(5);
    expect(config.safety_guardrails.max_session_cost_usd).toBe(1.50);
  });

  it('should throw an explicit error if required keys are missing', () => {
    const brokenYaml = `
version: "1.0"
agent_id: "broken-agent"
# missing safety_guardrails completely
    `;

    vi.spyOn(fs, 'readFileSync').mockReturnValue(brokenYaml);

    expect(() => {
      ConfigManager.load('./haas.config.yaml');
    }).toThrow(/Invalid configuration: missing or malformed fields/);
  });

  it('should throw an error if safety bounds are mathematically invalid', () => {
    const invalidBoundsYaml = `
version: "1.0"
agent_id: "invalid-bounds-agent"
safety_guardrails:
  max_consecutive_loops: -1  # 🛑 Cannot be negative
  max_session_cost_usd: 1.50
  blocked_keywords: []
context_optimization:
  strategy: "adaptive_compaction"
  trigger_threshold_tokens: 4000
  preserve_system_prompt: true
persistence:
  save_point: "every_step"
  ttl_seconds: 86400
    `;

    vi.spyOn(fs, 'readFileSync').mockReturnValue(invalidBoundsYaml);

    expect(() => {
      ConfigManager.load('./haas.config.yaml');
    }).toThrow(/max_consecutive_loops must be a positive integer/);
  });

  it('should parse preserve_first_n_messages when provided', () => {
    const yaml = `
version: "1.0"
agent_id: "test-agent"
safety_guardrails:
  max_consecutive_loops: 5
  max_session_cost_usd: 1.50
  blocked_keywords: []
context_optimization:
  strategy: "adaptive_compaction"
  trigger_threshold_tokens: 4000
  preserve_system_prompt: true
  preserve_first_n_messages: 3
  regex_only_summarization: false
persistence:
  save_point: "every_step"
  ttl_seconds: 86400
  `;
    vi.spyOn(fs, 'readFileSync').mockReturnValue(yaml);
    const config = ConfigManager.load('./haas.config.yaml');
    expect(config.context_optimization.preserve_first_n_messages).toBe(3);
    expect(config.context_optimization.regex_only_summarization).toBe(false);
  });

  it('should default preserve_first_n_messages to 0 and regex_only_summarization to false when omitted', () => {
    const yaml = `
version: "1.0"
agent_id: "test-agent"
safety_guardrails:
  max_consecutive_loops: 5
  max_session_cost_usd: 1.50
  blocked_keywords: []
context_optimization:
  strategy: "adaptive_compaction"
  trigger_threshold_tokens: 4000
  preserve_system_prompt: true
persistence:
  save_point: "every_step"
  ttl_seconds: 86400
  `;
    vi.spyOn(fs, 'readFileSync').mockReturnValue(yaml);
    const config = ConfigManager.load('./haas.config.yaml');
    expect(config.context_optimization.preserve_first_n_messages).toBe(0);
    expect(config.context_optimization.regex_only_summarization).toBe(false);
  });

  it('should parse conversational: false and default conversational to true when omitted', () => {
    const yamlWithFalse = `
version: "1.0"
agent_id: "test-agent"
conversational: false
safety_guardrails:
  max_consecutive_loops: 5
  max_session_cost_usd: 1.50
  blocked_keywords: []
context_optimization:
  strategy: "adaptive_compaction"
  trigger_threshold_tokens: 4000
  preserve_system_prompt: true
persistence:
  save_point: "every_step"
  ttl_seconds: 86400
  `;
    vi.spyOn(fs, 'readFileSync').mockReturnValue(yamlWithFalse);
    const config = ConfigManager.load('./haas.config.yaml');
    expect(config.conversational).toBe(false);

    const yamlWithoutField = `
version: "1.0"
agent_id: "test-agent"
safety_guardrails:
  max_consecutive_loops: 5
  max_session_cost_usd: 1.50
  blocked_keywords: []
context_optimization:
  strategy: "adaptive_compaction"
  trigger_threshold_tokens: 4000
  preserve_system_prompt: true
persistence:
  save_point: "every_step"
  ttl_seconds: 86400
  `;
    vi.resetAllMocks();
    vi.spyOn(fs, 'readFileSync').mockReturnValue(yamlWithoutField);
    const config2 = ConfigManager.load('./haas.config.yaml');
    expect(config2.conversational).toBe(true);
  });

  it('should throw when preserve_first_n_messages is negative', () => {
    const yaml = `
version: "1.0"
agent_id: "test-agent"
safety_guardrails:
  max_consecutive_loops: 5
  max_session_cost_usd: 1.50
  blocked_keywords: []
context_optimization:
  strategy: "adaptive_compaction"
  trigger_threshold_tokens: 4000
  preserve_system_prompt: true
  preserve_first_n_messages: -1
persistence:
  save_point: "every_step"
  ttl_seconds: 86400
  `;
    vi.spyOn(fs, 'readFileSync').mockReturnValue(yaml);
    expect(() => ConfigManager.load('./haas.config.yaml')).toThrow(
      /preserve_first_n_messages must be a non-negative integer/,
    );
  });
});
