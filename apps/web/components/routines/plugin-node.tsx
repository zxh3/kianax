import { memo, useMemo, useRef, useLayoutEffect, useState } from "react";
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
  onConfigure?: (nodeId: string) => void;
}

function PluginNode({ data, selected, id }: NodeProps) {
  const nodeData = data as PluginNodeData;
  const inputRefs = useRef<(HTMLDivElement | null)[]>([]);
  const outputRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [positions, setPositions] = useState<{
    inputs: number[];
    outputs: number[];
  }>({ inputs: [], outputs: [] });

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

  // Measure actual label positions
  useLayoutEffect(() => {
    const inputPositions = inputRefs.current.map((ref) => {
      if (!ref) return 0;
      return ref.offsetTop + ref.offsetHeight / 2;
    });
    const outputPositions = outputRefs.current.map((ref) => {
      if (!ref) return 0;
      return ref.offsetTop + ref.offsetHeight / 2;
    });

    // Only update if positions actually changed
    setPositions((prev) => {
      const hasChanged =
        JSON.stringify(prev.inputs) !== JSON.stringify(inputPositions) ||
        JSON.stringify(prev.outputs) !== JSON.stringify(outputPositions);

      return hasChanged
        ? { inputs: inputPositions, outputs: outputPositions }
        : prev;
    });
  }, [inputPorts.length, outputPorts.length]);

  const handleConfigClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (nodeData.onConfigure && id) {
      nodeData.onConfigure(id);
    }
  };

  return (
    <div
      className={`relative bg-white border-2 rounded-lg w-[260px] transition-all ${
        selected
          ? "border-blue-500 shadow-lg ring-2 ring-blue-200"
          : "border-gray-800 shadow-sm hover:shadow-md"
      } ${!nodeData.enabled ? "opacity-40" : ""}`}
    >
      {/* Header with Title and Icon */}
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-gray-200">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {metadata?.icon && (
            <div className="text-xl flex-shrink-0">{metadata.icon}</div>
          )}
          <div className="font-semibold text-sm text-gray-900 truncate">
            {nodeData.label}
          </div>
        </div>
        {hasConfigUI && (
          <button
            type="button"
            onClick={handleConfigClick}
            className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700 flex-shrink-0"
            title="Configure"
          >
            <IconSettings className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Body - Port Labels and Handles */}
      <div className="px-4 py-3 min-h-[80px] relative">
        <div className="flex justify-between w-full text-xs font-medium">
          {/* Input labels on left */}
          <div className="space-y-3">
            {inputPorts.map((input, index) => (
              <div
                key={input.name}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                className="text-gray-700 flex items-center h-5"
              >
                <span>{input.label}</span>
              </div>
            ))}
          </div>

          {/* Output labels on right */}
          <div className="space-y-3 text-right">
            {outputPorts.map((output, index) => {
              const isSuccess =
                output.name === "true" || output.name === "success";
              const isError =
                output.name === "false" || output.name === "error";
              const textColor = isSuccess
                ? "text-green-700"
                : isError
                  ? "text-red-700"
                  : "text-gray-700";

              return (
                <div
                  key={output.name}
                  ref={(el) => {
                    outputRefs.current[index] = el;
                  }}
                  className={`${textColor} flex items-center justify-end h-5`}
                >
                  <span>{output.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Input Handles - Positioned based on measured label positions */}
        {inputPorts.map((input, index) => {
          const topOffset = positions.inputs[index] || 10;

          return (
            <Handle
              key={input.name}
              type="target"
              position={Position.Left}
              id={input.name}
              title={input.description}
              className="!w-3 !h-3 !border-2 !border-gray-800 !bg-white hover:!border-blue-500 hover:!scale-125 !transition-all !rounded-full"
              style={{
                top: `${topOffset}px`,
                left: "-6px",
              }}
            />
          );
        })}

        {/* Output Handles - Positioned based on measured label positions */}
        {outputPorts.map((output, index) => {
          const topOffset = positions.outputs[index] || 10;
          const isSuccess = output.name === "true" || output.name === "success";
          const isError = output.name === "false" || output.name === "error";
          const borderColor = isSuccess
            ? "#10b981"
            : isError
              ? "#ef4444"
              : "#1f2937";

          return (
            <Handle
              key={output.name}
              type="source"
              position={Position.Right}
              id={output.name}
              title={output.description}
              className="!w-3 !h-3 !border-2 !bg-white hover:!scale-125 !transition-all !rounded-full"
              style={{
                top: `${topOffset}px`,
                right: "-6px",
                borderColor,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export default memo(PluginNode);
