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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
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
