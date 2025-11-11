import { Badge } from "@kianax/ui/components/badge";
import {
  IconClock,
  IconPlayerPlay,
  IconCircleCheck,
  IconCircleX,
  IconBan,
  IconAlertTriangle,
} from "@tabler/icons-react";

type ExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "timeout";

interface ExecutionStatusBadgeProps {
  status: ExecutionStatus;
  className?: string;
}

const statusConfig: Record<
  ExecutionStatus,
  {
    label: string;
    variant: "default" | "destructive" | "secondary" | "outline";
    className?: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  pending: {
    label: "Pending",
    variant: "secondary",
    icon: IconClock,
  },
  running: {
    label: "Running",
    variant: "default",
    className: "bg-blue-500 text-white hover:bg-blue-600",
    icon: IconPlayerPlay,
  },
  completed: {
    label: "Completed",
    variant: "default",
    className: "bg-green-500 text-white hover:bg-green-600",
    icon: IconCircleCheck,
  },
  failed: {
    label: "Failed",
    variant: "destructive",
    icon: IconCircleX,
  },
  cancelled: {
    label: "Cancelled",
    variant: "secondary",
    icon: IconBan,
  },
  timeout: {
    label: "Timeout",
    variant: "outline",
    className: "border-yellow-500 text-yellow-700",
    icon: IconAlertTriangle,
  },
};

export function ExecutionStatusBadge({
  status,
  className,
}: ExecutionStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={`${config.className || ""} ${className || ""}`}
    >
      <Icon className="mr-1 size-3" />
      {config.label}
    </Badge>
  );
}
