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
    statusClasses =
      "ring-2 ring-blue-400 border-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.5)] animate-pulse";
  } else if (nodeData.executionStatus === "completed") {
    statusClasses =
      "ring-2 ring-emerald-500 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]";
  } else if (nodeData.executionStatus === "failed") {
    statusClasses =
      "ring-2 ring-rose-500 border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]";
  } else if (selected) {
    statusClasses = "border-blue-500 shadow-lg ring-2 ring-blue-500/20";
  } else {
    statusClasses =
      "border-gray-200 shadow-sm hover:border-gray-300 hover:shadow-md";
  }

  return (
    <div
      className={`relative bg-white border rounded-xl min-w-[280px] transition-all duration-200 group ${statusClasses} ${!nodeData.enabled ? "opacity-60 grayscale" : ""}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-lg border shadow-sm ${
              selected
                ? "bg-blue-50 border-blue-100 text-blue-600"
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
                        className="!w-3 !h-3 !bg-gray-400 hover:!bg-blue-500 transition-colors shadow-sm z-50"
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
                      <span
                        className={`text-xs font-medium text-right pr-2 ${
                          outputPorts[i].name === "true" ||
                          outputPorts[i].name === "success"
                            ? "text-emerald-700"
                            : (
                                  outputPorts[i].name === "false" ||
                                    outputPorts[i].name === "error"
                                )
                              ? "text-rose-700"
                              : "text-gray-700"
                        }`}
                      >
                        {outputPorts[i].label}
                      </span>
                      <Handle
                        type="source"
                        position={Position.Right}
                        id={outputPorts[i].name}
                        title={outputPorts[i].description}
                        className={`!w-3 !h-3 shadow-sm transition-transform hover:scale-110 z-50 ${
                          outputPorts[i].name === "true" ||
                          outputPorts[i].name === "success"
                            ? "!bg-emerald-500"
                            : (
                                  outputPorts[i].name === "false" ||
                                    outputPorts[i].name === "error"
                                )
                              ? "!bg-rose-500"
                              : "!bg-gray-800"
                        }`}
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
