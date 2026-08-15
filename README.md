# graticule

A visitor pastes or drops their own short notes; the tool chunks them, embeds
them entirely on-device, and draws a live, honestly-captioned map of how
their wording relates — plus ranked search by meaning and a permanent,
in-product demonstration of where the underlying technique breaks (negation
blindness) and where its language claim does and does not hold (the coverage
table). No part of the pipeline leaves the browser tab.

Full spec: [`docs/SPEC.md`](docs/SPEC.md). Build status and milestone
progress: [`docs/PROGRESS.md`](docs/PROGRESS.md). Deliberate deviations from
the spec's literal text, with reasons: [`docs/DEVIATIONS.md`](docs/DEVIATIONS.md).

_(This section is expanded at M7 with the full brand lockup, screenshots, and
portfolio entry copy.)_

## Develop

```sh
pnpm install
pnpm --filter @graticule/web dev
```

## Verify

```sh
pnpm run ci   # typecheck -> lint -> unit -> fixtures -> build -> e2e
```

Built by James Lorenz Santos — [agentjames.vercel.app](https://agentjames.vercel.app)
