import * as React from "react"
import { cn } from "@/lib/utils"

type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "cyber"
type ButtonSize = "default" | "sm" | "lg" | "icon"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantClasses: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_15px_-3px_hsl(var(--primary)/0.4)]",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  outline: "border border-border bg-background hover:bg-secondary hover:text-foreground",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-secondary hover:text-foreground",
  link: "text-primary underline-offset-4 hover:underline",
  cyber: "relative bg-transparent text-primary border border-primary/50 overflow-hidden group hover:border-primary hover:text-primary-foreground cyber-glow",
}

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-10 px-4 py-2",
  sm: "h-9 rounded-lg px-3",
  lg: "h-12 rounded-xl px-8 text-base",
  icon: "h-10 w-10",
}

export function buttonVariants(opts?: { variant?: ButtonVariant; size?: ButtonSize; className?: string }) {
  return cn(
    "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
    variantClasses[opts?.variant ?? "default"],
    sizeClasses[opts?.size ?? "default"],
    opts?.className
  )
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={buttonVariants({ variant, size, className })}
        {...props}
      >
        {variant === "cyber" && (
          <span className="absolute inset-0 bg-primary/10 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300 ease-out z-0" />
        )}
        <span className={cn("relative z-10 flex items-center gap-2", variant === "cyber" && "group-hover:text-primary-foreground")}>
          {props.children}
        </span>
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
