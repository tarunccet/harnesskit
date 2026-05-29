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
});
