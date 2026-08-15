import { BrandGlyph } from "./BrandMark";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-row">
        <BrandGlyph size={16} />
        <span>graticule</span>
        <span aria-hidden="true">·</span>
        <span>Built by James Lorenz Santos</span>
        <span aria-hidden="true">·</span>
        <a href="https://agentjames.vercel.app" target="_blank" rel="noreferrer">
          agentjames.vercel.app
        </a>
        <span aria-hidden="true">·</span>
        <a href="https://github.com/jamessuuu/graticule" target="_blank" rel="noreferrer">
          source
        </a>
      </div>
    </footer>
  );
}
