import { Badge } from "@kianax/ui/components/badge";
import {
  IconCircleDashed,
  IconCircleCheck,
  IconPlayerPause,
  IconArchive,
} from "@tabler/icons-react";

type RoutineStatus = "draft" | "active" | "paused" | "archived";

interface StatusBadgeProps {
  status: RoutineStatus;
  className?: string;
}

const statusConfig: Record<
  RoutineStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className?: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  draft: {
    label: "Draft",
    variant: "secondary",
    icon: IconCircleDashed,
  },
  active: {
    label: "Active",
    variant: "default",
    className: "bg-green-500 text-white hover:bg-green-600",
    icon: IconCircleCheck,
  },
  paused: {
    label: "Paused",
    variant: "outline",
    className: "border-yellow-500 text-yellow-700",
    icon: IconPlayerPause,
  },
  archived: {
    label: "Archived",
    variant: "outline",
    icon: IconArchive,
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
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
