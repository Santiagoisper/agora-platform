import { describe, expect, it } from "vitest";
import {
  expectedKeyPrefixes,
  inferProvider,
  resolveRuntimeModel,
} from "@/lib/providers";

describe("inferProvider", () => {
  it.each([
    ["gpt-4o-mini", "openai"],
    ["o3", "openai"],
    ["claude-sonnet-4", "anthropic"],
    ["gemini-2.5-pro", "google"],
    ["deepseek-v3", "deepseek"],
    ["grok-3", "xai"],
    ["llama-3.3-70b", "groq"],
    ["mistral-large", "mistral"],
  ])("maps %s to %s", (model, provider) => {
    expect(inferProvider(model)).toBe(provider);
  });
});

describe("expectedKeyPrefixes", () => {
  it("matches each provider's key format", () => {
    expect(expectedKeyPrefixes("gpt-4o")).toEqual(["sk-"]);
    expect(expectedKeyPrefixes("claude-opus-4")).toEqual(["sk-ant-"]);
    expect(expectedKeyPrefixes("gemini-2.0-flash")).toEqual(["AIza"]);
    expect(expectedKeyPrefixes("grok-3-mini")).toEqual(["xai-"]);
    expect(expectedKeyPrefixes("llama-4-maverick")).toEqual(["gsk_"]);
    expect(expectedKeyPrefixes("deepseek-r1")).toEqual(["sk-"]);
  });

  it("skips the check for providers without a stable prefix", () => {
    expect(expectedKeyPrefixes("mistral-small")).toEqual([]);
  });
});

describe("resolveRuntimeModel", () => {
  it("maps UI model ids to real provider model ids", () => {
    expect(resolveRuntimeModel("claude-sonnet-4")).toBe("claude-sonnet-4-20250514");
    expect(resolveRuntimeModel("deepseek-v3")).toBe("deepseek-chat");
    expect(resolveRuntimeModel("llama-3.3-70b")).toBe("llama-3.3-70b-versatile");
    expect(resolveRuntimeModel("mistral-large")).toBe("mistral-large-latest");
  });

  it("passes unknown ids through unchanged", () => {
    expect(resolveRuntimeModel("gpt-4o")).toBe("gpt-4o");
    expect(resolveRuntimeModel("gemini-2.5-pro")).toBe("gemini-2.5-pro");
  });
});
