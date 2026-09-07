import { test, expect } from "@playwright/test";
import { clearSampleCorpus } from "./helpers";

// M3 gate coverage: search returns an ordered list with no visible score,
// the pairwise-percentile/outlier floors show the right "add N more"
// state below threshold and real content above it.

async function addNote(page: import("@playwright/test").Page, text: string) {
  const textarea = page.getByLabel("Add a note");
  // Wait for the previous submission's setDraft("") to actually land
  // before typing the next note — otherwise a fill() that races a
  // pending React state update can silently not stick (observed: the
  // textarea stayed empty afterward, button stayed disabled).
  await expect(textarea).toHaveValue("", { timeout: 10_000 });
  await textarea.fill(text);
  await expect(textarea).toHaveValue(text); // confirm the fill actually took effect
  await page.getByRole("button", { name: "Add note" }).click();
  // Scoped to the note list. An unscoped getByText also matched the analysis
  // panel, which quotes a note's text back in the outlier line, so once three
  // notes were in the session the same string appeared twice and Playwright's
  // strict mode failed the assertion. It passed before only because the
  // analysis panel happened to re-render after this check; that was a race,
  // not a guarantee, and it lost as soon as the page got shorter.
  await expect(page.locator("main ul > li").getByText(text, { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });
}

test("@smoke search, pairwise percentile, and outlier floors behave correctly", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto("/");
  // role=status scoped — see real-inference.spec.ts's comment on this
  // exact locator for why a bare getByText(/model: .*ready/) is fragile.
  await expect(page.getByRole("status").filter({ hasText: "ready (" })).toBeVisible({ timeout: 45_000 });
  await clearSampleCorpus(page);

  // Below every floor: all three sections show their "add N more" state,
  // never a silently empty section (SPEC.md §13).
  await expect(page.getByText("Add 5 more notes to see pairwise comparisons.")).toBeVisible();
  await expect(page.getByText("Add 15 more notes to see automatic groups.")).toBeVisible();
  await expect(page.getByText("Add 3 more notes to see outlier detection.")).toBeVisible();

  const notes = [
    "The vendor confirmed the deadline for next week.",
    "The invoice arrived a day late this month.",
    "My favorite hiking trail closes for the winter.",
    "The new laptop takes forever to boot up.",
    "A cold front is moving in, temperatures will drop tonight.",
  ];
  for (const n of notes) await addNote(page, n);

  // Outlier floor (n>=3) clears first — real content, not a floor message.
  await expect(page.getByText("Add 3 more notes to see outlier detection.")).toHaveCount(0);
  await expect(page.getByText("uses different wording than the rest")).toBeVisible();

  // Percentile floor (n>=5, 10 pairs) clears at exactly 5 notes.
  await expect(page.getByText("Add 5 more notes to see pairwise comparisons.")).toHaveCount(0);
  await expect(page.getByText(/more similar than \d+% of the other pairs you pasted\./).first()).toBeVisible();

  // Clustering floor (n>=15) has NOT cleared yet at 5 notes.
  await expect(page.getByText("Add 10 more notes to see automatic groups.")).toBeVisible();

  // Search: an ordered list, explicitly no numeric score rendered anywhere
  // in a result row (Decision 5 — never a bare cosine).
  await page.getByLabel("Find notes closest in meaning to").fill("Is the shipment on schedule?");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const resultsList = page.locator("ol li");
  await expect(resultsList.first()).toBeVisible({ timeout: 15_000 });
  const resultCount = await resultsList.count();
  expect(resultCount).toBe(notes.length);
  for (let i = 0; i < resultCount; i++) {
    const text = await resultsList.nth(i).textContent();
    expect(text).not.toMatch(/0\.\d{2,}/); // no bare decimal cosine-shaped number
  }

  expect(consoleErrors, `console/page errors: ${consoleErrors.join("\n")}`).toEqual([]);
});
