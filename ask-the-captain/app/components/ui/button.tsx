import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/app/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:focus-cave disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 interactive-cave",
  {
    variants: {
      variant: {
        default:
          "btn-cave-primary text-primary-foreground font-semibold shadow-glow hover:shadow-glow-strong",
        destructive:
          "bg-gradient-to-r from-destructive to-red-600 text-destructive-foreground shadow-lg hover:shadow-xl hover:scale-105",
        outline:
          "border-2 border-glass-border bg-gradient-glass backdrop-blur-cave text-foreground shadow-glass hover:shadow-glass-medium hover:bg-glass-light/20",
        secondary:
          "btn-cave-secondary text-secondary-foreground hover:scale-105",
        ghost: "hover:bg-glass-light/30 hover:backdrop-blur-cave-medium text-foreground hover:text-accent",
        link: "text-primary underline-offset-4 hover:underline hover:text-accent",
        cave: "bg-gradient-to-br from-glass-light to-glass-lighter border border-glass-border/50 text-foreground shadow-glass backdrop-blur-cave hover:shadow-glass-medium hover:border-glass-border/70",
      },
      size: {
        default: "h-10 px-6 py-2 text-sm",
        sm: "h-8 rounded-md px-4 text-xs",
        lg: "h-12 rounded-xl px-10 text-base font-semibold",
        icon: "h-10 w-10 rounded-lg",
        "icon-sm": "h-8 w-8 rounded-md",
        "icon-lg": "h-12 w-12 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }