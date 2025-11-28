"use client";

import { useState, useEffect, useMemo, useCallback, useId } from "react";
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
import { ScrollArea } from "@kianax/ui/components/scroll-area";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@kianax/ui/components/tabs";
import { Badge } from "@kianax/ui/components/badge";
import {
  IconX,
  IconKey,
  IconSettings,
  IconActivity,
  IconCheck,
  IconAlertTriangle,
  IconLoader2,
  IconClock,
  IconDatabase,
} from "@tabler/icons-react";
import { toast } from "sonner";
import Link from "next/link";
import { format } from "date-fns";
import { useQuery } from "convex/react";
import { api } from "@kianax/server/convex/_generated/api";
import { getPluginConfigComponent, getPluginMetadata } from "@kianax/plugins";
import { useOptionalNodeExpressionContext } from "./expression-context";
import { ExpressionDataPicker } from "@kianax/ui/components/expression-data-picker";
import { buildExpressionContext } from "@kianax/ui/components/expression-input";
import { motion } from "motion/react";

// --- Types ---

interface NodeExecutionState {
  nodeId: string;
  status: string;
  output?: unknown;
  error?: { message: string; stack?: string };
  startedAt?: number;
  completedAt?: number;
}

interface TestExecution {
  nodeStates: NodeExecutionState[];
  triggerData?: unknown;
  status: string;
}

interface NodeInspectorProps {
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
  onClose: () => void;
  testExecution?: TestExecution | null;
  defaultTab?: "config" | "result";
  hasUnsavedChanges: boolean;
}

// --- Helper Functions ---

const formatDuration = (start?: number, end?: number) => {
  if (!start) return "-";
  const endTime = end || Date.now();
  const ms = endTime - start;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

export function NodeInspector({
  nodeId,
  pluginId,
  pluginName,
  nodeLabel,
  config,
  credentialMappings,
  onSave,
  onClose,
  testExecution,
  defaultTab = "config",
  hasUnsavedChanges,
}: NodeInspectorProps) {
  const [activeTab, setActiveTab] = useState<"config" | "result">(defaultTab);

  // Reset tab when defaultTab or nodeId changes
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // --- Config State & Logic ---
  const nodeLabelInputId = useId();
  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>(
    config || {},
  );
  const [localLabel, setLocalLabel] = useState<string>(nodeLabel);
  const [localCredentialMappings, setLocalCredentialMappings] = useState<
    Record<string, string>
  >(credentialMappings || {});

  // Sync local state with props
  useEffect(() => {
    setLocalConfig(config || {});
    setLocalLabel(nodeLabel);
    setLocalCredentialMappings(credentialMappings || {});
  }, [config, nodeLabel, credentialMappings]);

  const metadata = getPluginMetadata(pluginId);
  const requirements = metadata?.credentialRequirements || [];
  const userCredentials = useQuery(api.credentials.list);
  const ConfigComponent = getPluginConfigComponent(pluginId);

  const handleSave = () => {
    try {
      onSave(nodeId, localConfig, localLabel, localCredentialMappings);
      toast.success("Configuration updated");
    } catch (error) {
      console.error("Failed to save configuration:", error);
      toast.error("Failed to save configuration");
    }
  };

  // --- Expression Context Logic ---
  const expressionContext = useOptionalNodeExpressionContext(nodeId);

  const executionResults = useMemo(() => {
    if (!testExecution?.nodeStates) return undefined;
    const results: Record<string, unknown> = {};
    for (const state of testExecution.nodeStates) {
      if (state.status === "completed" && state.output !== undefined) {
        results[state.nodeId] = state.output;
      }
    }
    return Object.keys(results).length > 0 ? results : undefined;
  }, [testExecution]);

  const enrichedContext = useMemo(() => {
    if (!expressionContext) return undefined;
    return {
      ...expressionContext,
      executionResults,
      triggerData: testExecution?.triggerData,
    };
  }, [expressionContext, executionResults, testExecution?.triggerData]);

  const uiContext = buildExpressionContext(enrichedContext);
  const hasExpressionData =
    expressionContext &&
    ((expressionContext.variables && expressionContext.variables.length > 0) ||
      (expressionContext.upstreamNodes &&
        expressionContext.upstreamNodes.length > 0) ||
      expressionContext.hasTrigger);

  const handleDataPickerSelect = useCallback((path: string) => {
    const expression = `{{ ${path} }}`;
    navigator.clipboard.writeText(expression).then(
      () => toast.success("Expression copied", { description: expression }),
      () => toast.error("Failed to copy expression"),
    );
  }, []);

  // --- Execution Result Logic ---
  const executionState = useMemo(() => {
    if (!testExecution?.nodeStates) return null;
    const states = testExecution.nodeStates.filter((s) => s.nodeId === nodeId);
    return states.length > 0 ? states[states.length - 1] : null;
  }, [testExecution, nodeId]);

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col h-[calc(100vh-100px)] w-full bg-background border-l border-border"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="overflow-hidden">
          <h3 className="font-semibold text-sm text-foreground truncate">
            {pluginName}
          </h3>
          <p className="text-xs text-muted-foreground truncate">{nodeLabel}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
          >
            <IconX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="px-4 pt-2">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="config" className="text-xs">
              <IconSettings className="mr-1.5 size-3.5" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="result" className="text-xs">
              <IconActivity className="mr-1.5 size-3.5" />
              Run Result
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Configuration Tab */}
        <TabsContent
          value="config"
          className="flex-1 flex flex-col min-h-0 m-0 pt-2"
        >
          <div className="flex-1 flex flex-row min-h-0">
            {/* Left Data Picker Panel */}
            {hasExpressionData && uiContext && (
              <div className="w-[280px] border-r border-border flex flex-col bg-muted/5">
                <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 flex-shrink-0">
                  <IconDatabase className="size-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">Available Data</span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-2">
                  <ExpressionDataPicker
                    context={uiContext}
                    onSelect={handleDataPickerSelect}
                    draggable
                    showSearch
                    searchPlaceholder="Search variables..."
                    maxHeight={9999}
                    className="border-0 bg-transparent"
                  />
                </div>
                <div className="px-3 py-1.5 border-t border-border bg-muted/20 flex-shrink-0">
                  <p className="text-[10px] text-muted-foreground">
                    Click to copy • Drag to input fields
                  </p>
                </div>
              </div>
            )}

            {/* Right Config Form Panel */}
            <ScrollArea className="flex-1 h-full">
              <div className="p-4 space-y-6">
                {/* Node Label */}
                <div className="space-y-2">
                  <Label htmlFor="node-label" className="text-sm font-medium">
                    Node Label
                  </Label>
                  <Input
                    id={nodeLabelInputId}
                    value={localLabel}
                    onChange={(e) => setLocalLabel(e.target.value)}
                    className="font-medium"
                  />
                </div>

                {/* Credentials */}
                {requirements.length > 0 && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <IconKey className="size-4 text-muted-foreground" />
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
                    {requirements.map((req) => {
                      const key = req.alias || req.id;
                      const compatibleCredentials =
                        userCredentials?.filter((c) => c.typeId === req.id) ||
                        [];
                      return (
                        <div key={key} className="space-y-1.5">
                          <Label className="text-xs font-medium flex gap-1">
                            {req.alias || req.id}{" "}
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
                                  No compatible credentials
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="h-px bg-border" />

                {/* Plugin Config Form */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Settings</h4>
                  {ConfigComponent ? (
                    <ConfigComponent
                      value={localConfig}
                      onChange={setLocalConfig}
                      expressionContext={enrichedContext}
                    />
                  ) : (
                    <div className="text-sm text-muted-foreground py-8 text-center italic bg-muted/20 rounded-lg border border-dashed">
                      No configuration needed.
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Footer Action */}
          <div className="p-4 border-t border-border bg-muted/10 flex justify-end gap-2">
            <Button size="sm" onClick={handleSave} disabled={hasUnsavedChanges}>
              Save Changes
            </Button>
          </div>
        </TabsContent>

        {/* Run Result Tab */}
        <TabsContent
          value="result"
          className="flex-1 min-h-0 m-0 overflow-hidden"
        >
          <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
              {!executionState ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                  <div className="size-12 rounded-full bg-muted flex items-center justify-center">
                    <IconActivity className="size-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">No Run Data</p>
                    <p className="text-xs text-muted-foreground max-w-[200px]">
                      Run a test to see execution results for this node.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Status Badge */}
                  <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg border border-border">
                    <span className="text-sm font-medium">Status</span>
                    <Badge
                      variant="outline"
                      className={`capitalize ${
                        executionState.status === "running"
                          ? "border-blue-500/50 text-blue-600 bg-blue-500/10"
                          : executionState.status === "completed"
                            ? "border-emerald-500/50 text-emerald-600 bg-emerald-500/10"
                            : executionState.status === "failed"
                              ? "border-destructive/50 text-destructive bg-destructive/10"
                              : ""
                      }`}
                    >
                      {executionState.status}
                    </Badge>
                  </div>

                  {/* Timing Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 p-3 rounded-lg border border-border">
                      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <IconClock className="size-3" /> Duration
                      </div>
                      <div className="font-mono text-sm font-medium">
                        {formatDuration(
                          executionState.startedAt,
                          executionState.completedAt,
                        )}
                      </div>
                    </div>
                    <div className="bg-muted/30 p-3 rounded-lg border border-border">
                      <div className="text-xs text-muted-foreground mb-1">
                        Started
                      </div>
                      <div className="font-mono text-sm font-medium truncate">
                        {executionState.startedAt
                          ? format(
                              new Date(executionState.startedAt),
                              "HH:mm:ss.SSS",
                            )
                          : "-"}
                      </div>
                    </div>
                  </div>

                  {/* Error Display */}
                  {executionState.error && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-destructive uppercase tracking-wider flex items-center gap-2">
                        <IconAlertTriangle className="size-3" /> Error
                      </div>
                      <div className="bg-destructive/10 text-destructive rounded-lg border border-destructive/20 overflow-hidden text-xs">
                        <div className="p-3 font-semibold break-words">
                          {executionState.error.message}
                        </div>
                        {executionState.error.stack && (
                          <div className="border-t border-destructive/20 p-3 bg-destructive/5 font-mono whitespace-pre-wrap opacity-80 overflow-x-auto max-h-40">
                            {executionState.error.stack}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Output Display */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      {executionState.status === "running" ? (
                        <IconLoader2 className="size-3 animate-spin" />
                      ) : (
                        <IconCheck className="size-3" />
                      )}
                      Output
                    </div>
                    {executionState.output !== undefined ? (
                      <pre className="bg-muted text-foreground p-3 rounded-lg text-xs font-mono overflow-x-auto border border-border leading-relaxed">
                        {JSON.stringify(executionState.output, null, 2)}
                      </pre>
                    ) : (
                      <div className="text-sm text-muted-foreground italic py-4 text-center border border-dashed border-border rounded-lg bg-muted/20">
                        No output generated
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
