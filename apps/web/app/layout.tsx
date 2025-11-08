import type { Metadata } from "next";

import "@kianax/ui/globals.css";
import { ConvexClientProvider } from "@kianax/web/components/providers/ConvexClientProvider";

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
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
