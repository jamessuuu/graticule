import Link from "next/link";
import { NoteWorkbench } from "@/components/NoteWorkbench";

/**
 * The map is the first screen. This route used to open with a disclosure
 * blockquote, an amber callout, two lines of model status and a second amber
 * callout with a download button, and only then the map. Four boxes of prose
 * above the product. The warning that used to be a full-width callout is now
 * a chip in the hero rail, with the same words and the same link.
 */
export default function HomePage() {
  return (
    <div className="hero">
      <div className="rise">
        <p className="kicker">On-device semantic map</p>
        <h1>graticule</h1>
        <p className="lede">
          Paste your own short notes and watch them mapped by how similar their wording is. Nothing you
          paste is sent anywhere.
        </p>
        {/* A div, not a ul. The note list below is addressed in e2e as
            `main ul > li`, and a second list in the hero silently became the
            first match, so the row assertions read a chip instead of a note. */}
        <div className="chiprail">
          <Link href="/limits" className="chip chip-warn">
            <span className="dot" aria-hidden="true" />
            Measures wording, not meaning. See where that breaks
          </Link>
          <span className="chip">runs entirely in your browser</span>
          <Link href="/methodology" className="chip">
            how it works
          </Link>
        </div>
      </div>
      <NoteWorkbench />
    </div>
  );
}
