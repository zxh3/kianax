"use client";

import { Badge } from "@kianax/ui/components/badge";
import { Button } from "@kianax/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@kianax/ui/components/card";
import { Switch } from "@kianax/ui/components/switch";
import { Label } from "@kianax/ui/components/label";
import type { PluginMetadata } from "@kianax/plugins";
import { categorizePlugin } from "@/lib/plugins";

interface PluginCardProps {
  plugin: PluginMetadata;
  isInstalled?: boolean;
  isEnabled?: boolean;
  onInstall?: () => void;
  onUninstall?: () => void;
  onToggle?: (enabled: boolean) => void;
  onConfigure?: () => void;
  loading?: boolean;
}

const categoryLabels = {
  input: "Data Source",
  processor: "Processor",
  logic: "Logic",
  action: "Action",
} as const;

export function PluginCard({
  plugin,
  isInstalled = false,
  isEnabled = false,
  onInstall,
  onUninstall,
  onToggle,
  onConfigure,
  loading = false,
}: PluginCardProps) {
  const category = categorizePlugin(plugin);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-2">
          <div className="text-2xl">{plugin.icon || "🔌"}</div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base mb-1">{plugin.name}</CardTitle>
            <CardDescription className="text-xs line-clamp-2">
              {plugin.description}
            </CardDescription>
          </div>
        </div>
        <CardAction>
          {isInstalled ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onUninstall}
              disabled={loading}
            >
              Uninstall
            </Button>
          ) : (
            <Button size="sm" onClick={onInstall} disabled={loading}>
              Install
            </Button>
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="pt-0 space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <Badge variant="outline" className="font-normal">
            {categoryLabels[category]}
          </Badge>
          {plugin.tags?.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="outline" className="font-normal">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {plugin.author && <span>by {plugin.author.name}</span>}
          <span>Version {plugin.version}</span>
        </div>

        {isInstalled && (onToggle || onConfigure) && (
          <div className="flex items-center justify-between pt-2 border-t">
            {onToggle && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={isEnabled}
                  onCheckedChange={onToggle}
                  disabled={loading}
                  id={`plugin-${plugin.id}-enabled`}
                />
                <Label
                  htmlFor={`plugin-${plugin.id}-enabled`}
                  className="text-xs font-normal cursor-pointer"
                >
                  Enabled
                </Label>
              </div>
            )}
            {plugin.credentials &&
              plugin.credentials.length > 0 &&
              onConfigure && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onConfigure}
                  disabled={loading}
                >
                  Configure
                </Button>
              )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
