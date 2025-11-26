"use client";

import { useId, useState } from "react";
import { Button } from "@kianax/ui/components/button";
import { Input } from "@kianax/ui/components/input";
import { Label } from "@kianax/ui/components/label";
import { getPluginConfigComponent } from "@kianax/plugins";
import { ScrollArea } from "@kianax/ui/components/scroll-area";
import { IconX } from "@tabler/icons-react";
import { toast } from "sonner";

interface NodeConfigDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  pluginId: string;
  pluginName: string;
  nodeLabel: string;
  config?: Record<string, unknown>;
  onSave: (
    nodeId: string,
    config: Record<string, unknown>,
    label: string,
  ) => void;
}

/**
 * Node Configuration Panel
 *
 * Displays the configuration UI for a selected node as a floating panel
 * within the editor canvas. Allows interaction with the canvas while open.
 */
export function NodeConfigDrawer({
  isOpen,
  onClose,
  nodeId,
  pluginId,
  pluginName,
  nodeLabel,
  config,
  onSave,
}: NodeConfigDrawerProps) {
  const nodeLabelInputId = useId();

  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>(
    config || {},
  );
  const [localLabel, setLocalLabel] = useState<string>(nodeLabel);

  // Get the plugin's config component from the registry
  const ConfigComponent = getPluginConfigComponent(pluginId);

  const handleSave = () => {
    onSave(nodeId, localConfig, localLabel);
    toast.success("Configuration saved");
  };

  const handleConfigChange = (newConfig: Record<string, unknown>) => {
    setLocalConfig(newConfig);
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-2 right-2 bottom-2 w-96 bg-background border border-border shadow-2xl rounded-xl flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div>
          <h3 className="font-semibold text-sm text-foreground">
            Configure {pluginName}
          </h3>
          <p className="text-xs text-muted-foreground">Node Settings</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
        >
          <IconX className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-6">
          {/* Node Label Section */}
          <div className="space-y-2">
            <Label htmlFor="node-label" className="text-sm font-medium">
              Node Label
            </Label>
            <Input
              id={nodeLabelInputId}
              value={localLabel}
              onChange={(e) => setLocalLabel(e.target.value)}
              placeholder="Enter node name..."
              className="font-medium"
            />
            <p className="text-xs text-muted-foreground">
              Give this node a descriptive name to identify it in your routine.
            </p>
          </div>

          {/* Divider */}
          {ConfigComponent && (
            <div className="border-t border-border pt-6">
              <h4 className="text-sm font-semibold text-foreground mb-4">
                Plugin Configuration
              </h4>
            </div>
          )}

          {/* Plugin Config */}
          {ConfigComponent ? (
            <ConfigComponent
              value={localConfig}
              onChange={handleConfigChange}
            />
          ) : (
            <div className="text-sm text-muted-foreground py-8 text-center italic bg-muted/50 rounded-lg border border-dashed border-border">
              This plugin has no configuration options.
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-border bg-muted/30 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}
