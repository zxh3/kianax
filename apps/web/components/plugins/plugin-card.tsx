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
import { categorizePlugin } from "@/lib/plugins";

interface PluginCardProps {
  plugin: PluginMetadata;
  onConfigure?: () => void;
}

const categoryLabels = {
  input: "Data Source",
  processor: "Processor",
  logic: "Logic",
  action: "Action",
} as const;

export function PluginCard({ plugin, onConfigure }: PluginCardProps) {
  const category = categorizePlugin(plugin);
  const hasCredentials = plugin.credentials && plugin.credentials.length > 0;

  return (
    <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
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
        {hasCredentials && onConfigure && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={onConfigure}>
              Configure
            </Button>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="pt-0 space-y-2 flex-1 flex flex-col justify-end">
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

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t mt-2">
          {plugin.author && <span>by {plugin.author.name}</span>}
          <span>v{plugin.version}</span>
        </div>
      </CardContent>
    </Card>
  );
}
