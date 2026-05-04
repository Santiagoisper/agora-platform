const ALLOWED_ROOM_TYPES = new Set([
  "debate",
  "brainstorm",
  "narrative",
  "marketplace",
  "research",
]);

const BANNED_TOPIC_PATTERNS = [
  /how to build (?:a )?bomb/i,
  /make (?:a )?weapon/i,
  /exploit (?:a )?minor/i,
  /self[- ]harm/i,
  /suicide/i,
  /ethnic cleansing/i,
  /credit card dump/i,
  /ransomware/i,
  /terror(?:ist|ism)/i,
];

const MIN_TOPIC_WORDS = 6;
const MAX_TOPIC_LENGTH = 900;
const MAX_TITLE_LENGTH = 120;

export type TopicValidationResult =
  | {
      ok: true;
      title: string;
      topic: string;
      type: string;
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

export function validateRoomDraft(input: {
  title: unknown;
  topic: unknown;
  type: unknown;
}): TopicValidationResult {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const topic = typeof input.topic === "string" ? input.topic.trim() : "";
  const type = typeof input.type === "string" ? input.type.trim() : "";

  if (!title || !topic || !type) {
    return { ok: false, error: "Missing required fields", reason: "missing_fields", riskScore: 100, warnings: [] };
  }

  if (!ALLOWED_ROOM_TYPES.has(type)) {
    return { ok: false, error: "Unsupported room type", reason: "invalid_room_type", riskScore: 100, warnings: [] };
  }

  if (title.length < 8 || title.length > MAX_TITLE_LENGTH) {
    return {
      ok: false,
      error: "Title must be between 8 and 120 characters",
      reason: "title_length_out_of_range",
      riskScore: 60,
      warnings: [],
    };
  }

  if (topic.length < 40 || topic.length > MAX_TOPIC_LENGTH) {
    return {
      ok: false,
      error: "Topic context must be between 40 and 900 characters",
      reason: "topic_length_out_of_range",
      riskScore: 70,
      warnings: [],
    };
  }

  const words = topic.split(/\s+/).filter(Boolean);
  if (words.length < MIN_TOPIC_WORDS) {
    return {
      ok: false,
      error: "Topic context must be specific enough for scoring",
      reason: "topic_too_short_for_evaluation",
      riskScore: 40,
      warnings: [],
    };
  }

  const warnings: string[] = [];
  let riskScore = 0;

  if (/(always|never|everyone|nobody)/i.test(topic)) {
    warnings.push("Topic includes absolutist language and may degrade evaluation quality.");
    riskScore += 10;
  }

  if (/(real money|betting|wager|usd)/i.test(topic)) {
    warnings.push("Topic references money/betting and will be flagged for referee review.");
    riskScore += 25;
  }

  for (const pattern of BANNED_TOPIC_PATTERNS) {
    if (pattern.test(`${title}\n${topic}`)) {
      return {
        ok: false,
        error: "Topic violates arena safety policy",
        reason: "policy_blocked_topic",
        riskScore: 100,
        warnings,
      };
    }
  }

  return { ok: true, title, topic, type, riskScore, warnings };
}
