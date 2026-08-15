import { test, expect } from "@playwright/test";

// M6 gate (SPEC.md §17): "Self-check gate green on the deployed site;
// badge stays at 0 through a full cycle, verified live." SPEC.md §16
// names the self-check precisely: "the deployed site loads its own
// sample corpus and completes paste→embed→map→search→cluster with zero
// console errors." "Paste" here is the hero's automatic sample-corpus
// preload (SPEC.md §12: "hero is the live map preloaded with the sample
// corpus") — nothing to manually paste, since that's the whole point of
// the hero.

test("@smoke self-check: sample corpus loads, paste->embed->map->search->cluster completes clean, network receipt stays flat", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto("/");
  const modelStatus = page.getByRole("status");
  await expect(modelStatus.filter({ hasText: "ready (" })).toBeVisible({ timeout: 45_000 });

  // "paste" (automatic): all 16 sample notes finish embedding. Counting
  // the "sample" tag rather than waiting on one note's text is a real
  // completion signal, not a guess at timing — 16 is the exact corpus
  // size SPEC.md §7 requires (clears every floor: percentile >=5,
  // cluster >=15, outlier >=3).
  await expect(page.locator(".tag-sample")).toHaveCount(16, { timeout: 30_000 });

  // "map": the live SVG reflects all 16 notes by its own accessible name
  // — not a separate claim from the note count above, the same number
  // read back from a different part of the UI.
  await expect(page.getByRole("img", { name: /Map of 16 notes/ })).toBeVisible();

  // Network Receipt: snapshot "since interactive" now, before doing
  // anything else, then again after the rest of the cycle — SPEC.md §8's
  // actual falsifiable claim is that this number does not move.
  const receiptBefore = await page.getByRole("status").filter({ hasText: "since the map became interactive" }).textContent();
  expect(receiptBefore, "expected the network receipt to already exist").toMatch(/\d+ since the map became interactive/);
  const sinceBefore = Number(receiptBefore!.match(/(\d+) since the map became interactive/)![1]);
  expect(sinceBefore, "expected zero network requests since the map became interactive, before the self-check cycle").toBe(0);

  // "search": a real query, ranked results (no visible score, per §5).
  // Scoped to the search section specifically — the clustering section
  // below also renders an <ol>, and both can legitimately contain the
  // same note text, so an unscoped <ol> locator would be ambiguous.
  const searchSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Search by meaning" }) });
  await searchSection.getByLabel("Find notes closest in meaning to").fill("running training");
  await searchSection.getByRole("button", { name: "Search" }).click();
  await expect(searchSection.getByText("Ranked by similarity in wording/meaning")).toBeVisible();
  await expect(searchSection.locator("ol")).toBeVisible({ timeout: 15_000 });
  await expect(searchSection.locator("ol li").first()).toBeVisible();

  // "cluster": n=16 clears the >=15 floor — real groups, not the
  // "add N more" placeholder state.
  await expect(page.getByText("Notes grouped by similar wording (automatic, not reviewed).")).toBeVisible();
  await expect(page.getByText(/Add \d+ more notes? to see automatic groups/)).not.toBeVisible();

  // Outlier — the deliberate singleton note this corpus was designed
  // around, verified as a real algorithmic result, not asserted by fiat.
  // Scoped to the one <p> carrying this exact, otherwise-unique phrase —
  // "Closest pairs" and "Groups" above can also legitimately mention the
  // Passport note's text, so a broader section-wide locator would be
  // ambiguous (the same overlapping-text lesson as the search section).
  const outlierParagraph = page.locator("p").filter({ hasText: "uses different wording than the rest" });
  await expect(outlierParagraph).toBeVisible();
  await expect(outlierParagraph).toContainText("Passport renewal appointment");

  // Network Receipt again: the whole search->cluster read above triggered
  // zero additional network activity.
  const receiptAfter = await page.getByRole("status").filter({ hasText: "since the map became interactive" }).textContent();
  const sinceAfter = Number(receiptAfter!.match(/(\d+) since the map became interactive/)![1]);
  expect(sinceAfter, "network receipt must stay at 0 through the full paste->embed->map->search->cluster cycle").toBe(0);

  expect(consoleErrors, `console/page errors: ${consoleErrors.join("\n")}`).toEqual([]);
});
