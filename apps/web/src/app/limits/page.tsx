import { NegationDemo } from "@/components/NegationDemo";

export const metadata = { title: "limits" };

export default function LimitsPage() {
  return (
    <div>
      <h1>Where this breaks</h1>
      <p className="disclosure">
        This tool measures wording similarity, not truth. The clearest way to show that is to let it fail in
        front of you: paste a statement and its exact opposite, and the model still calls them similar — often
        more similar than a genuine paraphrase. Edit either box below; everything recomputes from real,
        live, on-device inference.
      </p>
      <NegationDemo />
    </div>
  );
}
