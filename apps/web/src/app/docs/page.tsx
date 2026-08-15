import Link from "next/link";
import { MAX_NOTES, MAX_TOTAL_CHARACTERS } from "@graticule/core";
import { MechanismDiagram } from "@/components/MechanismDiagram";

export const metadata = { title: "docs" };

export default function DocsPage() {
  return (
    <div>
      <h1>Docs</h1>
      <p className="disclosure">How this works, what it can&apos;t claim, and what would prove the privacy claim false.</p>

      <h2>How it works</h2>
      <MechanismDiagram />
      <p>
        A pasted note is split into sentence-bounded chunks (never more than 3 sentences or 80 subword
        tokens, whichever comes first), each chunk is embedded into a 384-dimension vector entirely
        on-device, and the whole current set of chunk embeddings is projected onto its own top-2 principal
        components to draw the map. That last step — <strong>project</strong> — reruns from scratch on
        every add, edit, or remove (the amber edge above), which is why the map&apos;s own caption says a
        note&apos;s position is relative to what you&apos;ve pasted and will shift, not a fixed measurement.
        Search ranks over the finer-grained chunks; the map, clustering, and outlier detection operate on
        each note&apos;s centroid (the mean of its own chunks&apos; embeddings) — two different granularities,
        used for two different questions, never conflated.
      </p>

      <h2 id="limitations">Limitations</h2>
      <p>
        The single most important limitation is demonstrated live, not just described:{" "}
        <Link href="/limits">/limits</Link> shows that this technique measures how similar two sentences&apos;
        wording is, not whether they mean the same thing — a flat contradiction can score as similar as, or
        more similar than, a genuine paraphrase. Nothing on this site should be read as the model detecting
        agreement, confirmation, or factual consistency.
      </p>
      <ul>
        <li>
          <strong>Language.</strong> The default model is English-tuned; results in other languages will be
          worse, sometimes much worse. See <Link href="/coverage">coverage</Link> for exactly which
          languages the optional multilingual model was tuned on, and which of those this project has
          actually re-verified versus simply cites from the model&apos;s own published list.
        </li>
        <li>
          <strong>The map is 2D, the model isn&apos;t.</strong> Clustering and outlier detection run in the
          full embedding space; the map is a 2-axis projection of that space for display only. Two points
          landing close together on the map is a real, local signal; two points landing far apart is not
          proof they&apos;re unrelated — projection can compress or separate points in ways the caption
          under the map explicitly disclaims.
        </li>
        <li>
          <strong>Session-only.</strong> Notes live in this browser tab and are gone on reload — nothing is
          saved to a server, by design (see Privacy below). There is no account, no sync, no history.
        </li>
        <li>
          <strong>Caps.</strong> A session holds at most {MAX_NOTES} notes or {MAX_TOTAL_CHARACTERS.toLocaleString()}{" "}
          characters, whichever comes first, after which new notes are refused with a clear message rather
          than silently dropped or truncated.
        </li>
        <li>
          <strong>No analytics.</strong> This build ships no page-view or usage analytics of any kind — not
          scoped, not anonymized, not present at all. If that ever changes, it will be named here and
          scoped to route changes only, never to anything typed or pasted.
        </li>
      </ul>

      <h2 id="privacy">Privacy, and how to prove it wrong</h2>
      <p>
        The claim: nothing you paste, type, search, or cluster is ever sent anywhere. Chunking, embedding,
        projection, search ranking, clustering, and outlier detection all run in this tab, most of them
        inside a Web Worker, using a model that was fetched once from a public CDN and cached by the
        browser afterward.
      </p>
      <p>
        <strong>The condition that would make this claim false:</strong> any network request whose URL,
        query string, or request body encodes a fragment of text you actually typed or pasted. That&apos;s
        it — that is the one thing that isn&apos;t supposed to happen, ever, at any point in this product.
      </p>
      <p>
        Don&apos;t take the live request counter&apos;s word for it. Open your browser&apos;s dev tools,
        go to the Network tab, and paste something — the only requests a cold visit makes are for this
        page&apos;s own static assets, the model runtime from <code>cdn.jsdelivr.net</code>, and the model
        weights themselves from <code>huggingface.co</code> (once, cached after). Typing, pasting, editing,
        searching, and clustering should never add a single row to that list. If you ever see one that
        does, that is a real bug — the source is public and every one of these claims is checkable against
        it, not just this page&apos;s word.
      </p>
    </div>
  );
}
