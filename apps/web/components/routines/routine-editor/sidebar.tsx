"use client";

import { useMemo, useState } from "react";
import { Input } from "@kianax/ui/components/input";
import { ScrollArea } from "@kianax/ui/components/scroll-area";
import { IconSearch, IconX } from "@tabler/icons-react";
import { cn } from "@kianax/ui/lib/utils";
import { getAllPlugins } from "@/lib/plugins";
import type { PluginMetadata } from "@kianax/plugin-sdk";
import { Button } from "@kianax/ui/components/button";

interface NodeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNode: (pluginId: string, pluginName: string) => void;
}

export function NodeSelector({
  isOpen,
  onClose,
  onAddNode,
}: NodeSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const availablePlugins = useMemo(() => getAllPlugins(), []);

  // Filter plugins based on search query
  const filteredPlugins = useMemo(() => {
    if (!searchQuery.trim()) return availablePlugins;
    const query = searchQuery.toLowerCase();
    return availablePlugins.filter(
      (plugin) =>
        plugin.name.toLowerCase().includes(query) ||
        plugin.description?.toLowerCase().includes(query) ||
        plugin.tags?.some((tag) => tag.toLowerCase().includes(query)),
    );
  }, [availablePlugins, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="absolute left-16 top-1/2 -translate-y-1/2 z-10 w-72 rounded-lg border bg-background shadow-xl flex flex-col max-h-[500px]">
      <div className="flex items-center justify-between border-b px-3 py-2 shrink-0">
        <h3 className="font-semibold text-xs">Add Node</h3>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={onClose}
        >
          <IconX className="size-3.5" />
        </Button>
      </div>

      <div className="p-2 border-b shrink-0">
        <div className="relative">
          <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-1.5 space-y-0.5">
          {filteredPlugins.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              No nodes found
            </p>
          ) : (
            filteredPlugins.map((plugin) => (
              <NodeItem
                key={plugin.id}
                plugin={plugin}
                onClick={() => {
                  onAddNode(plugin.id, plugin.name);
                  onClose();
                }}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface NodeItemProps {
  plugin: PluginMetadata;
  onClick: () => void;
}

function NodeItem({ plugin, onClick }: NodeItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs",
        "hover:bg-accent transition-colors text-left",
      )}
    >
      <span className="text-base shrink-0">{plugin.icon}</span>
      <span className="font-medium truncate">{plugin.name}</span>
    </button>
  );
}
