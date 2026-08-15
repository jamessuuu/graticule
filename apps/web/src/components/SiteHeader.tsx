"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./BrandMark";

const NAV = [
  { href: "/", label: "map" },
  { href: "/coverage", label: "coverage" },
  { href: "/limits", label: "limits" },
  { href: "/methodology", label: "methodology" },
  { href: "/docs", label: "docs" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="shell">
        <nav aria-label="Primary">
          <Link href="/" aria-label="graticule home">
            <BrandMark />
          </Link>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
