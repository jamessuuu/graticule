/**
 * Always paired with adjacent visible "graticule" text in this codebase
 * (nav brand mark, footer) — decorative by default (`aria-hidden`, no
 * title) so the accessible name comes once from the text, not twice.
 * Pass `standalone` where the glyph appears with no adjacent label.
 */
export function BrandGlyph({ size = 22, standalone = false }: { size?: number; standalone?: boolean }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden={standalone ? undefined : "true"}
      role={standalone ? "img" : undefined}
      aria-label={standalone ? "graticule mark" : undefined}
    >
      {standalone ? <title>graticule</title> : null}
      <line x1="20" y1="4" x2="20" y2="96" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <line x1="70" y1="4" x2="70" y2="96" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <line x1="4" y1="30" x2="96" y2="30" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <line x1="4" y1="75" x2="96" y2="75" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <circle cx="46" cy="54" r="8" fill="#b45309" />
    </svg>
  );
}

export function BrandMark() {
  return (
    <span className="brand-mark">
      <BrandGlyph />
      graticule
    </span>
  );
}
