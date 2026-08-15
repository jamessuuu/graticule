import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clearSampleCorpus } from "./helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// SPEC.md §14 Decision 8: "Because Node's execution provider can differ
// marginally from the browser's WASM path, a Playwright check confirms
// the same pairs recomputed live on the deployed site land within ±0.01
// cosine — an epsilon isomorphism check, since an undisclaimed
// byte-identical claim across backends would itself be dishonest."

test("@smoke isomorphism: /limits' live browser-computed cosines match the Node-pinned fixture within ±0.01", async ({
  page,
}) => {
  const fixture = JSON.parse(
    readFileSync(path.join(root, "fixtures/linguistic/negation-pairs.json"), "utf8")
  );
  const { contradiction, paraphrase } = fixture.input.defaultPair;
  const ISOMORPHISM_EPSILON = 0.01;

  await page.goto("/limits");

  // NegationDemo prints "cosine similarity, [model]: X.XXX" for each box,
  // in DOM order (Contradiction first, then Paraphrase) — see
  // limits-and-coverage.spec.ts for the same ordering assumption.
  const contradictionCosine = page.locator("text=/cosine similarity, .*: [0-9.]+/").first();
  const paraphraseCosine = page.locator("text=/cosine similarity, .*: [0-9.]+/").nth(1);
  await expect(contradictionCosine).toBeVisible({ timeout: 30_000 });
  await expect(paraphraseCosine).toBeVisible({ timeout: 30_000 });

  const contradictionText = await contradictionCosine.textContent();
  const paraphraseText = await paraphraseCosine.textContent();
  const liveContradiction = Number(contradictionText?.match(/: ([0-9.]+)/)?.[1]);
  const liveParaphrase = Number(paraphraseText?.match(/: ([0-9.]+)/)?.[1]);

  expect(Number.isFinite(liveContradiction), `could not parse a cosine number from "${contradictionText}"`).toBe(true);
  expect(Number.isFinite(liveParaphrase), `could not parse a cosine number from "${paraphraseText}"`).toBe(true);

  const contradictionDelta = Math.abs(liveContradiction - contradiction.cosine);
  const paraphraseDelta = Math.abs(liveParaphrase - paraphrase.cosine);

  expect(
    contradictionDelta,
    `contradiction pair: Node-pinned ${contradiction.cosine}, live browser ${liveContradiction}, delta ${contradictionDelta.toFixed(4)} exceeds ±${ISOMORPHISM_EPSILON}`
  ).toBeLessThanOrEqual(ISOMORPHISM_EPSILON);
  expect(
    paraphraseDelta,
    `paraphrase pair: Node-pinned ${paraphrase.cosine}, live browser ${liveParaphrase}, delta ${paraphraseDelta.toFixed(4)} exceeds ±${ISOMORPHISM_EPSILON}`
  ).toBeLessThanOrEqual(ISOMORPHISM_EPSILON);
});

// SPEC.md §16: "a network-tab e2e against the deployed site asserting
// zero requests carrying text content." §8: "For the claim to be false:
// any request whose URL, query string or body encodes a fragment of
// pasted text." Distinct from the Network Receipt's own e2e coverage
// (self-check-and-hero.spec.ts), which only counts requests — this test
// inspects what real requests actually CONTAIN.

test("@smoke network content: no request URL, query string, or body ever carries pasted text", async ({ page }) => {
  const DISTINCTIVE_MARKER = "zxqvth-graticule-network-content-canary-9f3d1";
  const pastedText = `A private note that must never leave this tab: ${DISTINCTIVE_MARKER} is the only reason this exact string exists anywhere.`;

  const offendingRequests: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes(DISTINCTIVE_MARKER)) offendingRequests.push(`URL: ${url}`);
    const postData = request.postData();
    if (postData && postData.includes(DISTINCTIVE_MARKER)) offendingRequests.push(`BODY (${request.method()} ${url}): ${postData.slice(0, 200)}`);
  });

  await page.goto("/");
  await expect(page.getByRole("status").filter({ hasText: "ready (" })).toBeVisible({ timeout: 45_000 });
  // A clean, empty session — otherwise the auto-loaded sample corpus
  // pushes note count past the clustering/percentile floors, and the
  // canary text can then legitimately appear inside multiple unrelated
  // <li> elements (pairwise-comparison rows, cluster members), making
  // locators below ambiguous for no reason relevant to what this test
  // actually checks (same lesson as e2e/helpers.ts's other callers).
  await clearSampleCorpus(page);

  const textarea = page.getByLabel("Add a note");
  await textarea.fill(pastedText);
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText(DISTINCTIVE_MARKER)).toBeVisible({ timeout: 15_000 });

  // Also search for it and edit it — every code path that touches typed
  // text, not just the initial add.
  const searchSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Search by meaning" }) });
  await searchSection.getByLabel("Find notes closest in meaning to").fill(DISTINCTIVE_MARKER);
  await searchSection.getByRole("button", { name: "Search" }).click();
  await expect(searchSection.getByText("Ranked by similarity in wording/meaning")).toBeVisible();

  const noteRow = page.locator("li").filter({ hasText: DISTINCTIVE_MARKER });
  await noteRow.getByRole("button", { name: "Edit" }).click();
  await noteRow.getByRole("textbox").fill(`${pastedText} (edited, still carries ${DISTINCTIVE_MARKER})`);
  await noteRow.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(`(edited, still carries ${DISTINCTIVE_MARKER})`)).toBeVisible({ timeout: 10_000 });

  expect(
    offendingRequests,
    `found ${offendingRequests.length} request(s) carrying the pasted-text canary — this is the exact condition SPEC.md §8 says falsifies the privacy claim:\n${offendingRequests.join("\n")}`
  ).toEqual([]);
});
