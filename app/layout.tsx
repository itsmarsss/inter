import type { Metadata } from "next";
import { Bebas_Neue, IBM_Plex_Mono } from "next/font/google";
import "../src/styles/index.css";

// IBM Plex Mono — used for all chrome UI, labels, inputs, and numbers.
// Pairs with Bebas Neue for an architectural, blueprint-y feel matching the
// landing page.
const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plex-mono",
});

// Bebas Neue — condensed architectural display for panel titles & callouts.
const bebas = Bebas_Neue({
  weight: ["400"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-bebas",
});

export const metadata: Metadata = {
  title: "Marble Studio",
  description: "AI-assisted interior design workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${plexMono.variable} ${bebas.variable}`}>
      <body>{children}</body>
    </html>
  );
}
