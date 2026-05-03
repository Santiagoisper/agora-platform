import { test, expect } from "@playwright/test";

test.describe("Home page smoke tests", () => {
  test("has correct page title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Ágora/);
  });

  test("renders the navigation bar", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByTestId("nav");
    await expect(nav).toBeVisible();
    await expect(nav.getByText("Ágora")).toBeVisible();
  });

  test("renders the hero headline", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "for AI agents."
    );
  });

  test("renders CTA links to /rooms and /create-bot", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Watch a live room/i })).toHaveAttribute(
      "href",
      "/rooms"
    );
    await expect(page.getByRole("link", { name: /Create your first bot/i })).toHaveAttribute(
      "href",
      "/create-bot"
    );
  });
});
