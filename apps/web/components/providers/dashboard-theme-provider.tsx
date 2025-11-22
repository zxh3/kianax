"use client";

import { useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { useTheme } from "next-themes";
import { api } from "@kianax/server/convex/_generated/api";
import { ThemeProvider } from "./theme-provider";

interface DashboardThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Inner component that syncs theme with user settings
 * Must be inside ThemeProvider to access useTheme
 */
function ThemeSync() {
  const { theme, setTheme } = useTheme();
  const userSettings = useQuery(api.settings.get);
  const updateTheme = useMutation(api.settings.updateTheme);
  const lastServerThemeRef = useRef<string | null>(null);

  useEffect(() => {
    const serverTheme = userSettings?.theme;

    // Load from server on initial mount or when server value changes
    if (serverTheme && serverTheme !== lastServerThemeRef.current) {
      lastServerThemeRef.current = serverTheme;
      if (serverTheme !== theme) {
        setTheme(serverTheme);
      }
      return;
    }

    // Save to server when local theme changes (and differs from server)
    if (
      theme &&
      lastServerThemeRef.current !== null &&
      theme !== lastServerThemeRef.current &&
      (theme === "light" || theme === "dark" || theme === "system")
    ) {
      lastServerThemeRef.current = theme;
      updateTheme({ theme });
    }
  }, [theme, userSettings?.theme, setTheme, updateTheme]);

  return null;
}

/**
 * Dashboard Theme Provider
 * Wraps the application with theme support and syncs with user settings
 */
export function DashboardThemeProvider({
  children,
}: DashboardThemeProviderProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeSync />
      {children}
    </ThemeProvider>
  );
}
