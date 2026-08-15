import Link from "next/link";
import { NoteWorkbench } from "@/components/NoteWorkbench";

export default function HomePage() {
  return (
    <div>
      <h1>graticule</h1>
      <p className="disclosure">
        Paste your own short notes and watch them mapped by how similar their wording is — computed
        entirely on-device. Nothing you paste is sent anywhere.
      </p>
      <div className="callout" style={{ marginTop: "1rem" }}>
        <p style={{ margin: 0 }}>
          This map measures wording, not meaning — it can&apos;t tell a statement from its opposite.{" "}
          <Link href="/limits">See exactly where that breaks →</Link>
        </p>
      </div>
      <NoteWorkbench />
    </div>
  );
}
