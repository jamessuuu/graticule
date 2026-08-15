#!/usr/bin/env node
/**
 * Runs the fixture suite (SPEC.md §14) against REAL local inference — the
 * actual default model, actual tokenizer, in Node (onnxruntime-node),
 * $0 marginal cost (Decision 8). Not a snapshot, not a mock.
 *
 * Fixtures are added milestone by milestone (M1: grapheme-integrity,
 * cjk-no-ascii-punctuation, thai-no-space; M2: nfc-nfd-pair,
 * truncation-boundary; M3: min-cluster-n, pca-instability-on-edit; M4:
 * negation-pairs, code-switch-taglish). A fixture JSON that doesn't exist
 * yet is reported SKIP, not FAIL, so `pnpm run ci` stays green on an
 * in-progress milestone; a fixture JSON that exists with no verifier
 * wired up is an authoring error and fails loudly.
 *
 * Run: `tsx scripts/verify-fixtures.mjs` (needs tsx, not plain node, so
 * `.js`-specifier imports inside packages/core and packages/model resolve
 * to their sibling `.ts` sources).
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  centroid,
  chunkNote,
  clusterNotes,
  cosineSimilarity,
  fitProjectionToViewport,
  isDuplicateText,
  project,
  projectOnto,
  projectToViewportPixels,
  segmentGraphemes,
  segmentSentences,
} from "../packages/core/src/index.ts";
import { createDefaultEmbedder } from "../packages/model/src/embedders.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const fixturesDir = path.join(root, "fixtures/linguistic");

function loadFixture(id) {
  const file = path.join(fixturesDir, `${id}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const CHUNK_OPTS_BASE = { maxTokens: 80, maxSentences: 3, hardCeiling: 128 };

/** Every chunk's grapheme span, in order, covers the whole note with no
 * gaps/overlaps, and no `requiredGraphemeClusters` entry straddles a
 * chunk boundary. */
function assertChunksPartitionCleanly(graphemes, chunks, requiredClusters) {
  const reconstructed = chunks.map((c) => graphemes.slice(c.span.start, c.span.end).join("")).join("");
  assert(reconstructed === graphemes.join(""), "chunks do not reconstruct the original text exactly");

  if (requiredClusters) {
    for (const cluster of requiredClusters) {
      const idx = graphemes.indexOf(cluster);
      assert(idx >= 0, `required cluster ${JSON.stringify(cluster)} not found as a single grapheme`);
      const owner = chunks.find((c) => idx >= c.span.start && idx < c.span.end);
      assert(owner, `required cluster ${JSON.stringify(cluster)} at grapheme ${idx} is not inside any chunk span`);
    }
  }
}

const verifiers = {
  "grapheme-integrity": (fixture, ctx) => {
    const { text, requiredGraphemeClusters } = fixture.input;
    const graphemes = segmentGraphemes(text);
    for (const cluster of requiredGraphemeClusters) {
      assert(graphemes.includes(cluster), `${JSON.stringify(cluster)} did not segment as a single grapheme cluster`);
    }
    const chunks = chunkNote(text, { ...CHUNK_OPTS_BASE, countTokens: ctx.countTokens, noteId: "fixture" });
    assertChunksPartitionCleanly(graphemes, chunks, requiredGraphemeClusters);
    return { chunkCount: chunks.length };
  },

  "cjk-no-ascii-punctuation": (fixture, ctx) => {
    const { text } = fixture.input;
    const { minChunkCount, measuredChunkCount, measuredTotalTokens, measuredSentenceCount } = fixture.expected;
    const asciiPunctuation = /[.,!?;:]/;
    assert(!asciiPunctuation.test(text), "fixture input contains ASCII punctuation — defeats the point of this fixture");

    const sentences = segmentSentences(text);
    assert(
      sentences.length === measuredSentenceCount,
      `expected ${measuredSentenceCount} real sentence boundaries, got ${sentences.length} — CJK punctuation detection regressed`
    );

    const totalTokens = ctx.countTokens(text);
    assert(
      totalTokens === measuredTotalTokens,
      `pinned total token count drifted: expected ${measuredTotalTokens}, measured ${totalTokens} (model/tokenizer version changed? re-measure per SPEC.md §9 "Version pins")`
    );

    const chunks = chunkNote(text, { ...CHUNK_OPTS_BASE, countTokens: ctx.countTokens, noteId: "fixture" });
    assert(chunks.length > minChunkCount - 1, `expected chunk count > ${minChunkCount - 1}, got ${chunks.length}`);
    assert(chunks.length === measuredChunkCount, `pinned chunk count drifted: expected ${measuredChunkCount}, got ${chunks.length}`);
    for (const c of chunks) {
      assert(!c.text.includes("."), "a chunk contains an ASCII period — naive splitting regression");
    }
    return { chunkCount: chunks.length, totalTokens };
  },

  // Redesigned after real measurement during authoring (see
  // fixtures/linguistic/thai-no-space.json's `input.note` and
  // docs/DEVIATIONS.md): the real default-model tokenizer collapses any
  // long unspaced Thai run to a single [UNK] token (WordPiece has no Thai
  // vocabulary coverage), so `realTokenCount > hardCeiling` — the
  // fallback's actual trigger condition — is structurally unreachable via
  // organic Thai text against this specific tokenizer. This fixture
  // therefore verifies two things separately: the real, measured
  // linguistic fact (no sentence boundary found, and the real pinned
  // token count), and the chunking algorithm's fallback *mechanics*
  // (never lossy, never one undifferentiated blob) using a synthetic
  // tokenizer decoupled from any one model's vocabulary limits — the
  // property SPEC.md's fallback exists to guarantee.
  "thai-no-space": (fixture, ctx) => {
    const { text } = fixture.input;
    const { singleSentenceSpan, realDefaultModelTokenCount, syntheticFallback } = fixture.expected;

    assert(!text.includes(" "), "fixture input contains a space character — Thai has none between words");
    assert(!text.includes("\n"), "fixture input contains a newline — Unicode SB4 forces a break there unconditionally");
    assert(!/[.,!?;:]/.test(text), "fixture input contains ASCII punctuation");

    const sentences = segmentSentences(text);
    assert(
      sentences.length === 1 && singleSentenceSpan === true,
      `expected exactly one Intl.Segmenter sentence span (no boundary found), got ${sentences.length}`
    );

    const realTokenCount = ctx.countTokens(text);
    assert(
      realTokenCount === realDefaultModelTokenCount,
      `pinned real-tokenizer count drifted: expected ${realDefaultModelTokenCount} (the [UNK]-collapse finding), measured ${realTokenCount} — if this model version now tokenizes Thai meaningfully, update this fixture's note and consider a real (non-synthetic) fallback test`
    );

    // Structural fallback-mechanics check with a synthetic tokenizer
    // (1 "token" per grapheme — simple, deterministic, and guaranteed to
    // exceed the hard ceiling for this 458-grapheme text, unlike the real
    // tokenizer above).
    const syntheticCountTokens = (t) => segmentGraphemes(t).length;
    const chunks = chunkNote(text, { ...CHUNK_OPTS_BASE, countTokens: syntheticCountTokens, noteId: "fixture" });
    assert(
      chunks.length >= syntheticFallback.minChunkCount,
      `synthetic fallback: expected chunk count >= ${syntheticFallback.minChunkCount}, got ${chunks.length}`
    );
    for (const c of chunks) {
      assert(c.tokenCount <= syntheticFallback.maxTokensPerChunk, `chunk exceeds the hard ceiling: ${c.tokenCount}`);
      assert(c.truncated === false, "no-boundary fallback chunks must never be flagged truncated (nothing is discarded)");
    }
    const graphemes = segmentGraphemes(text);
    assertChunksPartitionCleanly(graphemes, chunks);

    return { realTokenCount, syntheticChunkCount: chunks.length };
  },

  "nfc-nfd-pair": async (fixture, ctx) => {
    const { nfcText, nfdText } = fixture.input;
    const { minCosineSimilarity, dedupeCollapsesThem } = fixture.expected;
    assert(nfcText !== nfdText, "fixture's NFC and NFD forms must be genuinely different byte sequences");
    assert(nfcText.normalize("NFC") === nfcText, "input.nfcText is not actually NFC-normalized");
    assert(nfdText.normalize("NFD") === nfdText, "input.nfdText is not actually NFD-normalized");

    const [embNfc, embNfd] = await ctx.embedder.embed([nfcText, nfdText]);
    const cosine = cosineSimilarity(embNfc, embNfd);
    assert(cosine >= minCosineSimilarity, `expected cosine >= ${minCosineSimilarity}, measured ${cosine}`);

    const collapsed = isDuplicateText(nfdText, [nfcText]) && isDuplicateText(nfcText, [nfdText]);
    assert(collapsed === dedupeCollapsesThem, "isDuplicateText did not collapse the NFC/NFD pair as expected");

    return { cosine };
  },

  "truncation-boundary": async (fixture, ctx) => {
    const { unflaggedText, flaggedIntro, flaggedLongSentenceVocab, flaggedLongSentenceWordCount } = fixture.input;
    const { unflaggedHasNoTruncatedChunks, flaggedHasExactlyOneTruncatedChunk, maxCosineTruncatedVsFullSentence } =
      fixture.expected;

    // --- ~90-word note: nothing should be flagged.
    const unflaggedChunks = chunkNote(unflaggedText, { ...CHUNK_OPTS_BASE, countTokens: ctx.countTokens, noteId: "u" });
    const noneFlagged = unflaggedChunks.every((c) => !c.truncated);
    assert(noneFlagged === unflaggedHasNoTruncatedChunks, `expected no truncated chunks in the unflagged note, got ${unflaggedChunks.filter((c) => c.truncated).length}`);

    // --- ~180-word note: rebuild the long run-on sentence from the
    // fixture's own recipe (same construction verified during authoring).
    const longWords = [];
    for (let i = 0; i < flaggedLongSentenceWordCount; i++) {
      longWords.push(flaggedLongSentenceVocab[i % flaggedLongSentenceVocab.length]);
    }
    const longSentence = `Throughout the entire planning cycle we discussed ${longWords.join(" ")} without ever really settling on a single clear direction that everyone could commit to.`;
    const flaggedText = `${flaggedIntro} ${longSentence}`;

    const flaggedChunks = chunkNote(flaggedText, { ...CHUNK_OPTS_BASE, countTokens: ctx.countTokens, noteId: "f" });
    const truncatedChunks = flaggedChunks.filter((c) => c.truncated);
    assert(
      (truncatedChunks.length === 1) === flaggedHasExactlyOneTruncatedChunk,
      `expected exactly one truncated chunk, got ${truncatedChunks.length}`
    );
    const truncatedChunk = truncatedChunks[0];
    assert(truncatedChunk.text.length < longSentence.length, "truncated chunk text should be strictly shorter than the original sentence");

    // The direct proof: the truncated chunk's real embedding must differ
    // meaningfully from an embedding of the FULL untruncated sentence —
    // if a regression ever embedded the full text despite the truncated
    // flag, this would read as ~1.0 / byte-identical instead.
    const [embTruncated, embFull] = await ctx.embedder.embed([truncatedChunk.text, longSentence]);
    const cosine = cosineSimilarity(embTruncated, embFull);
    assert(
      cosine <= maxCosineTruncatedVsFullSentence,
      `truncated-chunk embedding is suspiciously close to the full-sentence embedding (cosine ${cosine}) — position may not actually derive only from the truncated content`
    );

    return { unflaggedChunkCount: unflaggedChunks.length, flaggedChunkCount: flaggedChunks.length, cosineTruncatedVsFull: cosine };
  },

  "min-cluster-n": async (fixture, ctx) => {
    const { notes } = fixture.input;
    const { n5Null, n12Null, n25ClusterCount, n25PerfectTopicRecovery, n25Deterministic } = fixture.expected;

    async function centroidsFor(subset) {
      const out = [];
      for (const n of subset) {
        const chunks = chunkNote(n.text, { ...CHUNK_OPTS_BASE, countTokens: ctx.countTokens, noteId: n.id });
        const embeddings = await ctx.embedder.embed(chunks.map((c) => c.text));
        out.push({ id: n.id, embedding: centroid(embeddings) });
      }
      return out;
    }

    const c5 = await centroidsFor(notes.slice(0, 5));
    assert((clusterNotes(c5) === null) === n5Null, "expected clusterNotes(n=5) to be null (below the n>=15 floor)");

    const c12 = await centroidsFor(notes.slice(0, 12));
    assert((clusterNotes(c12) === null) === n12Null, "expected clusterNotes(n=12) to be null (below the n>=15 floor)");

    const c25 = await centroidsFor(notes);
    const clusters25 = clusterNotes(c25);
    assert(clusters25 !== null, "expected clusterNotes(n=25) to return real clusters, got null");
    assert(
      clusters25.length === n25ClusterCount,
      `expected ${n25ClusterCount} clusters at n=25, got ${clusters25.length}`
    );

    const topicById = new Map(notes.map((n) => [n.id, n.topic]));
    const perfectRecovery = clusters25.every((cluster) => {
      const topics = new Set(cluster.memberNoteIds.map((id) => topicById.get(id)));
      return topics.size === 1;
    });
    assert(
      perfectRecovery === n25PerfectTopicRecovery,
      "expected every cluster at n=25 to contain exactly one true topic (zero cross-topic contamination)"
    );

    const clusters25Again = clusterNotes(c25);
    const deterministic =
      JSON.stringify(clusters25.map((c) => [...c.memberNoteIds].sort())) ===
      JSON.stringify(clusters25Again.map((c) => [...c.memberNoteIds].sort()));
    assert(deterministic === n25Deterministic, "re-running clusterNotes on identical input should be deterministic");

    return { n25ClusterCount: clusters25.length, sizes: clusters25.map((c) => c.memberNoteIds.length) };
  },

  "pca-instability-on-edit": async (fixture, ctx) => {
    const { tenNotes, eleventhNote, viewportSize, viewportPadding } = fixture.input;
    const { meanDisplacementPx, maxDisplacementPx, toleranceAbsolutePx, deterministic } = fixture.expected;

    async function embedNoteTexts(texts) {
      const out = [];
      for (let i = 0; i < texts.length; i++) {
        const chunks = chunkNote(texts[i], { ...CHUNK_OPTS_BASE, countTokens: ctx.countTokens, noteId: `n${i}` });
        const embeddings = await ctx.embedder.embed(chunks.map((c) => c.text));
        out.push({ id: `n${i}`, chunks: embeddings, centroid: centroid(embeddings) });
      }
      return out;
    }

    function projectNotes(notes) {
      const allChunkEmbeddings = notes.flatMap((n) => n.chunks);
      const fitted = project(allChunkEmbeddings);
      const centroidCoords = projectOnto(fitted, notes.map((n) => n.centroid));
      return notes.map((n, i) => ({ id: n.id, x: centroidCoords[i][0], y: centroidCoords[i][1] }));
    }

    const notesBefore = await embedNoteTexts(tenNotes);
    const coordsBefore = projectNotes(notesBefore);

    const notesAfter = await embedNoteTexts([...tenNotes, eleventhNote]);
    const coordsAfterAll = projectNotes(notesAfter);
    const coordsAfter = coordsAfterAll.filter((c) => c.id !== "n10");

    const fitBefore = fitProjectionToViewport(coordsBefore, viewportSize, viewportPadding);
    const fitAfter = fitProjectionToViewport(coordsAfterAll, viewportSize, viewportPadding);

    const displacements = coordsBefore.map((c, i) => {
      const pxBefore = projectToViewportPixels(c, fitBefore);
      const pxAfter = projectToViewportPixels(coordsAfter[i], fitAfter);
      const dx = pxAfter.x - pxBefore.x;
      const dy = pxAfter.y - pxBefore.y;
      return Math.sqrt(dx * dx + dy * dy);
    });
    const mean = displacements.reduce((a, b) => a + b, 0) / displacements.length;
    const max = Math.max(...displacements);

    assert(
      Math.abs(mean - meanDisplacementPx) <= toleranceAbsolutePx,
      `mean displacement drifted: pinned ${meanDisplacementPx}px, measured ${mean.toFixed(2)}px (tolerance ${toleranceAbsolutePx}px) — re-measure and update the fixture + the on-page receipt (Map.tsx) if this is a real, intended algorithm change`
    );
    assert(
      Math.abs(max - maxDisplacementPx) <= toleranceAbsolutePx,
      `max displacement drifted: pinned ${maxDisplacementPx}px, measured ${max.toFixed(2)}px (tolerance ${toleranceAbsolutePx}px)`
    );

    const notesBeforeAgain = await embedNoteTexts(tenNotes);
    const coordsBeforeAgain = projectNotes(notesBeforeAgain);
    const isDeterministic = coordsBefore.every((c, i) => c.x === coordsBeforeAgain[i].x && c.y === coordsBeforeAgain[i].y);
    assert(isDeterministic === deterministic, "re-running the before-state projection twice should be byte-identical");

    return { meanDisplacementPx: Number(mean.toFixed(2)), maxDisplacementPx: Number(max.toFixed(2)) };
  },
};

// Full roster from SPEC.md §14, in build order — ids with no verifier yet
// are reported SKIP until their milestone lands.
const FIXTURE_IDS = [
  "negation-pairs",
  "code-switch-taglish",
  "cjk-no-ascii-punctuation",
  "thai-no-space",
  "grapheme-integrity",
  "nfc-nfd-pair",
  "truncation-boundary",
  "min-cluster-n",
  "pca-instability-on-edit",
];

async function main() {
  console.log("verify-fixtures: loading the real default embedder (real network fetch or local cache)...");
  const embedder = createDefaultEmbedder();
  const t0 = Date.now();
  await embedder.load(() => {});
  console.log(`verify-fixtures: model ready in ${Date.now() - t0}ms (${await embedder.cacheStatus()})`);

  const ctx = { embedder, countTokens: (t) => embedder.countTokens(t) };

  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const results = [];

  for (const id of FIXTURE_IDS) {
    const fixture = loadFixture(id);
    if (!fixture) {
      console.log(`SKIP  ${id}  (fixture not authored yet)`);
      skipped++;
      continue;
    }
    const verifier = verifiers[id];
    if (!verifier) {
      console.error(`ERROR ${id}  fixture JSON exists but no verifier is wired up in verify-fixtures.mjs`);
      failed++;
      continue;
    }
    try {
      const detail = await verifier(fixture, ctx);
      console.log(`PASS  ${id}  ${detail ? JSON.stringify(detail) : ""}`);
      results.push({ id, status: "pass", detail });
      passed++;
    } catch (err) {
      console.error(`FAIL  ${id}  ${err instanceof Error ? err.message : String(err)}`);
      results.push({ id, status: "fail", message: String(err) });
      failed++;
    }
  }

  console.log(`\nverify-fixtures: ${passed} passed, ${failed} failed, ${skipped} skipped (of ${FIXTURE_IDS.length})`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("verify-fixtures: fatal error", err);
  process.exitCode = 1;
});
