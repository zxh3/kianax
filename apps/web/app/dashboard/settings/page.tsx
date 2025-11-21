"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useQuery, useMutation } from "convex/react";
import { api } from "@kianax/server/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kianax/ui/components/select";
import { Label } from "@kianax/ui/components/label";
import { IconMoon, IconSun, IconDeviceDesktop } from "@tabler/icons-react";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { data: session } = authClient.useSession();

  const userSettings = useQuery(api.settings.get, session ? {} : "skip");

  const updateTheme = useMutation(api.settings.updateTheme);

  // Sync theme from DB on load
  useEffect(() => {
    if (userSettings?.theme && userSettings.theme !== theme) {
      setTheme(userSettings.theme);
    }
  }, [userSettings, setTheme, theme]);

  const handleThemeChange = async (value: string) => {
    const newTheme = value as "light" | "dark" | "system";
    setTheme(newTheme);

    if (session) {
      await updateTheme({
        theme: newTheme,
      });
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 max-w-4xl">
      <div className="grid gap-6">
        {/* Appearance */}
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <h3 className="font-semibold leading-none tracking-tight">
              Appearance
            </h3>
            <p className="text-sm text-muted-foreground">
              Customize how Kiana X looks on your device.
            </p>
          </div>
          <div className="p-6 pt-0">
            <div className="space-y-2 max-w-sm">
              <Label>Theme</Label>
              <Select value={theme} onValueChange={handleThemeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <IconSun className="size-4 text-muted-foreground" />
                      <span>Light</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <IconMoon className="size-4 text-muted-foreground" />
                      <span>Dark</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <IconDeviceDesktop className="size-4 text-muted-foreground" />
                      <span>System</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[0.8rem] text-muted-foreground">
                Select your preferred theme. System will match your OS settings.
              </p>
            </div>
          </div>
        </div>

        {/* Account (Placeholder) */}
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <h3 className="font-semibold leading-none tracking-tight">
              Account
            </h3>
            <p className="text-sm text-muted-foreground">
              Manage your account details.
            </p>
          </div>
          <div className="p-6 pt-0">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium">
                {session?.user?.name?.charAt(0) || "?"}
              </div>
              <div>
                <p className="font-medium">{session?.user?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {session?.user?.email}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
