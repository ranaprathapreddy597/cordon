import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cordon — AI Agent Reliability Control Plane",
  description:
    "Trace every tool call, inject chaos, score reliability, and kill runaway spend. The open-source safety layer for AI agents.",
  keywords: ["AI agents", "observability", "chaos engineering", "FinOps", "reliability", "SRE"],
  openGraph: {
    title: "Cordon — AI Agent Reliability Control Plane",
    description: "The open-source safety layer for AI agents. Trace, test, and protect.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-grid bg-mesh">{children}</body>
    </html>
  );
}
