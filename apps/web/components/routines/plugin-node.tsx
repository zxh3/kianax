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
  const outputPorts = Object.values(outputs);

  const handleConfigClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (nodeData.onConfigure && id) {
      nodeData.onConfigure(id);
    }
  };

  // Determine border/ring styles based on execution status or selection
  let statusClasses = "";
  if (nodeData.executionStatus === "running") {
    statusClasses = "ring-2 ring-gray-100 border-gray-400 animate-pulse";
  } else if (nodeData.executionStatus === "completed") {
    statusClasses = "border-gray-800 shadow-sm";
  } else if (nodeData.executionStatus === "failed") {
    statusClasses = "border-gray-800 ring-1 ring-gray-800";
  } else if (selected) {
    statusClasses = "border-black shadow-md";
  } else {
    statusClasses = "border-gray-200 shadow-sm hover:border-gray-300";
  }

  return (
    <div
      className={`relative bg-white border rounded-xl min-w-[280px] transition-all duration-200 group ${statusClasses} ${!nodeData.enabled ? "opacity-60 grayscale" : ""}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-b from-white to-gray-50 rounded-t-xl">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-lg border shadow-sm ${
              selected
                ? "bg-gray-50 border-gray-200 text-gray-900"
                : "bg-white border-gray-100 text-gray-600"
            }`}
          >
            {metadata?.icon ? (
              <div className="text-lg">{metadata.icon}</div>
            ) : (
              <div className="w-4 h-4 bg-gray-200 rounded-full" />
            )}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-semibold text-sm text-gray-900 truncate leading-tight">
              {nodeData.label}
            </span>
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider truncate">
              {metadata?.name || "Plugin"}
            </span>
          </div>
        </div>
        {hasConfigUI && (
          <button
            type="button"
            onClick={handleConfigClick}
            className="p-1.5 rounded-md hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 transition-all text-gray-400 hover:text-gray-700 flex-shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
            title="Configure"
          >
            <IconSettings className="w-4 h-4" />
          </button>
        )}
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
                        className="!w-2.5 !h-2.5 !bg-white !border-[2px] !border-gray-700 transition-all hover:!bg-gray-900 hover:!border-gray-900 shadow-sm z-50"
                      />
                      <span className="text-xs font-medium text-gray-600 pl-2">
                        {inputPorts[i].label}
                      </span>
                    </>
                  )}
                </div>

                {/* Output Column */}
                <div className="relative flex items-center justify-end">
                  {outputPorts[i] && (
                    <>
                      <span className="text-xs font-medium text-right pr-2 text-gray-600">
                        {outputPorts[i].label}
                      </span>
                      <Handle
                        type="source"
                        position={Position.Right}
                        id={outputPorts[i].name}
                        title={outputPorts[i].description}
                        className="!w-2.5 !h-2.5 !bg-white !border-[2px] !border-gray-700 transition-all hover:!bg-gray-900 hover:!border-gray-900 shadow-sm z-50"
                      />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-3 text-center text-xs text-gray-400 italic">
            No inputs or outputs
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(PluginNode);
