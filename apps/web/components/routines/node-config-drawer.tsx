"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@kianax/ui/components/sheet";
import { Button } from "@kianax/ui/components/button";
import { getPluginConfigComponent } from "@kianax/plugins";
import { ScrollArea } from "@kianax/ui/components/scroll-area";

interface NodeConfigDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  pluginId: string;
  pluginName: string;
  config?: any;
  onSave: (nodeId: string, config: any) => void;
}

/**
 * Node Configuration Drawer
 *
 * Displays the configuration UI for a selected node in a side drawer.
 * Replaces the modal-based configuration for better UX.
 */
export function NodeConfigDrawer({
  isOpen,
  onClose,
  nodeId,
  pluginId,
  pluginName,
  config,
  onSave,
}: NodeConfigDrawerProps) {
  const [localConfig, setLocalConfig] = useState<any>(config || {});

  // Reset local config when the node changes or drawer opens
  useEffect(() => {
    setLocalConfig(config || {});
  }, [config]);

  // Get the plugin's config component from the registry
  const ConfigComponent = getPluginConfigComponent(pluginId);

  const handleSave = () => {
    onSave(nodeId, localConfig);
    // We don't necessarily need to close on save if we want "live" updates or
    // allow the user to keep editing, but standard pattern is often save & close
    // or auto-save. For now, let's keep it manual save but maybe keep open?
    // The prompt implied "focus", so maybe it stays open while focused.
    // But sticking to the "Save" button pattern for now to match previous behavior.
    toast.success("Configuration saved");
  };

  // Auto-save wrapper if we wanted to implement live preview later
  const handleConfigChange = (newConfig: any) => {
    setLocalConfig(newConfig);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>Configure {pluginName}</SheetTitle>
          <SheetDescription>
            Adjust the settings for this node.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-6">
          {ConfigComponent ? (
            <div className="pb-6">
              <ConfigComponent
                value={localConfig}
                onChange={handleConfigChange}
              />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-4">
              This plugin does not require configuration or has no settings
              available.
            </div>
          )}
        </ScrollArea>

        <div className="p-6 border-t bg-gray-50/50 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {ConfigComponent && (
            <Button onClick={handleSave}>Save Changes</Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

import { toast } from "sonner";
