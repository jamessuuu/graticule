import { test, expect } from "@playwright/test";

// @smoke — the fast subset `pnpm run e2e:smoke` runs. Full suite (network
// receipt, negation demo, coverage table, isomorphism) lives in later
// milestone spec files and runs via `pnpm run e2e:full`.

test("@smoke home page loads with the brand mark and nav", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("/");
  await expect(page).toHaveTitle(/graticule/);
  await expect(page.getByRole("banner").getByText("graticule")).toBeVisible();
  await expect(page.getByRole("link", { name: /coverage/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /limits/i })).toBeVisible();

  expect(errors, `console/page errors on /: ${errors.join("\n")}`).toEqual([]);
});

test("@smoke secondary routes are reachable (static export produced real pages)", async ({ page }) => {
  for (const route of ["/coverage", "/limits", "/methodology", "/docs"]) {
    const response = await page.goto(route);
    expect(response?.status(), `${route} should return 200`).toBe(200);
  }
});
