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
import type { PluginMetadata } from "@kianax/plugins";

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

const pluginTypeColors = {
  input: "outline",
  processor: "secondary",
  logic: "default",
  output: "destructive",
} as const;

const pluginTypeLabels = {
  input: "Input",
  processor: "Processor",
  logic: "Logic",
  output: "Output",
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
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="text-3xl">{plugin.icon || "🔌"}</div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg mb-2">{plugin.name}</CardTitle>
            <CardDescription className="line-clamp-2">
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

      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={pluginTypeColors[plugin.type]}>
            {pluginTypeLabels[plugin.type]}
          </Badge>
          {plugin.tags?.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        {plugin.author && (
          <div className="text-xs text-muted-foreground">
            by {plugin.author.name}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Version {plugin.version}
        </div>

        {isInstalled && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggle?.(!isEnabled)}
              disabled={loading}
            >
              {isEnabled ? "Disable" : "Enable"}
            </Button>
            {plugin.credentials && plugin.credentials.length > 0 && (
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
