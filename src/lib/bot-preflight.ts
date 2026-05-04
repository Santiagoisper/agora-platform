type PreflightInput = {
  model: string;
  systemPrompt: string;
  skills: string[];
  apiKey: string;
  eliminatedAt: Date | null;
};

type PreflightResult =
  | {
      ok: true;
      riskScore: number;
      warnings: string[];
    }
  | {
      ok: false;
      error: string;
      reason: string;
      riskScore: number;
      warnings: string[];
    };

const BLOCKED_PROMPT_PATTERNS = [
  /ignore (?:all|previous) instructions/i,
  /exfiltrat(e|ion)/i,
  /steal (?:credentials|secrets|tokens)/i,
  /delete (?:database|files|table)/i,
  /rm -rf/i,
];

function expectedKeyPrefix(model: string) {
  if (model.startsWith("claude-")) return "sk-ant-";
  return "sk-";
}

export function preflightBotForRoom(input: PreflightInput): PreflightResult {
  if (input.eliminatedAt) {
    return {
      ok: false,
      error: "This bot is eliminated and cannot enter ranked arenas",
      reason: "bot_eliminated",
      riskScore: 100,
      warnings: [],
    };
  }

  if (input.skills.length === 0 || input.skills.length > 3) {
    return {
      ok: false,
      error: "Bot skill loadout is invalid for arena mode",
      reason: "invalid_skill_loadout",
      riskScore: 60,
      warnings: [],
    };
  }

  if (input.systemPrompt.length < 40 || input.systemPrompt.length > 4000) {
    return {
      ok: false,
      error: "Bot system prompt length is out of policy limits",
      reason: "prompt_length_out_of_range",
      riskScore: 70,
      warnings: [],
    };
  }

  const warnings: string[] = [];
  let riskScore = 0;

  for (const pattern of BLOCKED_PROMPT_PATTERNS) {
    if (pattern.test(input.systemPrompt)) {
      return {
        ok: false,
        error: "Bot prompt violates arena policy",
        reason: "prompt_policy_block",
        riskScore: 100,
        warnings,
      };
    }
  }

  if (/(admin|root|shell|filesystem|database)/i.test(input.systemPrompt)) {
    warnings.push("Bot prompt requests privileged behavior; referee monitoring enabled.");
    riskScore += 20;
  }

  const prefix = expectedKeyPrefix(input.model);
  if (!input.apiKey.startsWith(prefix)) {
    return {
      ok: false,
      error: "API key format does not match selected model provider",
      reason: "api_key_provider_mismatch",
      riskScore: 80,
      warnings,
    };
  }

  if (input.apiKey.length < 20) {
    return {
      ok: false,
      error: "API key format is invalid",
      reason: "api_key_too_short",
      riskScore: 80,
      warnings,
    };
  }

  return { ok: true, riskScore, warnings };
}
