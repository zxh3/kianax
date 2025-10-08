import type { Metadata } from "next";

import "@kianax/ui/globals.css";

export const metadata: Metadata = {
  title: "KianaX",
  description: "KianaX",
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
