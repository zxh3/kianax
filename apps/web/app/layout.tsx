import type { Metadata } from "next";

import "@kianax/ui/globals.css";

export const metadata: Metadata = {
  title: "kianax",
  description: "kianax",
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
