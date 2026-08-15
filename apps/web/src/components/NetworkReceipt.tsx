"use client";

import { useNetworkReceipt } from "@/lib/useNetworkReceipt";

interface Props {
  workerNetworkRequests: number;
  modelReady: boolean;
}

/**
 * SPEC.md §8: "Reuses chaff's proven pattern (static disclosure + a link
 * to the source file that would prove it wrong) and adds a live Network
 * Receipt badge... Stronger than dev-tools instructions because it is
 * self-verifying, and itself falsifiable: if it ever undercounts, a
 * visitor with dev tools open catches it immediately."
 */
export function NetworkReceipt({ workerNetworkRequests, modelReady }: Props) {
  const { total, sinceReady } = useNetworkReceipt(workerNetworkRequests, modelReady);

  return (
    <p className="receipt-row" role="status">
      <strong>{total}</strong> network request{total === 1 ? "" : "s"} this session (page assets + the one-time
      model download) · <strong>{sinceReady}</strong> since the map became interactive
      {sinceReady === 0 ? (
        " — nothing you type, paste, search, or cluster sends anything anywhere."
      ) : (
        <>
          {" "}
          — from a model download you explicitly started, never from typed or pasted text. Open your browser's
          Network tab and watch for yourself; that is the actual proof, not this number.
        </>
      )}
    </p>
  );
}
