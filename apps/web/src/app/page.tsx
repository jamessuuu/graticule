import { NoteWorkbench } from "@/components/NoteWorkbench";

export default function HomePage() {
  return (
    <div>
      <h1>graticule</h1>
      <p className="disclosure">
        Paste your own short notes and watch them mapped by how similar their wording is — computed
        entirely on-device. Nothing you paste is sent anywhere.
      </p>
      <NoteWorkbench />
    </div>
  );
}
