import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "ShiftProof",
  description:
    "Complete recurring shift routines, capture proof, and track exceptions — for restaurants, cafés, and boutique hotels.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
