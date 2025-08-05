import * as React from "react"

import { cn } from "@/app/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border-2 border-glass-border/30 bg-gradient-glass backdrop-blur-cave px-4 py-2 text-sm font-medium text-foreground shadow-glass transition-all duration-300 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/80 hover:border-glass-border/50 hover:shadow-glass-medium focus-visible:outline-none focus-visible:focus-cave focus-visible:border-primary/60 focus-visible:shadow-glow disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/20",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }