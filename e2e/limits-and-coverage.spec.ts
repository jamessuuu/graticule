import { test, expect } from "@playwright/test";

test("@smoke /limits shows real, editable, live-recomputed cosine numbers", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto("/limits");

  // Both raw numbers become visible — the one deliberate exception to
  // "never a bare cosine" (SPEC.md Decision 6).
  const contradictionCosine = page.locator("text=/cosine similarity, .*: [0-9.]+/").first();
  const paraphraseCosine = page.locator("text=/cosine similarity, .*: [0-9.]+/").nth(1);
  await expect(contradictionCosine).toBeVisible({ timeout: 30_000 });
  await expect(paraphraseCosine).toBeVisible({ timeout: 30_000 });

  const beforeText = await contradictionCosine.textContent();

  // Edit the contradiction pair's Text B — the number must actually
  // recompute from real inference, not just redisplay the old value.
  const textboxes = page.getByRole("textbox");
  await textboxes.nth(1).fill("A wildly different, totally unrelated sentence about mountain goats.");
  await page.waitForTimeout(600); // clear the 300ms debounce plus real inference time

  await expect(async () => {
    const afterText = await contradictionCosine.textContent();
    expect(afterText).not.toBe(beforeText);
  }).toPass({ timeout: 10_000 });

  expect(consoleErrors, `console/page errors: ${consoleErrors.join("\n")}`).toEqual([]);
});

test("@smoke /coverage renders a real, generated language table", async ({ page }) => {
  await page.goto("/coverage");

  // Row-scoped via the exact-match language cell, not a substring
  // `hasText` filter on the whole row — Filipino's own hedge note
  // mentions "the default English-only model," which would otherwise
  // make an "English" substring filter match both rows.
  const englishRow = page.locator("tr").filter({ has: page.getByRole("cell", { name: "English", exact: true }) });
  await expect(englishRow.getByText("verified", { exact: true })).toBeVisible();

  const filipinoRow = page.locator("tr").filter({ has: page.getByRole("cell", { name: "Filipino / Tagalog", exact: true }) });
  await expect(filipinoRow).toBeVisible();
  await expect(filipinoRow.getByText("verified", { exact: true })).toBeVisible();

  // Permitted-statement copy is generated, not hand-typed — it must cite
  // a real count matching the actual table. The statement counts only
  // the model's tuned-language list; the table has one extra row for the
  // Filipino/Tagalog special case (SPEC.md §10 carve-out), hence -1.
  const rowCount = await page.locator("tbody tr").count();
  await expect(page.getByText(new RegExp(`Tuned for roughly ${rowCount - 1} languages`))).toBeVisible();
});
