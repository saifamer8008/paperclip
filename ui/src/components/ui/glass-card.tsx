import { cn } from "@/lib/utils";
import React, { type HTMLAttributes, forwardRef } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
}

export const GlassCard = React.memo(forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, glow, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("glass glass-hover", glow && "glow-emerald", className)}
      {...props}
    />
  )
));
GlassCard.displayName = "GlassCard";
