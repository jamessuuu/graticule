import Link from "next/link";
import { DEFAULT_MODEL_ID, DEFAULT_MODEL_SIZE_MB, MULTILINGUAL_MODEL_ID, MULTILINGUAL_MODEL_SIZE_MB } from "@graticule/model";

export const metadata = { title: "methodology" };

export default function MethodologyPage() {
  return (
    <div>
      <h1>Methodology</h1>
      <p className="disclosure">
        Why this model, why WASM instead of WebGPU, and exactly which numbers on this site were measured
        versus cited from elsewhere — captioned by source, the way the rest of the page is.
      </p>

      <h2>Model choice</h2>
      <p>
        The default embedder is <code>{DEFAULT_MODEL_ID}</code> at 8-bit quantization (<code>q8</code>),{" "}
        {DEFAULT_MODEL_SIZE_MB}MB — a small, English-tuned sentence embedding model, lazy-loaded once
        the page is idle so it never blocks the first paint. Cold load measured 5.0-5.4s and 5.9-12.8ms
        per inference on the desktop this spec was built against (a Ryzen 7 9700X / RX 9060 XT — a
        machine that is deliberately named as neither a high-end nor a low-end reference point, so those
        numbers are not presented as a device-agnostic promise).
      </p>
      <p>
        A second, explicitly opt-in model — <code>{MULTILINGUAL_MODEL_ID}</code>, {MULTILINGUAL_MODEL_SIZE_MB}
        MB — is offered from the workbench for other languages (see <Link href="/coverage">coverage</Link>).
        It is never auto-fetched: SPEC.md's Decision for this feature calls it out as &quot;gesture-gated,&quot;
        the same standard the rest of this page holds every other claim to.
      </p>

      <h2>WASM, not WebGPU</h2>
      <p>
        Almost every browser-ML demo reaches for WebGPU by default. This one deliberately doesn&apos;t:
        real <code>GPUAdapter.requestDevice()</code> calls against a non-fallback adapter, benchmarked at
        batch sizes 1 and 32 on both models, found WASM faster at every size tested — the gap narrows as
        batch size grows, but WebGPU never actually crosses over to win, and this product only ever
        embeds one note (or a handful of search terms) at a time. There is no capability probe or
        fallback ladder in the code because none is needed: `device: &quot;wasm&quot;` is used
        unconditionally.
      </p>
      <table style={{ marginTop: "1rem" }}>
        <thead>
          <tr>
            <th>Batch size</th>
            <th>WASM vs. WebGPU</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1 (this product&apos;s actual usage)</td>
            <td>WASM 8.75x faster</td>
          </tr>
          <tr>
            <td>8</td>
            <td style={{ color: "var(--ink-soft)" }}>not separately measured — see note below</td>
          </tr>
          <tr>
            <td>32</td>
            <td>WASM 1.44x faster (narrowing, but WebGPU never crosses over)</td>
          </tr>
        </tbody>
      </table>
      <p className="disclosure" style={{ marginTop: "0.75rem" }}>
        This build&apos;s own source material (SPEC.md) pins the batch=1 and batch=32 figures above along
        with a general &quot;WASM beats WebGPU 8-17x at batch=1&quot; range across both models — a
        batch=8 datapoint isn&apos;t independently available in that record, so it is shown as missing
        rather than interpolated. The number that matters for this product is batch=1, and it is real,
        cited, and decisive on its own.
      </p>

      <h2>Version pins</h2>
      <p>
        The exact library versions the numbers on this page were measured against:{" "}
        <code>@huggingface/transformers@4.2.0</code> and <code>onnxruntime-web@1.26.0-dev.20260416</code>.
        A version bump requires re-measuring before this page or any other cites these figures again — a
        library update is not assumed to preserve them.
      </p>

      <h2>Why /limits exists</h2>
      <p>
        The negation-blindness demonstration on <Link href="/limits">/limits</Link> exists because of an
        earlier measurement, on the multilingual model, that a genuine paraphrase (&quot;confirmed the
        deadline&quot; / &quot;confirmed the due date&quot;) scored <strong>0.537</strong> cosine similarity
        while a flat contradiction (&quot;confirmed the deadline&quot; / &quot;missed the deadline&quot;)
        scored <strong>0.517</strong> — nearly indistinguishable, on the wrong side of each other. Those two
        numbers are historical: they were measured on the multilingual model, a different artifact from
        the default model <code>/limits</code> demonstrates live today, and are not reused verbatim there.
        The live page re-measures its own default-pair numbers in real time against the shipped default
        model, and lets a visitor substitute their own pairs and watch it recompute.
      </p>

      <h2>Filipino / cross-lingual note</h2>
      <p>
        The same round of measurement found Filipino cross-lingual similarity inconsistent across two
        genuine paraphrase pairs on the multilingual model — cosine values ranging <strong>0.057-0.537</strong>{" "}
        for pairs that should both read as clearly similar. This is part of why <Link href="/coverage">
        coverage</Link> marks every language beyond English as &quot;tuned per the model card, not
        independently re-verified&quot; rather than asserting it works — Filipino/Tagalog is the one
        exception, carrying its own real, measured verdict from this project&apos;s own fixture rather than
        an inherited number.
      </p>
    </div>
  );
}
