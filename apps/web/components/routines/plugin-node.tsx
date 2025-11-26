import { memo, useMemo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { IconSettings } from "@tabler/icons-react";
import {
  getPluginInputs,
  getPluginOutputs,
  getPluginMetadata,
} from "@/lib/plugins";

export interface PluginNodeData extends Record<string, unknown> {
  label: string;
  pluginId: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  executionStatus?: "running" | "completed" | "failed" | "pending";
  onConfigure?: (nodeId: string) => void;
}

function PluginNode({ data, selected, id }: NodeProps) {
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

  const handleConfigClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (nodeData.onConfigure && id) {
      nodeData.onConfigure(id);
    }
  };

  // Determine border/ring styles based on execution status or selection
  let statusClasses = "";
  console.log(nodeData.executionStatus);
  if (nodeData.executionStatus === "running") {
    statusClasses = "border-primary animate-pulse";
  } else if (nodeData.executionStatus === "completed") {
    statusClasses = "border-green-300/50 shadow-sm";
  } else if (nodeData.executionStatus === "failed") {
    statusClasses = "border-destructive ring-1 ring-destructive";
  } else if (selected) {
    statusClasses = "border-primary shadow-md";
  } else {
    statusClasses = "border-border shadow-sm hover:border-ring";
  }

  return (
    <div
      className={`relative bg-card border rounded-xl min-w-[280px] transition-all duration-200 group ${statusClasses}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-linear-to-b from-card to-muted/20 rounded-t-xl">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-lg border shadow-sm ${
              selected
                ? "bg-primary/10 border-primary/20 text-primary"
                : "bg-background border-border text-muted-foreground"
            }`}
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
        <button
          type="button"
          onClick={handleConfigClick}
          className="p-1.5 rounded-md hover:bg-muted hover:shadow-sm border border-transparent hover:border-border transition-all text-muted-foreground hover:text-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
          title="Configure"
        >
          <IconSettings className="w-4 h-4" />
        </button>
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
                        className="!w-2.5 !h-2.5 !bg-background !border-[2px] !border-muted-foreground hover:!border-foreground transition-all hover:!bg-foreground shadow-sm z-50"
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
                        className="!w-2.5 !h-2.5 !bg-background !border-[2px] !border-muted-foreground transition-all hover:!bg-foreground hover:!border-foreground shadow-sm z-50"
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
