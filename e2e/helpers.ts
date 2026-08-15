import { expect, type Page } from "@playwright/test";

/**
 * The hero preloads a 16-note sample corpus automatically once the
 * default model is ready (SPEC.md §7/§12, wired in M6). Most e2e tests
 * want a clean, empty session to exercise their own specific behaviour
 * against, so they call this right after waiting for the model to become
 * ready. Waits for all 16 samples to finish loading first — never
 * partial: clicking "Clear samples" while some are still in flight would
 * just have the remaining ones repopulate moments later, since the
 * preload's own loop keeps adding whatever it hasn't reached yet — then
 * clicks the clear action and waits for the note list to actually read
 * back empty before returning.
 */
export async function clearSampleCorpus(page: Page): Promise<void> {
  await expect(page.locator(".tag-sample")).toHaveCount(16, { timeout: 30_000 });
  await page.getByRole("button", { name: "Clear samples" }).click();
  await expect(page.locator(".tag-sample")).toHaveCount(0, { timeout: 10_000 });
}
