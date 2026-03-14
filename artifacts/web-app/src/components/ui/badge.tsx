import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "tcp" | "udp" | "icmp"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 font-mono",
        {
          "border-transparent bg-primary text-primary-foreground shadow": variant === "default",
          "border-transparent bg-secondary text-secondary-foreground": variant === "secondary",
          "border-transparent bg-destructive text-destructive-foreground shadow": variant === "destructive",
          "text-foreground": variant === "outline",
          "border-transparent bg-blue-500/10 text-blue-400 border border-blue-500/20": variant === "tcp",
          "border-transparent bg-emerald-500/10 text-emerald-400 border border-emerald-500/20": variant === "udp",
          "border-transparent bg-amber-500/10 text-amber-400 border border-amber-500/20": variant === "icmp",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
