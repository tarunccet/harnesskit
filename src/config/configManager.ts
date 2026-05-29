import * as fs from 'fs';

export interface HarnessKitConfig {
  version: string;
  agent_id: string;
  conversational: boolean;
  safety_guardrails: SafetyGuardrailsConfig;
  context_optimization: ContextOptimizationConfig;
  persistence: PersistenceConfig;
}

export interface SafetyGuardrailsConfig {
  max_consecutive_loops: number;
  max_session_cost_usd: number;
  blocked_keywords: string[];
}

export interface ContextOptimizationConfig {
  strategy: 'adaptive_compaction';
  trigger_threshold_tokens: number;
  preserve_system_prompt: boolean;
  preserve_first_n_messages: number;
  regex_only_summarization: boolean;
}

export interface PersistenceConfig {
  save_point: 'every_step';
  ttl_seconds: number;
}

type ParsedYaml = Record<string, unknown>;

const MALFORMED_CONFIG_ERROR = 'Invalid configuration: missing or malformed fields';

export class ConfigManager {
  static load(configPath: string): HarnessKitConfig {
    const yamlContents = fs.readFileSync(configPath, 'utf8');
    const parsedConfig = parseYamlSubset(yamlContents);

    return validateConfig(parsedConfig);
  }
}

function parseYamlSubset(contents: string): ParsedYaml {
  const root: ParsedYaml = {};
  let activeSection: ParsedYaml | null = null;

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = stripInlineComment(rawLine);

    if (line.trim() === '') {
      continue;
    }

    const indentation = countIndentation(line);
    const trimmed = line.trim();
    const separatorIndex = trimmed.indexOf(':');

    if (separatorIndex <= 0 || indentation % 2 !== 0) {
      throw new Error(MALFORMED_CONFIG_ERROR);
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(MALFORMED_CONFIG_ERROR);
    }

    if (indentation === 0) {
      if (rawValue === '') {
        const section: ParsedYaml = {};
        root[key] = section;
        activeSection = section;
      } else {
        root[key] = parseScalar(rawValue);
        activeSection = null;
      }

      continue;
    }

    if (indentation === 2 && activeSection !== null && rawValue !== '') {
      activeSection[key] = parseScalar(rawValue);
      continue;
    }

    throw new Error(MALFORMED_CONFIG_ERROR);
  }

  return root;
}

function stripInlineComment(line: string): string {
  let quotedBy: '"' | "'" | null = null;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const previousCharacter = index > 0 ? line[index - 1] : '';

    if ((character === '"' || character === "'") && previousCharacter !== '\\') {
      quotedBy = quotedBy === character ? null : quotedBy ?? character;
      continue;
    }

    if (character === '#' && quotedBy === null) {
      return line.slice(0, index).trimEnd();
    }
  }

  return line.trimEnd();
}

function countIndentation(line: string): number {
  return line.length - line.trimStart().length;
}

function parseScalar(value: string): unknown {
  if (isQuoted(value)) {
    return value.slice(1, -1);
  }

  if (value.startsWith('[') && value.endsWith(']')) {
    return parseInlineArray(value);
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return value;
}

function parseInlineArray(value: string): unknown[] {
  const innerValue = value.slice(1, -1).trim();

  if (innerValue === '') {
    return [];
  }

  return splitArrayItems(innerValue).map(parseScalar);
}

function splitArrayItems(value: string): string[] {
  const items: string[] = [];
  let quotedBy: '"' | "'" | null = null;
  let currentItem = '';

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const previousCharacter = index > 0 ? value[index - 1] : '';

    if ((character === '"' || character === "'") && previousCharacter !== '\\') {
      quotedBy = quotedBy === character ? null : quotedBy ?? character;
    }

    if (character === ',' && quotedBy === null) {
      items.push(parseArrayItem(currentItem));
      currentItem = '';
      continue;
    }

    currentItem += character;
  }

  if (quotedBy !== null) {
    throw new Error(MALFORMED_CONFIG_ERROR);
  }

  items.push(parseArrayItem(currentItem));

  return items;
}

function parseArrayItem(value: string): string {
  const item = value.trim();

  if (item === '') {
    throw new Error(MALFORMED_CONFIG_ERROR);
  }

  return item;
}

function isQuoted(value: string): boolean {
  return (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  );
}

function optionalBoolean(config: ParsedYaml, key: string, defaultValue: boolean): boolean {
  const value = config[key];
  if (value === undefined) return defaultValue;
  if (typeof value !== 'boolean') throw new Error(MALFORMED_CONFIG_ERROR);
  return value;
}

function optionalNonNegativeInteger(config: ParsedYaml, key: string, defaultValue: number, errorMessage: string): number {
  const value = config[key];
  if (value === undefined) return defaultValue;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(errorMessage);
  }
  return value;
}

function validateConfig(config: ParsedYaml): HarnessKitConfig {
  const safetyGuardrails = requireSection(config, 'safety_guardrails');
  const persistence = requireSection(config, 'persistence');

  const conversational = optionalBoolean(config, 'conversational', true);

  const contextOptimizationRaw = config['context_optimization'];
  if (conversational && !isPlainRecord(contextOptimizationRaw)) {
    throw new Error(MALFORMED_CONFIG_ERROR);
  }
  if (!conversational && contextOptimizationRaw !== undefined) {
    console.warn(
      '[HarnessKit] Warning: context_optimization is ignored when conversational is false',
    );
  }

  const contextOptimization: Record<string, unknown> = isPlainRecord(contextOptimizationRaw)
    ? contextOptimizationRaw
    : {};

  const validatedConfig: HarnessKitConfig = {
    version: requireString(config, 'version'),
    agent_id: requireString(config, 'agent_id'),
    conversational,
    safety_guardrails: {
      max_consecutive_loops: requireNumber(safetyGuardrails, 'max_consecutive_loops'),
      max_session_cost_usd: requireNumber(safetyGuardrails, 'max_session_cost_usd'),
      blocked_keywords: requireStringArray(safetyGuardrails, 'blocked_keywords'),
    },
    context_optimization: {
      strategy: conversational
        ? requireLiteral(
            contextOptimization,
            'strategy',
            'adaptive_compaction',
            'context_optimization.strategy must be adaptive_compaction',
          )
        : 'adaptive_compaction',
      trigger_threshold_tokens: conversational
        ? requireNumber(contextOptimization, 'trigger_threshold_tokens')
        : 0,
      preserve_system_prompt: conversational
        ? requireBoolean(contextOptimization, 'preserve_system_prompt')
        : false,
      preserve_first_n_messages: optionalNonNegativeInteger(
        contextOptimization,
        'preserve_first_n_messages',
        0,
        'preserve_first_n_messages must be a non-negative integer',
      ),
      regex_only_summarization: optionalBoolean(
        contextOptimization,
        'regex_only_summarization',
        false,
      ),
    },
    persistence: {
      save_point: requireLiteral(
        persistence,
        'save_point',
        'every_step',
        'persistence.save_point must be every_step',
      ),
      ttl_seconds: requireNumber(persistence, 'ttl_seconds'),
    },
  };

  assertPositiveInteger(
    validatedConfig.safety_guardrails.max_consecutive_loops,
    'max_consecutive_loops must be a positive integer',
  );
  assertPositiveNumber(
    validatedConfig.safety_guardrails.max_session_cost_usd,
    'max_session_cost_usd must be a positive number',
  );
  if (conversational) {
    assertPositiveInteger(
      validatedConfig.context_optimization.trigger_threshold_tokens,
      'trigger_threshold_tokens must be a positive integer',
    );
  }
  assertPositiveInteger(
    validatedConfig.persistence.ttl_seconds,
    'ttl_seconds must be a positive integer',
  );

  return validatedConfig;
}

function requireSection(config: ParsedYaml, key: string): ParsedYaml {
  const value = config[key];

  if (!isPlainRecord(value)) {
    throw new Error(MALFORMED_CONFIG_ERROR);
  }

  return value;
}

function requireString(config: ParsedYaml, key: string): string {
  const value = config[key];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(MALFORMED_CONFIG_ERROR);
  }

  return value;
}

function requireNumber(config: ParsedYaml, key: string): number {
  const value = config[key];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(MALFORMED_CONFIG_ERROR);
  }

  return value;
}

function requireBoolean(config: ParsedYaml, key: string): boolean {
  const value = config[key];

  if (typeof value !== 'boolean') {
    throw new Error(MALFORMED_CONFIG_ERROR);
  }

  return value;
}

function requireStringArray(config: ParsedYaml, key: string): string[] {
  const value = config[key];

  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(MALFORMED_CONFIG_ERROR);
  }

  return value;
}

function requireLiteral<TLiteral extends string>(
  config: ParsedYaml,
  key: string,
  expectedValue: TLiteral,
  errorMessage: string,
): TLiteral {
  const value = requireString(config, key);

  if (value !== expectedValue) {
    throw new Error(errorMessage);
  }

  return expectedValue;
}

function assertPositiveInteger(value: number, errorMessage: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(errorMessage);
  }
}

function assertPositiveNumber(value: number, errorMessage: string): void {
  if (value <= 0) {
    throw new Error(errorMessage);
  }
}

function isPlainRecord(value: unknown): value is ParsedYaml {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
