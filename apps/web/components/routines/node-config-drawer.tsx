"use client";

import { useId, useState, useEffect } from "react";
import { Button } from "@kianax/ui/components/button";
import { Input } from "@kianax/ui/components/input";
import { Label } from "@kianax/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kianax/ui/components/select";
import { getPluginConfigComponent, getPluginMetadata } from "@kianax/plugins";
import { ScrollArea } from "@kianax/ui/components/scroll-area";
import { IconX, IconKey } from "@tabler/icons-react";
import { toast } from "sonner";
import { useQuery } from "convex/react";
import { api } from "@kianax/server/convex/_generated/api";
import Link from "next/link";

interface NodeConfigDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  pluginId: string;
  pluginName: string;
  nodeLabel: string;
  config?: Record<string, unknown>;
  credentialMappings?: Record<string, string>;
  onSave: (
    nodeId: string,
    config: Record<string, unknown>,
    label: string,
    credentialMappings?: Record<string, string>,
  ) => void;
  className?: string;
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
  credentialMappings,
  onSave,
  className,
}: NodeConfigDrawerProps) {
  const nodeLabelInputId = useId();

  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>(
    config || {},
  );
  const [localLabel, setLocalLabel] = useState<string>(nodeLabel);
  const [localCredentialMappings, setLocalCredentialMappings] = useState<
    Record<string, string>
  >(credentialMappings || {});

  // Get plugin metadata to check for credential requirements
  const metadata = getPluginMetadata(pluginId);
  const requirements = metadata?.credentialRequirements || [];

  // Fetch user's credentials if requirements exist
  const userCredentials = useQuery(api.credentials.list);

  // Update local state when props change (re-opening drawer or changing node)
  useEffect(() => {
    if (isOpen) {
      setLocalConfig(config || {});
      setLocalLabel(nodeLabel);
      setLocalCredentialMappings(credentialMappings || {});
    }
  }, [isOpen, config, nodeLabel, credentialMappings]);

  // Get the plugin's config component from the registry
  const ConfigComponent = getPluginConfigComponent(pluginId);

  const handleSave = () => {
    onSave(nodeId, localConfig, localLabel, localCredentialMappings);
    toast.success("Configuration saved");
  };

  const handleConfigChange = (newConfig: Record<string, unknown>) => {
    setLocalConfig(newConfig);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`absolute top-2 right-2 bottom-2 w-96 bg-background border border-border shadow-2xl rounded-xl flex flex-col z-50 overflow-hidden transition-all duration-300 ${
        className || ""
      }`}
    >
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

          {/* Credential Selection Section */}
          {requirements.length > 0 && (
            <>
              <div className="border-t border-border pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <IconKey className="size-4" />
                    Credentials
                  </h4>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    asChild
                  >
                    <Link
                      href="/dashboard/settings/credentials"
                      target="_blank"
                    >
                      Manage
                    </Link>
                  </Button>
                </div>
                <div className="space-y-4">
                  {requirements.map((req) => {
                    const key = req.alias || req.id;
                    // Filter user credentials that match the required type ID
                    const compatibleCredentials =
                      userCredentials?.filter((c) => c.typeId === req.id) || [];

                    return (
                      <div key={key} className="space-y-2">
                        <Label className="text-xs font-medium flex gap-1">
                          {req.alias || req.id}
                          {req.required !== false && (
                            <span className="text-destructive">*</span>
                          )}
                        </Label>
                        <Select
                          value={localCredentialMappings[key] || ""}
                          onValueChange={(value) =>
                            setLocalCredentialMappings((prev) => ({
                              ...prev,
                              [key]: value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select credential..." />
                          </SelectTrigger>
                          <SelectContent>
                            {compatibleCredentials.length > 0 ? (
                              compatibleCredentials.map((cred) => (
                                <SelectItem key={cred._id} value={cred._id}>
                                  {cred.name}
                                </SelectItem>
                              ))
                            ) : (
                              <div className="p-2 text-xs text-muted-foreground text-center">
                                No compatible credentials found.
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

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
