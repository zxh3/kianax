"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@kianax/ui/components/dialog";
import { Button } from "@kianax/ui/components/button";
import { getPluginConfigComponent } from "@kianax/plugins";

interface NodeConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  pluginId: string;
  pluginName: string;
  config?: any;
  onSave: (nodeId: string, config: any) => void;
}

/**
 * Generic Node Configuration Modal
 *
 * This component dynamically loads the appropriate config UI component
 * from the plugin registry based on the plugin ID.
 *
 * Plugin authors provide their config UI in their plugin package,
 * so this modal just acts as a wrapper.
 */
export function NodeConfigModal({
  isOpen,
  onClose,
  nodeId,
  pluginId,
  pluginName,
  config,
  onSave,
}: NodeConfigModalProps) {
  const [localConfig, setLocalConfig] = useState<any>(config || {});

  // Get the plugin's config component from the registry
  const ConfigComponent = getPluginConfigComponent(pluginId);

  const handleSave = () => {
    onSave(nodeId, localConfig);
    onClose();
  };

  // No config UI available for this plugin
  if (!ConfigComponent) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure {pluginName}</DialogTitle>
            <DialogDescription>
              This plugin does not require configuration, or configuration UI is
              not yet available.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={onClose}>Close</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure {pluginName}</DialogTitle>
          <DialogDescription>
            Set up the configuration for this plugin.
          </DialogDescription>
        </DialogHeader>

        {/* Dynamically render the plugin's config component */}
        <ConfigComponent value={localConfig} onChange={setLocalConfig} />

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Configuration</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
