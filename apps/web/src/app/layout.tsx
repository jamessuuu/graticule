import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

const description =
  "Paste your own short notes; graticule chunks and embeds them entirely on-device and draws a live, honestly-captioned map of how their wording relates — plus ranked search and a permanent demonstration of where the technique breaks. Nothing you paste ever leaves your browser tab.";

export const metadata: Metadata = {
  title: {
    default: "graticule — map your own notes, on-device",
    template: "%s · graticule",
  },
  description,
  metadataBase: new URL("https://graticule.vercel.app"),
  openGraph: {
    title: "graticule",
    description,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "graticule",
    description,
  },
};

// The site's author is the same Person entity agentjames publishes (one @id
// across every project), so engines can join the sites to one maker.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "graticule",
  url: "https://graticule-seven.vercel.app",
  author: {
    "@type": "Person",
    "@id": "https://agentjames.vercel.app/#person",
    name: "James Lorenz Santos",
    url: "https://agentjames.vercel.app",
    sameAs: [
      "https://www.linkedin.com/in/james-lorenz-santos-720776251/",
      "https://github.com/jamessuuu",
      "https://www.onlinejobs.ph/jobseekers/info/2766463",
      "https://ph.jobstreet.com/profiles/jameslorenz-santos-SXdpKyGqdK",
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="shell">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
