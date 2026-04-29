import type { Metadata } from "next";
import "../src/styles/index.css";

export const metadata: Metadata = {
  title: "INTER",
  description: "INTER — AI-assisted interior design workspace.",
  icons: {
    icon: "/inter-logo.png",
    apple: "/inter-logo.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
