import type { Metadata } from "next";
import { ConvexClientProvider } from "../components/providers/ConvexClientProvider";
import { ThemeProvider } from "../components/providers/theme-provider";

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
    <html lang="en" suppressHydrationWarning>
      <body>
        <ConvexClientProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
