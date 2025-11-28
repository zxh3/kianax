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

  // --- Styles ---

  // Outer wrapper: Position relative for crosshairs, static border/shadow for shape
  const wrapperClasses = cn(
    "relative min-w-[280px] group rounded-xl transition-all duration-200",
    // Hover effect on the card itself
    !selected && "hover:-translate-y-0.5",
  );

  // Inner Card: The actual visible node
  const cardClasses = cn(
    "relative bg-card border border-border rounded-xl shadow-sm overflow-hidden h-full w-full",
  );

  // Status Spine: Left colored bar
  const statusSpineClasses = cn(
    "absolute left-0 top-0 bottom-0 w-1.5 z-10",
    nodeData.executionStatus === "running"
      ? "bg-blue-500 animate-pulse"
      : nodeData.executionStatus === "completed"
        ? "bg-emerald-500"
        : nodeData.executionStatus === "failed"
          ? "bg-destructive"
          : "bg-transparent border-r border-border/50", // Subtle border for pending
  );

  // Header: Dynamic background and border
  const headerClasses = cn(
    "flex items-center justify-between px-4 py-3 border-b pl-5", // Extra pl for spine
    nodeData.executionStatus === "running"
      ? "bg-blue-500/5 border-blue-500/10"
      : nodeData.executionStatus === "completed"
        ? "bg-emerald-500/5 border-emerald-500/10"
        : nodeData.executionStatus === "failed"
          ? "bg-destructive/5 border-destructive/10"
          : "bg-linear-to-b from-card to-muted/20 border-border",
  );

  // Icon Container: Dynamic accent
  const iconContainerClasses = cn(
    "flex items-center justify-center w-8 h-8 rounded-lg border shadow-sm transition-colors duration-200",
    selected
      ? "bg-primary/10 border-primary/20 text-primary"
      : nodeData.executionStatus === "running"
        ? "bg-blue-500/10 border-blue-500/20 text-blue-600"
        : nodeData.executionStatus === "completed"
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
          : nodeData.executionStatus === "failed"
            ? "bg-destructive/10 border-destructive/20 text-destructive"
            : "bg-background border-border text-muted-foreground",
  );

  return (
    <div className={wrapperClasses}>
      {/* Selection Indicators (Crosshair corners) */}
      {selected && (
        <>
          <motion.div
            initial={{ opacity: 0, x: -10, y: -10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.3, ease: "backOut" }}
            className="absolute -top-2 -left-2 w-4 h-4 border-t-[3px] border-l-[3px] border-primary rounded-tl-xl shadow-[0_0_8px_rgba(var(--primary)_/_0.5)] z-20"
          />
          <motion.div
            initial={{ opacity: 0, x: 10, y: -10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.3, ease: "backOut" }}
            className="absolute -top-2 -right-2 w-4 h-4 border-t-[3px] border-r-[3px] border-primary rounded-tr-xl shadow-[0_0_8px_rgba(var(--primary)_/_0.5)] z-20"
          />
          <motion.div
            initial={{ opacity: 0, x: -10, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.3, ease: "backOut" }}
            className="absolute -bottom-2 -left-2 w-4 h-4 border-b-[3px] border-l-[3px] border-primary rounded-bl-xl shadow-[0_0_8px_rgba(var(--primary)_/_0.5)] z-20"
          />
          <motion.div
            initial={{ opacity: 0, x: 10, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.3, ease: "backOut" }}
            className="absolute -bottom-2 -right-2 w-4 h-4 border-b-[3px] border-r-[3px] border-primary rounded-br-xl shadow-[0_0_8px_rgba(var(--primary)_/_0.5)] z-20"
          />
        </>
      )}

      <div className={cardClasses}>
        {/* Status Spine */}
        <div className={statusSpineClasses} />

        {/* Header */}
        <div className={headerClasses}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={iconContainerClasses}>
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
        <div className="p-0 pl-1.5">
          {" "}
          {/* Add pl to account for spine overlay if transparent, or just visual alignment */}
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
    </div>
  );
}

export default memo(PluginNode);
