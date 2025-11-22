"use client";

import { useState } from "react";
import { getAllPluginMetadata } from "@kianax/plugins";
import { Input } from "@kianax/ui/components/input";
import { PluginCard } from "@/components/plugins/plugin-card";

const allPlugins = getAllPluginMetadata();

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPlugins = allPlugins.filter(
    (plugin) =>
      plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Marketplace</h1>
        <p className="text-muted-foreground">
          Browse available plugins to extend your routines. All plugins are
          ready to use.
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

        {filteredPlugins.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No plugins found matching your search.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredPlugins.map((plugin) => (
              <PluginCard key={plugin.id} plugin={plugin} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
