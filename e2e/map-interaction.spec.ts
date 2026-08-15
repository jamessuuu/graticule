import { test, expect } from "@playwright/test";

// M2 gate: "map visibly redraws on edit" — drives the real add/edit/
// remove/dedupe flow against the real embedder and asserts the map's own
// marker count and per-note token counts change accordingly.

async function waitForModelReady(page: import("@playwright/test").Page) {
  await expect(page.getByText(/model: .*ready/)).toBeVisible({ timeout: 45_000 });
}

test.describe("@smoke note workbench + map", () => {
  test("add, duplicate-detect, edit, and remove all visibly affect the map", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(String(err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/");
    await waitForModelReady(page);

    const textarea = page.getByLabel("Add a note");
    const addButton = page.getByRole("button", { name: "Add note" });
    const mapMarkers = () => page.locator('svg[role="img"] [role="button"]');

    // Empty state first.
    await expect(page.getByText("Add a note to see the map.")).toBeVisible();

    // Add note 1.
    await textarea.fill("The vendor confirmed the deadline for next week.");
    await addButton.click();
    await expect(mapMarkers()).toHaveCount(1, { timeout: 10_000 });

    // Duplicate: should be refused with a toast, marker count unchanged.
    await textarea.fill("The vendor confirmed the deadline for next week.");
    await addButton.click();
    await expect(page.getByText(/already in this session/)).toBeVisible();
    await expect(mapMarkers()).toHaveCount(1);

    // Add note 2 (genuinely different) — map redraws to 2 markers, and
    // the variance-explained receipt updates to a real computed number.
    await textarea.fill("My favorite hiking trail closes for the winter next month.");
    await addButton.click();
    await expect(mapMarkers()).toHaveCount(2, { timeout: 10_000 });
    await expect(page.getByText(/These two axes capture \d+% of the variation\./)).toBeVisible();

    // Edit note 1: re-embedding changes its token count, proving a real
    // re-chunk/re-embed happened, not just a text-only UI update.
    //
    // Position-based, not `hasText`-filtered: once Edit mode swaps the
    // row's paragraph for a <textarea>, Playwright's `hasText` (which
    // checks textContent) stops matching a live-typed value, because
    // React updates a textarea's `.value` property directly rather than
    // its text-node children — the row's *rendered* text content never
    // reflects what .fill() just typed, so a text-filtered locator goes
    // stale mid-edit. Notes render in insertion order, so "first row" is
    // stably the vendor note throughout.
    const rows = page.locator("main ul > li");
    const firstRow = rows.nth(0);
    await expect(firstRow.getByText("The vendor confirmed the deadline for next week.")).toBeVisible();
    const beforeTokens = await firstRow.getByText(/\d+ tokens/).textContent();

    await firstRow.getByRole("button", { name: "Edit" }).click();
    await firstRow
      .getByRole("textbox")
      .fill("The vendor confirmed the deadline for next week, and also sent an updated invoice with new line items.");
    await firstRow.getByRole("button", { name: "Save" }).click();

    await expect(
      firstRow.getByText("The vendor confirmed the deadline for next week, and also sent an updated invoice with new line items.")
    ).toBeVisible({ timeout: 10_000 });
    const afterTokens = await firstRow.getByText(/\d+ tokens/).textContent();
    expect(afterTokens).not.toBe(beforeTokens);
    await expect(mapMarkers()).toHaveCount(2); // still 2 notes, edit doesn't add/remove

    // Remove note 2 (still second in insertion order) — map redraws back
    // to 1 marker.
    const secondRow = rows.nth(1);
    await secondRow.getByRole("button", { name: "Remove" }).click();
    await expect(mapMarkers()).toHaveCount(1, { timeout: 10_000 });

    expect(consoleErrors, `console/page errors: ${consoleErrors.join("\n")}`).toEqual([]);
  });
});
