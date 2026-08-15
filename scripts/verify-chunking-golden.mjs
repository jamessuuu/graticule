#!/usr/bin/env node
/**
 * Chunking golden set (SPEC.md §16): ">=20 realistic cases (English/CJK/
 * Thai/RTL/mixed) with committed expected chunk counts and truncation
 * flags." Real local inference (Decision 8's $0-marginal-cost reasoning,
 * same as verify-fixtures.mjs) against the real shipped default-model
 * tokenizer — chunk counts and token counts here are measured facts, not
 * hand-guessed numbers (see fixtures/chunking-golden.json's own
 * description and per-case notes for how each was authored/sourced).
 *
 * Run: `tsx scripts/verify-chunking-golden.mjs` (needs tsx — see
 * verify-fixtures.mjs's header for why plain node can't import these).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chunkNote } from "../packages/core/src/index.ts";
import { createDefaultEmbedder } from "../packages/model/src/embedders.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const CHUNK_OPTS = { maxTokens: 80, maxSentences: 3, hardCeiling: 128 };

async function main() {
  const fixturePath = path.join(root, "fixtures/chunking-golden.json");
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

  assert(
    fixture.cases.length >= 20,
    `chunking golden set has only ${fixture.cases.length} cases — SPEC.md §16 requires >=20`
  );

  const scripts = new Set(fixture.cases.map((c) => c.script));
  const scriptFamilies = ["Latin (English)", "Chinese", "Thai", "Arabic", "Hebrew"];
  for (const family of scriptFamilies) {
    const covered = [...scripts].some((s) => s.includes(family));
    assert(covered, `chunking golden set is missing coverage for "${family}" — SPEC.md §16 names English/CJK/Thai/RTL/mixed explicitly`);
  }
  const hasMixed = [...scripts].some((s) => s.toLowerCase().includes("code-switch"));
  assert(hasMixed, `chunking golden set is missing a code-switching ("mixed") case`);

  console.log("verify-chunking-golden: loading the real default embedder (real network fetch or local cache)...");
  const embedder = createDefaultEmbedder();
  const t0 = Date.now();
  await embedder.load(() => {});
  console.log(`verify-chunking-golden: model ready in ${Date.now() - t0}ms (${await embedder.cacheStatus()})`);
  const countTokens = (t) => embedder.countTokens(t);

  let passed = 0;
  let failed = 0;

  for (const c of fixture.cases) {
    try {
      assert(c.expected.chunkCount !== null, `case "${c.id}" has no pinned expected values — run the measurement pass and commit real numbers`);
      assert(c.text.length > 0, `case "${c.id}" has empty text`);

      const totalTokens = countTokens(c.text);
      const chunks = chunkNote(c.text, { ...CHUNK_OPTS, countTokens, noteId: c.id });
      const truncatedChunkCount = chunks.filter((ch) => ch.truncated).length;

      assert(
        chunks.length === c.expected.chunkCount,
        `chunk count drifted: pinned ${c.expected.chunkCount}, measured ${chunks.length}`
      );
      assert(
        truncatedChunkCount === c.expected.truncatedChunkCount,
        `truncated chunk count drifted: pinned ${c.expected.truncatedChunkCount}, measured ${truncatedChunkCount}`
      );
      assert(
        totalTokens === c.expected.totalTokens,
        `total token count drifted: pinned ${c.expected.totalTokens}, measured ${totalTokens} (model/tokenizer version changed? re-measure per SPEC.md §9 "Version pins")`
      );

      // Every chunk's text reconstructs the original exactly, in order,
      // with no gaps/overlaps — the same partition-cleanly guarantee
      // verify-fixtures.mjs checks per fixture, checked here across the
      // whole golden set too.
      const reconstructed = chunks.map((ch) => ch.text).join("");
      assert(reconstructed === c.text, `chunks do not reconstruct "${c.id}" exactly`);

      console.log(`PASS  ${c.id}  chunks=${chunks.length} truncated=${truncatedChunkCount} tokens=${totalTokens}`);
      passed++;
    } catch (err) {
      console.error(`FAIL  ${c.id}  ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  console.log(`\nverify-chunking-golden: ${passed} passed, ${failed} failed (of ${fixture.cases.length}, floor >=20)`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("verify-chunking-golden: fatal error", err);
  process.exitCode = 1;
});
