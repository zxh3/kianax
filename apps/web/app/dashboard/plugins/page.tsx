"use client";

import { useState, useMemo, useOptimistic, startTransition } from "react";
import { useMutation, useQuery } from "convex/react";
import { getPluginMetadata } from "@kianax/plugins";
import { api } from "@kianax/server/convex/_generated/api";
import { Button } from "@kianax/ui/components/button";
import { PluginCard } from "@/components/plugins/plugin-card";
import Link from "next/link";

export default function PluginsPage() {
  const [loadingPlugins, setLoadingPlugins] = useState<Set<string>>(new Set());

  const installedPlugins = useQuery(api.plugins.getUserPlugins) ?? [];
  const uninstallPlugin = useMutation(api.plugins.uninstallPlugin);
  const togglePlugin = useMutation(api.plugins.togglePlugin);

  // Optimistic state for plugin toggles
  const [optimisticPlugins, setOptimisticPlugins] = useOptimistic(
    installedPlugins,
    (state, { pluginId, enabled }: { pluginId: string; enabled: boolean }) => {
      return state.map((plugin) =>
        plugin.pluginId === pluginId ? { ...plugin, enabled } : plugin,
      );
    },
  );

  // Enrich installed plugins with metadata from the plugin registry
  const pluginsWithMetadata = useMemo(() => {
    return optimisticPlugins
      .map((installed) => {
        const metadata = getPluginMetadata(installed.pluginId);
        if (!metadata) {
          console.warn(`Plugin metadata not found for ${installed.pluginId}`);
          return null;
        }
        return {
          ...installed,
          metadata,
        };
      })
      .filter((p) => p !== null);
  }, [optimisticPlugins]);

  const handleUninstall = async (pluginId: string) => {
    setLoadingPlugins((prev) => new Set(prev).add(pluginId));
    try {
      await uninstallPlugin({ pluginId });
    } catch (error) {
      console.error("Failed to uninstall plugin:", error);
    } finally {
      setLoadingPlugins((prev) => {
        const next = new Set(prev);
        next.delete(pluginId);
        return next;
      });
    }
  };

  const handleToggle = async (pluginId: string, enabled: boolean) => {
    // Optimistically update the UI immediately within a transition
    startTransition(() => {
      setOptimisticPlugins({ pluginId, enabled });
    });

    try {
      await togglePlugin({ pluginId, enabled });
    } catch (error) {
      console.error("Failed to toggle plugin:", error);
      // Note: optimistic state will revert on next data refresh
    }
  };

  const handleConfigure = (pluginId: string) => {
    // TODO: Open configuration modal
    console.log("Configure plugin:", pluginId);
    alert("Plugin configuration coming soon!");
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-2">My Plugins</h1>
          <p className="text-muted-foreground">
            Manage your installed plugins and their configurations.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/marketplace">Browse Marketplace</Link>
        </Button>
      </div>

      {pluginsWithMetadata.length === 0 ? (
        <div className="rounded-lg border p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="text-4xl">🔌</div>
            <div>
              <h3 className="font-semibold text-lg mb-2">
                No plugins installed yet
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Install plugins from the marketplace to extend your routines
              </p>
              <Button asChild>
                <Link href="/dashboard/marketplace">Browse Marketplace</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pluginsWithMetadata.map((plugin) => {
            const isLoading = loadingPlugins.has(plugin.pluginId);

            return (
              <PluginCard
                key={plugin._id}
                plugin={plugin.metadata}
                isInstalled={true}
                isEnabled={plugin.enabled}
                loading={isLoading}
                onUninstall={() => handleUninstall(plugin.pluginId)}
                onToggle={(enabled: boolean) =>
                  handleToggle(plugin.pluginId, enabled)
                }
                onConfigure={() => handleConfigure(plugin.pluginId)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
