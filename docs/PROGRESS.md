# graticule — build progress

Tracks milestone completion against `docs/SPEC.md` §17. Updated as each
milestone lands; the authoritative state is always the git log + a green
`pnpm run ci`, not this file — but this file is where a resuming session
should look first.

| M | Deliverable | Status |
|---|---|---|
| M0 | Workspace, TS strict, CI, brand, zero-functions gate, static `/` | in progress |
| M1 | Chunking core + default embedder in a Worker + first real inference | not started |
| M2 | PCA + dual markers + live typing + paste/drop + NFC dedupe + truncation + caps | not started |
| M3 | Search + percentile + deterministic clustering + outlier, floors enforced | not started |
| M4 | `/limits` negation demo + `/coverage` wired to real fixture results | not started |
| M5 | Multilingual opt-in (gesture-gated) | not started |
| M6 | Sample corpus + hero + `/methodology` + Network Receipt + `/docs` | not started |
| M7 | Brand, accessibility pass, isomorphism + network e2e, README, review fixes | not started |

See `docs/DEVIATIONS.md` for every place the implementation departs from
SPEC.md's literal text, and why.
