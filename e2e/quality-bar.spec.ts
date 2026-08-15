import { test, expect } from "@playwright/test";

// SPEC.md §15 QUALITY-BAR: "Keyboard reachable; reduced-motion honoured;
// renders at 320px." This test locks in the 320px requirement specifically
// — caught and fixed for real during the M7 accessibility/QUALITY-BAR pass
// (fixtures/coverage/languages.json's table forced whole-page horizontal
// scroll at 320px until it was wrapped in its own overflow-x:auto
// container; /methodology's table got the same defensive wrap).

const ROUTES = ["/", "/coverage", "/limits", "/methodology", "/docs"];

test("@smoke renders at 320px with no horizontal page overflow, on every route", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });

  for (const route of ROUTES) {
    await page.goto(route);
    // Give the route a moment to settle (the home route's model auto-load
    // and sample-corpus preload can briefly reflow content) before
    // measuring — this test cares about the settled layout, not a
    // mid-load transient.
    await page.waitForTimeout(500);

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(
      scrollWidth,
      `${route}: page scrollWidth (${scrollWidth}px) exceeds viewport clientWidth (${clientWidth}px) at 320px — something is forcing whole-page horizontal scroll instead of scrolling inside its own container`
    ).toBeLessThanOrEqual(clientWidth);
  }
});
