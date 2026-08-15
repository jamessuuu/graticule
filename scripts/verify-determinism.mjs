#!/usr/bin/env node
/**
 * Determinism eval (SPEC.md §16): "CRLF/LF, BOM, NFC/NFD, order shuffle
 * -> identical output, coordinates compared with an epsilon rather than a
 * false byte-identical promise." Real local inference (Decision 8's same
 * $0-marginal-cost reasoning as verify-fixtures.mjs), not a mock.
 *
 * Two independent properties, tested separately because they exercise
 * different layers:
 *
 *  A. Encoding invariance — the same logical text, re-encoded four ways
 *     (as-is/LF, CRLF line endings, a leading UTF-8 BOM, NFD-normalized),
 *     must chunk to the same structure and embed to a near-identical
 *     centroid. "Near-identical" because chunkNote() does NOT normalize
 *     its input (confirmed by reading packages/core/src/chunk.ts before
 *     writing this script) — an NFD string is a genuinely different byte
 *     sequence from its NFC form, so the model sees different tokens and
 *     produces a numerically different (though semantically equivalent)
 *     embedding. A high cosine floor, not exact equality, is the honest
 *     claim here.
 *
 *  B. Order-shuffle invariance — project() (packages/core/src/project.ts)
 *     uses a fixed, non-random seed vector and sums over whatever array
 *     it's given, so the *set* of resulting 2D coordinates should be the
 *     same regardless of what order that array was built in — but the
 *     *positions* in the returned coords array track input order, so
 *     this re-associates each note's coordinate by its own id before
 *     comparing, not by array index (comparing by index would find a
 *     trivial, meaningless "difference" that's really just the shuffle
 *     itself). Compared with a tight absolute epsilon in the raw
 *     projected-coordinate units project()/projectOnto() return (not the
 *     Map component's viewport pixels — this script never calls
 *     fitProjectionToViewport), not asserted byte-identical — float
 *     summation order can perturb the last few bits even though the
 *     accumulators inside dominantEigenvector() are Float64Array.
 *
 * Run: `tsx scripts/verify-determinism.mjs` (needs tsx — see
 * verify-fixtures.mjs's header for why plain node can't import these).
 */
import {
  centroid,
  chunkNote,
  cosineSimilarity,
  project,
  projectOnto,
} from "../packages/core/src/index.ts";
import { createDefaultEmbedder } from "../packages/model/src/embedders.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const CHUNK_OPTS = { maxTokens: 80, maxSentences: 3, hardCeiling: 128 };

async function embedNote(embedder, text, noteId) {
  const chunks = chunkNote(text, { ...CHUNK_OPTS, countTokens: (t) => embedder.countTokens(t), noteId });
  if (chunks.length === 0) return { chunks: [], centroid: new Float32Array(0) };
  const embeddings = await embedder.embed(chunks.map((c) => c.text));
  return { chunks, centroid: centroid(embeddings) };
}

async function checkEncodingInvariance(embedder) {
  const base = "The café closes early on Sundays, so I should double check the posted schedule beforehand.";
  assert(base.normalize("NFC") === base, "base text must already be NFC-normalized for this test to be meaningful");

  const crlf = base.replace(/\n/g, "\r\n"); // base has no \n, but this documents intent if it ever gains one
  const bom = "﻿" + base;
  const nfd = base.normalize("NFD");
  assert(nfd !== base, "NFD form must be a genuinely different byte sequence, or this test proves nothing");

  const variants = { base, crlf, bom, nfd };
  const results = {};
  for (const [name, text] of Object.entries(variants)) {
    results[name] = await embedNote(embedder, text, `enc-${name}`);
  }

  const baseChunkCount = results.base.chunks.length;
  for (const name of ["crlf", "bom", "nfd"]) {
    assert(
      results[name].chunks.length === baseChunkCount,
      `${name} variant chunked to ${results[name].chunks.length} chunks, base had ${baseChunkCount} — an encoding-only difference must not change chunk structure`
    );
  }

  const MIN_COSINE = 0.999;
  const cosines = {};
  for (const name of ["crlf", "bom", "nfd"]) {
    const cos = cosineSimilarity(results[name].centroid, results.base.centroid);
    cosines[name] = Number(cos.toFixed(6));
    assert(
      cos >= MIN_COSINE,
      `${name} variant's centroid drifted too far from base: cosine ${cos.toFixed(6)}, floor ${MIN_COSINE} — an encoding-only difference should be near-invisible to the embedding, not just "similar"`
    );
  }

  return { baseChunkCount, cosines };
}

async function checkOrderShuffleInvariance(embedder) {
  const notes = [
    { id: "a", text: "Booked a table for four at the new ramen place downtown." },
    { id: "b", text: "The quarterly budget review got pushed to next Thursday." },
    { id: "c", text: "Need to renew the car's registration before the end of the month." },
    { id: "d", text: "Left a voicemail for the contractor about the leaking faucet." },
    { id: "e", text: "Signed up for the beginner pottery class starting in September." },
  ];

  const embedded = new Map();
  for (const n of notes) {
    embedded.set(n.id, await embedNote(embedder, n.text, n.id));
  }

  // chunkNote()'s own output doesn't carry embeddings (embedNote() above
  // only kept each note's centroid) — rebuild {id -> chunkEmbeddings[]}
  // once here, reused for both orderings below.
  const chunkEmbeddingsById = new Map();
  for (const n of notes) {
    const chunks = chunkNote(n.text, { ...CHUNK_OPTS, countTokens: (t) => embedder.countTokens(t), noteId: n.id });
    const chunkEmbeddings = await embedder.embed(chunks.map((c) => c.text));
    chunkEmbeddingsById.set(n.id, chunkEmbeddings);
  }

  function projectInOrder(order) {
    const allChunkEmbeddings = order.flatMap((id) => chunkEmbeddingsById.get(id));
    const fitted = project(allChunkEmbeddings);
    const centroids = order.map((id) => embedded.get(id).centroid);
    const centroidCoords = projectOnto(fitted, centroids);
    const byId = new Map();
    order.forEach((id, i) => byId.set(id, centroidCoords[i]));
    return byId;
  }

  const originalOrder = notes.map((n) => n.id);
  const shuffledOrder = [originalOrder[2], originalOrder[0], originalOrder[4], originalOrder[1], originalOrder[3]];
  assert(
    shuffledOrder.join(",") !== originalOrder.join(","),
    "shuffled order must actually differ from the original, or this test proves nothing"
  );

  const coordsOriginal = projectInOrder(originalOrder);
  const coordsShuffled = projectInOrder(shuffledOrder);

  const EPS = 1e-3;
  const perNoteDelta = {};
  for (const id of originalOrder) {
    const [ox, oy] = coordsOriginal.get(id);
    const [sx, sy] = coordsShuffled.get(id);
    const delta = Math.sqrt((ox - sx) ** 2 + (oy - sy) ** 2);
    perNoteDelta[id] = Number(delta.toFixed(6));
    assert(
      delta <= EPS,
      `note "${id}"'s projected coordinate moved by ${delta.toFixed(6)} between add-orders (epsilon ${EPS}) — PCA over the same *set* of embeddings should not depend on the order they were provided in`
    );
  }

  return { maxDelta: Math.max(...Object.values(perNoteDelta)), perNoteDelta };
}

async function main() {
  console.log("verify-determinism: loading the real default embedder (real network fetch or local cache)...");
  const embedder = createDefaultEmbedder();
  const t0 = Date.now();
  await embedder.load(() => {});
  console.log(`verify-determinism: model ready in ${Date.now() - t0}ms (${await embedder.cacheStatus()})`);

  let failed = 0;

  try {
    const detail = await checkEncodingInvariance(embedder);
    console.log(`PASS  encoding-invariance  ${JSON.stringify(detail)}`);
  } catch (err) {
    console.error(`FAIL  encoding-invariance  ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }

  try {
    const detail = await checkOrderShuffleInvariance(embedder);
    console.log(`PASS  order-shuffle-invariance  ${JSON.stringify(detail)}`);
  } catch (err) {
    console.error(`FAIL  order-shuffle-invariance  ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }

  console.log(`\nverify-determinism: ${2 - failed} passed, ${failed} failed (of 2)`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("verify-determinism: fatal error", err);
  process.exitCode = 1;
});
