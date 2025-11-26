import { memo, useMemo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { IconSettings } from "@tabler/icons-react";
import {
  getPluginInputs,
  getPluginOutputs,
  getPluginMetadata,
} from "@/lib/plugins";
import { hasPluginConfigUI } from "@kianax/plugins";

export interface PluginNodeData extends Record<string, unknown> {
  label: string;
  pluginId: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  executionStatus?: "running" | "completed" | "failed" | "pending";
  onConfigure?: (nodeId: string) => void;
}

const FLOW_OUTPUT_NAMES = new Set([
  "true",
  "false",
  "success",
  "error",
  "continue",
  "break",
  "default",
]);

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
  const hasConfigUI = useMemo(
    () => hasPluginConfigUI(nodeData.pluginId),
    [nodeData.pluginId],
  );

  const inputPorts = Object.values(inputs);
  const allOutputPorts = Object.values(outputs);

  // Separate Flow vs Data outputs
  const flowOutputs = allOutputPorts.filter((p) =>
    FLOW_OUTPUT_NAMES.has(p.name),
  );
  const dataOutputs = allOutputPorts.filter(
    (p) => !FLOW_OUTPUT_NAMES.has(p.name),
  );

  const hasImplicitDefaultFlow = flowOutputs.length === 0;

  const handleConfigClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (nodeData.onConfigure && id) {
      nodeData.onConfigure(id);
    }
  };

  // Determine border/ring styles based on execution status or selection
  let statusClasses = "";
  if (nodeData.executionStatus === "running") {
    statusClasses = "ring-2 ring-muted border-primary animate-pulse";
  } else if (nodeData.executionStatus === "completed") {
    statusClasses = "border-foreground shadow-sm";
  } else if (nodeData.executionStatus === "failed") {
    statusClasses = "border-destructive ring-1 ring-destructive";
  } else if (selected) {
    statusClasses = "border-primary shadow-md";
  } else {
    statusClasses = "border-border shadow-sm hover:border-ring";
  }

  // Styles for different handle types
  const flowHandleStyle =
    "!w-3.5 !h-3.5 !bg-primary !border-2 !border-background !rounded-[2px] rotate-45 transition-transform hover:scale-125 z-50";
  const dataHandleStyle =
    "!w-2.5 !h-2.5 !bg-background !border-[2px] !border-muted-foreground !rounded-full transition-colors hover:!border-primary hover:!bg-primary/20 z-50";

  return (
    <div
      className={`relative bg-card border rounded-xl min-w-[280px] transition-all duration-200 group ${statusClasses} ${!nodeData.enabled ? "opacity-60 grayscale" : ""}`}
    >
      {/* Header */}
      <div className="relative flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-b from-card to-muted/20 rounded-t-xl">
        {/* Flow Entry Handle - Vertically Centered on Left Edge */}
        <Handle
          type="target"
          position={Position.Left}
          id="__entry__"
          className={`${flowHandleStyle} -left-[7px] top-1/2 -translate-y-1/2`}
          title="Flow Entry"
        />

        <div className="flex items-center gap-3 flex-1 min-w-0 pl-0">
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

        {/* Config Button */}
        {hasConfigUI && (
          <button
            type="button"
            onClick={handleConfigClick}
            className="p-1.5 rounded-md hover:bg-muted hover:shadow-sm border border-transparent hover:border-border transition-all text-muted-foreground hover:text-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 mr-2"
            title="Configure"
          >
            <IconSettings className="w-4 h-4" />
          </button>
        )}

        {/* Implicit Default Flow Exit - Vertically Centered on Right Edge */}
        {hasImplicitDefaultFlow && (
          <Handle
            type="source"
            position={Position.Right}
            id="default"
            className={`${flowHandleStyle} -right-[7px] top-1/2 -translate-y-1/2`}
            title="Default Flow"
          />
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col pb-2">
        {/* Explicit Flow Outputs Section */}
        {flowOutputs.length > 0 && (
          <div className="flex flex-col gap-2 pt-3 pb-2 px-0 border-b border-border/50 mb-1 bg-muted/10">
            {flowOutputs.map((port) => (
              <div
                key={port.name}
                className="relative h-7 flex items-center justify-end pr-0"
              >
                <span className="text-xs font-bold text-foreground mr-4 uppercase tracking-tight">
                  {port.label}
                </span>
                <div className="relative w-0 h-full flex items-center justify-center">
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={port.name}
                    className={`${flowHandleStyle} -right-[7px]`}
                    title={port.description || port.label}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Data Ports Section */}
        {inputPorts.length > 0 || dataOutputs.length > 0 ? (
          <div className="flex flex-col gap-2 py-3">
            {Array.from({
              length: Math.max(inputPorts.length, dataOutputs.length),
            }).map((_, i) => (
              <div
                key={i}
                className="relative grid grid-cols-2 h-6 items-center"
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
                        className={`${dataHandleStyle} -left-[6px]`}
                      />
                      <span
                        className="text-xs text-muted-foreground pl-3 truncate max-w-[110px]"
                        title={inputPorts[i].label}
                      >
                        {inputPorts[i].label}
                      </span>
                    </>
                  )}
                </div>

                {/* Output Column */}
                <div className="relative flex items-center justify-end">
                  {dataOutputs[i] && (
                    <>
                      <span
                        className="text-xs text-muted-foreground pr-3 text-right truncate max-w-[110px]"
                        title={dataOutputs[i].label}
                      >
                        {dataOutputs[i].label}
                      </span>
                      <Handle
                        type="source"
                        position={Position.Right}
                        id={dataOutputs[i].name}
                        title={dataOutputs[i].description}
                        className={`${dataHandleStyle} -right-[6px]`}
                      />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          !hasImplicitDefaultFlow &&
          flowOutputs.length === 0 && (
            <div className="px-4 py-3 text-center text-xs text-muted-foreground italic">
              No inputs
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default memo(PluginNode);
