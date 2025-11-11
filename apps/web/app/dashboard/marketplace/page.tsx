"use client";

import { useState, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { getAllPluginMetadata } from "@kianax/plugins";
import { api } from "@kianax/server/convex/_generated/api";
import { Input } from "@kianax/ui/components/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@kianax/ui/components/tabs";
import { PluginCard } from "@/components/plugins/plugin-card";
import type { PluginType } from "@kianax/plugin-sdk";

const allPlugins = getAllPluginMetadata();

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | PluginType>("all");
  const [loadingPlugins, setLoadingPlugins] = useState<Set<string>>(new Set());

  const installedPlugins = useQuery(api.plugins.getUserPlugins) ?? [];
  const installPlugin = useMutation(api.plugins.installPlugin);
  const uninstallPlugin = useMutation(api.plugins.uninstallPlugin);

  const installedPluginIds = useMemo(
    () => new Set(installedPlugins.map((p) => p.pluginId)),
    [installedPlugins],
  );

  const filteredPlugins = useMemo(() => {
    let filtered = allPlugins;

    // Filter by category (using tags)
    if (activeTab !== "all") {
      filtered = filtered.filter((p) => p.tags?.includes(activeTab));
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query) ||
          p.tags?.some((tag) => tag.toLowerCase().includes(query)),
      );
    }

    return filtered;
  }, [activeTab, searchQuery]);

  const handleInstall = async (pluginId: string, version: string) => {
    setLoadingPlugins((prev) => new Set(prev).add(pluginId));
    try {
      await installPlugin({ pluginId, version });
    } catch (error) {
      console.error("Failed to install plugin:", error);
    } finally {
      setLoadingPlugins((prev) => {
        const next = new Set(prev);
        next.delete(pluginId);
        return next;
      });
    }
  };

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

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Plugin Marketplace</h1>
        <p className="text-muted-foreground">
          Browse and install plugins to extend your routines.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Input
          type="search"
          placeholder="Search plugins..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="input">Inputs</TabsTrigger>
            <TabsTrigger value="processor">Processors</TabsTrigger>
            <TabsTrigger value="logic">Logic</TabsTrigger>
            <TabsTrigger value="output">Outputs</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {filteredPlugins.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No plugins found matching your search.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredPlugins.map((plugin) => {
                  const isInstalled = installedPluginIds.has(plugin.id);
                  const isLoading = loadingPlugins.has(plugin.id);

                  return (
                    <PluginCard
                      key={plugin.id}
                      plugin={plugin}
                      isInstalled={isInstalled}
                      loading={isLoading}
                      onInstall={() => handleInstall(plugin.id, plugin.version)}
                      onUninstall={() => handleUninstall(plugin.id)}
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
