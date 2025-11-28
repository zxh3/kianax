import { memo, useMemo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "motion/react";
import {
  getPluginInputs,
  getPluginOutputs,
  getPluginMetadata,
} from "@/lib/plugins";
import { cn } from "@kianax/ui/lib/utils";

export interface PluginNodeData extends Record<string, unknown> {
  label: string;
  pluginId: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  credentialMappings?: Record<string, string>;
  executionStatus?: "running" | "completed" | "failed" | "pending";
  onConfigure?: (nodeId: string) => void;
}

function PluginNode({ data, selected }: NodeProps) {
  const nodeData = data as PluginNodeData;

  // Get plugin metadata and ports
  const metadata = useMemo(
    () => getPluginMetadata(nodeData.pluginId),
    [nodeData.pluginId],
  );
  const inputs = useMemo(
    () => getPluginInputs(nodeData.pluginId),
    [nodeData.pluginId],
  );
  const outputs = useMemo(
    () => getPluginOutputs(nodeData.pluginId),
    [nodeData.pluginId],
  );

  const inputPorts = Object.values(inputs);
  const outputPorts = Object.values(outputs);

  // Determine border/ring styles based on execution status or selection
  const statusClasses = cn(
    // Base classes
    "relative bg-card border rounded-xl min-w-[280px] transition-all duration-200 group",

    // Execution status effects
    nodeData.executionStatus === "running" && "animate-pulse",

    // Status Borders
    nodeData.executionStatus === "running"
      ? "border-blue-500"
      : nodeData.executionStatus === "completed"
        ? "border-green-500 shadow-sm"
        : nodeData.executionStatus === "failed"
          ? "border-destructive"
          : "border-border shadow-sm hover:border-ring",
  );

  return (
    <div className={statusClasses}>
      {/* Selection Indicators (Crosshair corners) */}
      {selected && (
        <>
          <motion.div
            initial={{ opacity: 0, x: -10, y: -10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.3, ease: "backOut" }}
            className="absolute -top-2 -left-2 w-4 h-4 border-t-[3px] border-l-[3px] border-primary rounded-tl-xl shadow-[0_0_8px_rgba(var(--primary)_/_0.5)]"
          />
          <motion.div
            initial={{ opacity: 0, x: 10, y: -10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.3, ease: "backOut" }}
            className="absolute -top-2 -right-2 w-4 h-4 border-t-[3px] border-r-[3px] border-primary rounded-tr-xl shadow-[0_0_8px_rgba(var(--primary)_/_0.5)]"
          />
          <motion.div
            initial={{ opacity: 0, x: -10, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.3, ease: "backOut" }}
            className="absolute -bottom-2 -left-2 w-4 h-4 border-b-[3px] border-l-[3px] border-primary rounded-bl-xl shadow-[0_0_8px_rgba(var(--primary)_/_0.5)]"
          />
          <motion.div
            initial={{ opacity: 0, x: 10, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.3, ease: "backOut" }}
            className="absolute -bottom-2 -right-2 w-4 h-4 border-b-[3px] border-r-[3px] border-primary rounded-br-xl shadow-[0_0_8px_rgba(var(--primary)_/_0.5)]"
          />
        </>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-linear-to-b from-card to-muted/20 rounded-t-xl">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg border shadow-sm",
              selected
                ? "bg-primary/10 border-primary/20 text-primary"
                : "bg-background border-border text-muted-foreground",
            )}
          >
            {metadata?.icon ? (
              <div className="text-lg">{metadata.icon}</div>
            ) : (
              <div className="w-4 h-4 bg-muted rounded-full" />
            )}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-semibold text-sm text-card-foreground truncate leading-tight">
              {nodeData.label}
            </span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate">
              {metadata?.name || "Plugin"}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-0">
        {inputPorts.length > 0 || outputPorts.length > 0 ? (
          <div className="flex flex-col py-3 gap-1">
            {Array.from({
              length: Math.max(inputPorts.length, outputPorts.length),
            }).map((_, i) => (
              <div
                key={i}
                className="relative grid grid-cols-2 h-8 items-center"
              >
                {/* Input Column */}
                <div className="relative flex items-center justify-start">
                  {inputPorts[i] && (
                    <>
                      <Handle
                        type="target"
                        position={Position.Left}
                        id={inputPorts[i].name}
                        title={inputPorts[i].description}
                        className="w-2.5! h-2.5! bg-background! border-2! border-muted-foreground! hover:border-foreground! transition-all hover:bg-foreground! shadow-sm! z-50"
                      />
                      <span className="text-xs font-medium text-muted-foreground pl-2">
                        {inputPorts[i].label}
                      </span>
                    </>
                  )}
                </div>

                {/* Output Column */}
                <div className="relative flex items-center justify-end">
                  {outputPorts[i] && (
                    <>
                      <span className="text-xs font-medium text-right pr-2 text-muted-foreground">
                        {outputPorts[i].label}
                      </span>
                      <Handle
                        type="source"
                        position={Position.Right}
                        id={outputPorts[i].name}
                        title={outputPorts[i].description}
                        className="w-2.5! h-2.5! bg-background! border-2! border-muted-foreground! transition-all hover:bg-foreground! hover:border-foreground! shadow-sm! z-50"
                      />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-3 text-center text-xs text-muted-foreground italic">
            No inputs or outputs
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(PluginNode);
