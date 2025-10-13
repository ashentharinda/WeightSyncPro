import { cn } from "@/lib/utils";
import { CheckCircle, AlertCircle, XCircle, Clock } from "lucide-react";

interface StatusIndicatorProps {
  status: "connected" | "warning" | "error" | "loading";
  label?: string;
  className?: string;
}

export function StatusIndicator({ status, label, className }: StatusIndicatorProps) {
  const statusConfig = {
    connected: {
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-900/20",
      borderColor: "border-green-200 dark:border-green-800",
      dotColor: "bg-green-500",
      label: "Connected"
    },
    warning: {
      icon: AlertCircle,
      color: "text-yellow-500",
      bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
      borderColor: "border-yellow-200 dark:border-yellow-800",
      dotColor: "bg-yellow-500",
      label: "Warning"
    },
    error: {
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-50 dark:bg-red-900/20",
      borderColor: "border-red-200 dark:border-red-800",
      dotColor: "bg-red-500",
      label: "Error"
    },
    loading: {
      icon: Clock,
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
      borderColor: "border-blue-200 dark:border-blue-800",
      dotColor: "bg-blue-500",
      label: "Loading"
    }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-200",
      config.bgColor,
      config.borderColor,
      className
    )}>
      <div className={cn(
        "w-2.5 h-2.5 rounded-full",
        config.dotColor,
        status === "connected" && "shadow-[0_0_8px_hsl(142,76%,36%)] animate-pulse",
        status === "warning" && "shadow-[0_0_8px_hsl(45,93%,47%)] animate-pulse",
        status === "error" && "shadow-[0_0_8px_hsl(var(--destructive))] animate-pulse",
        status === "loading" && "animate-pulse"
      )} />
      <Icon className={cn("h-4 w-4", config.color)} />
      <span className={cn("font-medium", config.color)}>
        {label || config.label}
      </span>
    </div>
  );
}

