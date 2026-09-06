import { BrandGlyph } from "./BrandMark";
import { Attribution } from "./Attribution";

/** The maker line is the shared attribution kit (attribution-kit v1): chip mark inline in currentColor, portfolio + LinkedIn with rel="me". */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-row">
        <BrandGlyph size={16} />
        <span>graticule</span>
        <span aria-hidden="true">·</span>
        <Attribution />
        <span aria-hidden="true">·</span>
        <a href="https://github.com/jamessuuu/graticule" target="_blank" rel="noreferrer">
          source
        </a>
      </div>
    </footer>
  );
}
