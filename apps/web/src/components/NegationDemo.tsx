"use client";

import { useEffect, useRef, useState } from "react";
import { cosineSimilarity } from "@graticule/core";
import { useEmbedderWorker } from "@/lib/useEmbedderWorker";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import negationFixture from "../../../../fixtures/linguistic/negation-pairs.json";

const DEBOUNCE_MS = 300;

interface PairBoxProps {
  label: string;
  a: string;
  b: string;
  onChangeA: (v: string) => void;
  onChangeB: (v: string) => void;
  cosine: number | null;
  modelId: string | null;
  computing: boolean;
}

function PairBox({ label, a, b, onChangeA, onChangeB, cosine, modelId, computing }: PairBoxProps) {
  return (
    <div style={{ border: "1px solid var(--line-strong)", borderRadius: 2, padding: "1rem" }}>
      <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>{label}</h3>
      <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
        {label} — Text A
        <textarea
          value={a}
          onChange={(e) => onChangeA(e.target.value)}
          rows={2}
          style={{ width: "100%", padding: "0.5rem", border: "1px solid var(--line-strong)", borderRadius: 2, marginTop: "0.25rem" }}
        />
      </label>
      <label style={{ display: "block", fontSize: "0.85rem", margin: "0.5rem 0 0.25rem" }}>
        {label} — Text B
        <textarea
          value={b}
          onChange={(e) => onChangeB(e.target.value)}
          rows={2}
          style={{ width: "100%", padding: "0.5rem", border: "1px solid var(--line-strong)", borderRadius: 2, marginTop: "0.25rem" }}
        />
      </label>
      <p className="receipt-row" role="status" style={{ marginTop: "0.75rem" }}>
        {computing ? (
          "computing…"
        ) : cosine !== null && modelId ? (
          <>
            cosine similarity, {modelId}: <strong>{cosine.toFixed(3)}</strong>
          </>
        ) : (
          "—"
        )}
      </p>
    </div>
  );
}

/**
 * SPEC.md §6 Decision 6 — the one deliberate exception to "never a bare
 * cosine": both raw numbers stay visible, because the entire point is
 * that a contradiction and a genuine paraphrase can land on
 * indistinguishable — or, as measured here, INVERTED — numbers. The
 * metric name and its limitation travel together: "cosine similarity,
 * [active model]" is printed right next to every number, never a bare
 * float alone.
 */
export function NegationDemo() {
  const { state, load, embedTexts } = useEmbedderWorker();
  const triggered = useRef(false);

  const defaultPair = negationFixture.input.defaultPair;
  const [contraA, setContraA] = useState(defaultPair.contradiction.a);
  const [contraB, setContraB] = useState(defaultPair.contradiction.b);
  const [paraA, setParaA] = useState(defaultPair.paraphrase.a);
  const [paraB, setParaB] = useState(defaultPair.paraphrase.b);

  const [contraCosine, setContraCosine] = useState<number | null>(null);
  const [paraCosine, setParaCosine] = useState<number | null>(null);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    if (triggered.current) return;
    if (state.status !== "idle") return;
    triggered.current = true;
    load("default");
  }, [state.status, load]);

  const debouncedContraA = useDebouncedValue(contraA, DEBOUNCE_MS);
  const debouncedContraB = useDebouncedValue(contraB, DEBOUNCE_MS);
  const debouncedParaA = useDebouncedValue(paraA, DEBOUNCE_MS);
  const debouncedParaB = useDebouncedValue(paraB, DEBOUNCE_MS);

  useEffect(() => {
    if (state.status !== "ready") return;
    if (!debouncedContraA.trim() || !debouncedContraB.trim() || !debouncedParaA.trim() || !debouncedParaB.trim()) return;

    let cancelled = false;
    // Kicking off an async operation and tracking its loading state is
    // the standard React data-fetching-in-an-effect pattern; the
    // set-state-in-effect rule's stricter external-store-sync philosophy
    // doesn't fit real async I/O (there's no "external system" to
    // subscribe to here, just a Promise) — scoped, justified exception.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setComputing(true);
    embedTexts([debouncedContraA, debouncedContraB, debouncedParaA, debouncedParaB])
      .then(([ca, cb, pa, pb]) => {
        if (cancelled) return;
        setContraCosine(cosineSimilarity(ca!, cb!));
        setParaCosine(cosineSimilarity(pa!, pb!));
      })
      .finally(() => {
        if (!cancelled) setComputing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [state.status, debouncedContraA, debouncedContraB, debouncedParaA, debouncedParaB, embedTexts]);

  return (
    <div>
      {state.status !== "ready" && (
        <p className="receipt-row" role="status">
          {state.status === "error" ? "The model failed to load — try reloading the page." : "Loading the model…"}
        </p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
        <PairBox
          label="Contradiction"
          a={contraA}
          b={contraB}
          onChangeA={setContraA}
          onChangeB={setContraB}
          cosine={contraCosine}
          modelId={state.modelInfo?.modelId ?? null}
          computing={computing}
        />
        <PairBox
          label="Genuine paraphrase"
          a={paraA}
          b={paraB}
          onChangeA={setParaA}
          onChangeB={setParaB}
          cosine={paraCosine}
          modelId={state.modelInfo?.modelId ?? null}
          computing={computing}
        />
      </div>
      {contraCosine !== null && paraCosine !== null && (
        <p className="disclosure" role="status" style={{ marginTop: "1rem" }}>
          {contraCosine >= paraCosine
            ? "Right now the contradiction scores as similar as — or more similar than — the genuine paraphrase. The model has no notion of “true” or “false”; it only measures how similar the wording is."
            : "The contradiction still scores highly similar despite being the opposite claim — cosine similarity does not distinguish a statement from its negation."}
        </p>
      )}
      <p className="disclosure" style={{ marginTop: "0.5rem" }}>
        Edit either box above — the numbers recompute from real, live, on-device inference (no server call).
      </p>
    </div>
  );
}
