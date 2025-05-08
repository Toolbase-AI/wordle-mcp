import { cn } from "./utils";
import { ComponentPropsWithoutRef, forwardRef } from "react";

interface LinkProps extends ComponentPropsWithoutRef<"a"> {
  variant?: "default" | "muted";
  external?: boolean;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  ({ className, variant = "default", external, ...props }, ref) => {
    const externalProps = external
      ? {
          target: "_blank",
          rel: "noopener noreferrer",
        }
      : {};

    return (
      <a
        ref={ref}
        className={cn(
          "transition-colors",
          variant === "default" && "text-primary hover:text-primary/80",
          variant === "muted" && "text-muted-foreground hover:text-primary",
          className
        )}
        {...externalProps}
        {...props}
      />
    );
  }
);
