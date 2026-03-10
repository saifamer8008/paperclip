import React from "react";
import { cn } from "../lib/utils";
import { statusBadge, statusBadgeDefault } from "../lib/status-colors";

export const StatusBadge = React.memo(({ status }: { status: string }) => {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium gap-1 shrink-0",
        statusBadge[status] ?? statusBadgeDefault
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
});
