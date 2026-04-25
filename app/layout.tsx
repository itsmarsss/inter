import type { Metadata } from "next";
import "../src/styles/index.css";

export const metadata: Metadata = {
  title: "Marble Studio",
  description: "AI-assisted interior design workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
