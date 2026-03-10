import React from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface DashboardMetricProps {
  to: string;
  icon: LucideIcon;
  value: React.ReactNode;
  label: string;
  description: React.ReactNode;
  className?: string;
  isAlert?: boolean;
}

export const DashboardMetric = React.memo(({
  to,
  icon: Icon,
  value,
  label,
  description,
  className,
  isAlert = false,
}: DashboardMetricProps) => {
  return (
    <motion.div whileHover={{ scale: 1.03 }} className="h-full">
      <Link to={to} className="block h-full no-underline">
        <GlassCard
          className={cn(
            "flex h-full flex-col justify-between p-4",
            isAlert && "border-yellow-400/50",
            className
          )}
        >
          <div className="flex items-center justify-between">
            <div className="text-lg font-bold">{value}</div>
            <Icon
              className={cn(
                "h-5 w-5 text-muted-foreground",
                isAlert && "text-yellow-400"
              )}
            />
          </div>
          <div>
            <div className="font-semibold">{label}</div>
            <div className="text-sm text-muted-foreground">{description}</div>
          </div>
        </GlassCard>
      </Link>
    </motion.div>
  );
});
