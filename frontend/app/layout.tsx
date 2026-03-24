import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cordon | Agent Reliability Control Plane",
  description:
    "Cordon is an agentic SRE and FinOps sandbox for tracing, chaos testing, and budget-aware AI deployments.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
