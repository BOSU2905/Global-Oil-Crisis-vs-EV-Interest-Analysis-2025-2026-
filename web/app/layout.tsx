import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "../src/components/layout/AppShell.tsx";

import "./globals.css";

/**
 * Product identity is fixed by docs/product-architecture.md §8. It names the
 * data, the scope and the period, and asserts no finding -- branding must not
 * claim a relationship the analysis does not support.
 */
export const metadata: Metadata = {
  title: "Global Oil Crisis vs EV Interest Analysis — 2026",
  description:
    "An interactive analysis of Brent crude prices and electric-car search interest " +
    "across five markets, 2025–2026.",
};

/**
 * Root layout: the document, and nothing else.
 *
 * Everything that was inlined here in step 1 — the skip link, the header and the
 * footer — now lives in `AppShell` and the components it composes. The rule is
 * that this file describes the HTML document; the shell describes the product.
 * Step 1 deliberately inlined a rudimentary header and footer, and step 3's job
 * was to extract them rather than let this file keep growing.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
