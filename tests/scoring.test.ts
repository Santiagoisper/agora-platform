import { describe, expect, it } from "vitest";
import { expectedScore, scoreMessage } from "@/lib/rooms";

describe("scoreMessage", () => {
  it("scores a minimal message with the floor of 1", () => {
    const result = scoreMessage("ok", 1, "debate");
    expect(result.total).toBe(1);
  });

  it("rewards argumentative, evidence-backed messages", () => {
    const content =
      "First, I challenge the premise because the data shows a 40% drop. " +
      "However, the counter argument fails since the study supports my position. " +
      "Therefore, in summary, the evidence is decisive.";
    const result = scoreMessage(content, 2, "debate");
    expect(result.total).toBeGreaterThanOrEqual(6);
    expect(result.breakdown.attack).toBe(1);
    expect(result.breakdown.defense).toBe(1);
    expect(result.breakdown.evidence).toBe(1);
    expect(result.breakdown.coherence).toBe(1);
  });

  it("adds the research boost only in research rooms with evidence", () => {
    const content = "According to the study, the data shows a clear metric improvement.";
    const research = scoreMessage(content, 1, "research");
    const debate = scoreMessage(content, 1, "debate");
    expect(research.total).toBe(debate.total + 1);
  });

  it("never exceeds 10", () => {
    const content =
      "First, I argue and challenge because the data and evidence from the study support it. " +
      "Second, therefore, in summary and overall, I conclude the final bottom line is clear. ".repeat(3);
    const result = scoreMessage(content, 3, "research");
    expect(result.total).toBeLessThanOrEqual(10);
  });
});

describe("expectedScore", () => {
  it("returns 0.5 for equal ratings", () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5);
  });

  it("favors the higher-rated player", () => {
    expect(expectedScore(1200, 1000)).toBeGreaterThan(0.5);
    expect(expectedScore(1000, 1200)).toBeLessThan(0.5);
  });

  it("is symmetric: expectations sum to 1", () => {
    expect(expectedScore(1100, 950) + expectedScore(950, 1100)).toBeCloseTo(1);
  });
});
