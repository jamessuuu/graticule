import { test, expect } from "@playwright/test";

// M1 gate: "a real embedding verified in a real browser Network tab" —
// this drives the actual product UI (not a mocked pipeline) in headless
// Chromium and inspects real network traffic for the model fetch.

test("@smoke loads the default model for real and embeds a note", async ({ page }) => {
  const modelRequests: { url: string; size: number }[] = [];
  page.on("response", async (response) => {
    const url = response.url();
    if (url.includes("huggingface.co") || url.includes("jsdelivr.net")) {
      const headers = response.headers();
      const size = Number(headers["content-length"] ?? 0);
      modelRequests.push({ url, size });
    }
  });

  const consoleErrors: string[] = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto("/");

  // Model auto-loads idly; wait for the real load to finish. Cold load
  // measured ~4.7-5.4s on this desktop (SPEC.md facts line + M1's own
  // measurement) — give it real headroom in CI-shaped environments.
  //
  // Scoped to role=status rather than a bare page.getByText(/model:
  // .*ready/): the plain text locator can resolve against a large
  // ancestor whose *aggregate* nested text also happens to satisfy the
  // pattern before the model is actually ready (confirmed empirically
  // while building M5 — it matched a container still reading "model:
  // loading…"), which races this wait and the network-evidence assertion
  // below against the wrong DOM state.
  await expect(page.getByRole("status").filter({ hasText: "ready (" })).toBeVisible({ timeout: 45_000 });

  // Real network evidence: the model + tokenizer were actually fetched
  // from the real CDN, not mocked.
  expect(modelRequests.length, "expected real requests to huggingface.co/jsdelivr.net").toBeGreaterThan(0);
  const totalBytes = modelRequests.reduce((sum, r) => sum + r.size, 0);
  // ~26.8MB default model + tokenizer + runtime per SPEC.md's facts line,
  // but content-length headers under real compression/transfer-encoding
  // variance don't always sum to the on-disk total — 1MB is still a
  // decisive floor that no mock or trivial response could produce.
  expect(totalBytes, `total downloaded bytes: ${totalBytes}`).toBeGreaterThan(1_000_000);

  // Drive the real UI: add a note, let the Worker chunk + embed it for
  // real, and confirm the result reflects genuine inference (a plausible
  // token count), not a placeholder.
  const textarea = page.getByLabel("Add a note");
  await textarea.fill(
    "The vendor confirmed the deadline. The invoice arrived a day late, which nobody had flagged in advance."
  );
  await page.getByRole("button", { name: "Add note" }).click();

  await expect(page.getByText(/chunk.*tokens/)).toBeVisible({ timeout: 15_000 });
  const chunkSummary = await page.getByText(/chunk.*tokens/).first().textContent();
  expect(chunkSummary).toMatch(/\d+ chunk/);
  expect(chunkSummary).toMatch(/\d+ tokens/);
  // A non-trivial, plausible token count (not 0, not a placeholder) —
  // the two sentences above are ~20 real words.
  const tokenMatch = chunkSummary?.match(/(\d+) tokens/);
  expect(Number(tokenMatch?.[1] ?? 0)).toBeGreaterThan(5);

  expect(consoleErrors, `console/page errors: ${consoleErrors.join("\n")}`).toEqual([]);
});
