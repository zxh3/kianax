"use client";

import { useId, useState, useEffect, useCallback, useMemo } from "react";
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
import { IconX, IconKey, IconDatabase } from "@tabler/icons-react";
import { toast } from "sonner";
import { useQuery } from "convex/react";
import { api } from "@kianax/server/convex/_generated/api";
import Link from "next/link";
import { useOptionalNodeExpressionContext } from "./routine-editor/expression-context";
import { ExpressionDataPicker } from "@kianax/ui/components/expression-data-picker";
import { buildExpressionContext } from "@kianax/ui/components/expression-input";

/**
 * Node execution state from test execution
 */
interface NodeExecutionState {
  nodeId: string;
  status: string;
  output?: unknown;
  error?: { message: string; stack?: string };
}

/**
 * Test execution data from Convex
 */
interface TestExecution {
  nodeStates: NodeExecutionState[];
  triggerData?: unknown;
  status: string;
}

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
  /** Test execution data for showing real values in expression preview */
  testExecution?: TestExecution | null;
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
  testExecution,
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

  // Get expression context for this node (variables + upstream nodes)
  // Returns undefined if not within ExpressionContextProvider
  const expressionContext = useOptionalNodeExpressionContext(nodeId);

  // Build execution results map from test execution
  const executionResults = useMemo(() => {
    if (!testExecution?.nodeStates) return undefined;

    const results: Record<string, unknown> = {};
    for (const state of testExecution.nodeStates) {
      // Only include completed nodes with output data
      if (state.status === "completed" && state.output !== undefined) {
        results[state.nodeId] = state.output;
      }
    }

    return Object.keys(results).length > 0 ? results : undefined;
  }, [testExecution]);

  // Merge execution results into expression context
  const enrichedContext = useMemo(() => {
    if (!expressionContext) return undefined;
    return {
      ...expressionContext,
      executionResults,
      triggerData: testExecution?.triggerData,
    };
  }, [expressionContext, executionResults, testExecution?.triggerData]);

  // Convert domain-specific context to generic tree format for data picker
  const uiContext = buildExpressionContext(enrichedContext);

  // Check if we have any data to show in the picker
  const hasExpressionData =
    expressionContext &&
    ((expressionContext.variables && expressionContext.variables.length > 0) ||
      (expressionContext.upstreamNodes &&
        expressionContext.upstreamNodes.length > 0) ||
      expressionContext.hasTrigger);

  // Handle click on data picker item - copy expression to clipboard
  const handleDataPickerSelect = useCallback((path: string) => {
    const expression = `{{ ${path} }}`;
    navigator.clipboard.writeText(expression).then(
      () => {
        toast.success("Expression copied", {
          description: expression,
        });
      },
      () => {
        toast.error("Failed to copy expression");
      },
    );
  }, []);

  const handleSave = () => {
    onSave(nodeId, localConfig, localLabel, localCredentialMappings);
    toast.success("Configuration saved");
  };

  const handleConfigChange = (newConfig: Record<string, unknown>) => {
    setLocalConfig(newConfig);
  };

  if (!isOpen) return null;

  // Use wider layout if we have expression data to show
  const drawerWidth = hasExpressionData ? "w-[640px]" : "w-96";

  return (
    <div
      className={`absolute top-2 right-2 bottom-2 ${drawerWidth} bg-background border border-border shadow-2xl rounded-xl flex flex-col z-50 overflow-hidden transition-all duration-300 contain-[paint] ${
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

      {/* Split Panel Content */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Panel: Data Browser (only shown when we have expression data) */}
        {hasExpressionData && uiContext && (
          <div className="w-56 border-r border-border flex flex-col min-h-0 bg-muted/20">
            <div className="px-3 py-2 border-b border-border flex items-center gap-2">
              <IconDatabase className="size-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                Data Browser
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2">
              <ExpressionDataPicker
                context={uiContext}
                onSelect={handleDataPickerSelect}
                draggable
                showSearch
                searchPlaceholder="Search..."
                maxHeight={9999}
                className="border-0 bg-transparent"
              />
            </div>
            <div className="px-3 py-2 border-t border-border">
              <p className="text-[10px] text-muted-foreground/70 leading-tight">
                Click to copy • Drag to insert
              </p>
            </div>
          </div>
        )}

        {/* Right Panel: Config Form */}
        <ScrollArea className="flex-1 min-h-0 w-full min-w-0">
          <div className="p-4 space-y-6 w-full min-w-0 overflow-hidden">
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
                Give this node a descriptive name to identify it in your
                routine.
              </p>
            </div>

            {/* Credential Selection Section */}
            {requirements.length > 0 && (
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
                expressionContext={enrichedContext}
              />
            ) : (
              <div className="text-sm text-muted-foreground py-8 text-center italic bg-muted/50 rounded-lg border border-dashed border-border">
                This plugin has no configuration options.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

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
