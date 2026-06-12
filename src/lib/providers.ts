const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type ProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "deepseek"
  | "xai"
  | "groq"
  | "mistral";

interface OpenAICompatibleConfig {
  baseUrl: string;
  modelMap: Record<string, string>;
}

const ANTHROPIC_MODEL_MAP: Record<string, string> = {
  "claude-haiku-4": "claude-3-5-haiku-20241022",
  "claude-sonnet-4": "claude-sonnet-4-20250514",
  "claude-opus-4": "claude-opus-4-20250514",
};

const OPENAI_COMPATIBLE: Record<string, OpenAICompatibleConfig> = {
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    modelMap: {
      "deepseek-v3": "deepseek-chat",
      "deepseek-r1": "deepseek-reasoner",
    },
  },
  xai: {
    baseUrl: "https://api.x.ai/v1",
    modelMap: {
      "grok-3": "grok-3",
      "grok-3-mini": "grok-3-mini",
    },
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    modelMap: {
      "llama-3.3-70b": "llama-3.3-70b-versatile",
      "llama-4-maverick": "meta-llama/llama-4-maverick-17b-128e-instruct",
    },
  },
  mistral: {
    baseUrl: "https://api.mistral.ai/v1",
    modelMap: {
      "mistral-large": "mistral-large-latest",
      "mistral-small": "mistral-small-latest",
    },
  },
};

export function inferProvider(model: string): ProviderId {
  if (model.startsWith("claude-")) return "anthropic";
  if (model.startsWith("gemini-")) return "google";
  if (model.startsWith("deepseek-")) return "deepseek";
  if (model.startsWith("grok-")) return "xai";
  if (model.startsWith("llama-")) return "groq";
  if (model.startsWith("mistral-")) return "mistral";
  return "openai";
}

// Empty array means the provider has no stable key prefix; skip the format check.
export function expectedKeyPrefixes(model: string): string[] {
  switch (inferProvider(model)) {
    case "anthropic":
      return ["sk-ant-"];
    case "google":
      return ["AIza"];
    case "xai":
      return ["xai-"];
    case "groq":
      return ["gsk_"];
    case "deepseek":
      return ["sk-"];
    case "mistral":
      return [];
    default:
      return ["sk-"];
  }
}

function extractOpenAIText(data: unknown) {
  if (!data || typeof data !== "object") return null;

  const output = (data as { output?: unknown[] }).output;
  if (!Array.isArray(output)) return null;

  const chunks: string[] = [];

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown[] }).content;
    if (!Array.isArray(content)) continue;

    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      if ((part as { type?: string }).type === "output_text") {
        const text = (part as { text?: string }).text;
        if (typeof text === "string" && text.trim()) {
          chunks.push(text.trim());
        }
      }
    }
  }

  return chunks.length > 0 ? chunks.join("\n\n") : null;
}

function extractAnthropicText(data: unknown) {
  if (!data || typeof data !== "object") return null;

  const content = (data as { content?: unknown[] }).content;
  if (!Array.isArray(content)) return null;

  const chunks = content
    .filter(
      (part): part is { type: string; text: string } =>
        !!part &&
        typeof part === "object" &&
        (part as { type?: string }).type === "text" &&
        typeof (part as { text?: string }).text === "string"
    )
    .map((part) => part.text.trim())
    .filter(Boolean);

  return chunks.length > 0 ? chunks.join("\n\n") : null;
}

function extractChatCompletionText(data: unknown) {
  if (!data || typeof data !== "object") return null;

  const choices = (data as { choices?: unknown[] }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const message = (choices[0] as { message?: { content?: unknown } }).message;
  const content = message?.content;

  return typeof content === "string" && content.trim() ? content.trim() : null;
}

function extractGeminiText(data: unknown) {
  if (!data || typeof data !== "object") return null;

  const candidates = (data as { candidates?: unknown[] }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const parts = (candidates[0] as { content?: { parts?: unknown[] } }).content?.parts;
  if (!Array.isArray(parts)) return null;

  const chunks = parts
    .map((part) => (part as { text?: unknown }).text)
    .filter((text): text is string => typeof text === "string" && !!text.trim())
    .map((text) => text.trim());

  return chunks.length > 0 ? chunks.join("\n\n") : null;
}

function extractErrorMessage(data: unknown, fallback: string) {
  const message = (data as { error?: { message?: unknown } } | null)?.error?.message;
  return typeof message === "string" ? message : fallback;
}

async function generateOpenAIMessage(model: string, apiKey: string, prompt: string) {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
      text: {
        format: {
          type: "text",
        },
      },
      max_output_tokens: 220,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "OpenAI request failed"));
  }

  const text = extractOpenAIText(data);
  if (!text) {
    throw new Error("OpenAI returned no text output");
  }

  return text;
}

async function generateAnthropicMessage(model: string, apiKey: string, prompt: string) {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL_MAP[model] ?? model,
      max_tokens: 220,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "Anthropic request failed"));
  }

  const text = extractAnthropicText(data);
  if (!text) {
    throw new Error("Anthropic returned no text output");
  }

  return text;
}

async function generateGeminiMessage(model: string, apiKey: string, prompt: string) {
  const response = await fetch(
    `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 220,
        },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "Gemini request failed"));
  }

  const text = extractGeminiText(data);
  if (!text) {
    throw new Error("Gemini returned no text output");
  }

  return text;
}

async function generateOpenAICompatibleMessage(
  provider: string,
  model: string,
  apiKey: string,
  prompt: string
) {
  const config = OPENAI_COMPATIBLE[provider];
  if (!config) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.modelMap[model] ?? model,
      max_tokens: 220,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, `${provider} request failed`));
  }

  const text = extractChatCompletionText(data);
  if (!text) {
    throw new Error(`${provider} returned no text output`);
  }

  return text;
}

export function resolveRuntimeModel(model: string) {
  const provider = inferProvider(model);

  if (provider === "anthropic") return ANTHROPIC_MODEL_MAP[model] ?? model;
  if (provider in OPENAI_COMPATIBLE) {
    return OPENAI_COMPATIBLE[provider].modelMap[model] ?? model;
  }

  return model;
}

export async function generateProviderMessage(model: string, apiKey: string, prompt: string) {
  const provider = inferProvider(model);

  switch (provider) {
    case "anthropic":
      return generateAnthropicMessage(model, apiKey, prompt);
    case "google":
      return generateGeminiMessage(model, apiKey, prompt);
    case "deepseek":
    case "xai":
    case "groq":
    case "mistral":
      return generateOpenAICompatibleMessage(provider, model, apiKey, prompt);
    default:
      return generateOpenAIMessage(model, apiKey, prompt);
  }
}
