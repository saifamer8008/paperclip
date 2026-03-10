import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div className={cn("bg-white/[0.06] animate-pulse rounded-xl", className)} {...props} />
  )
}

export { Skeleton }
