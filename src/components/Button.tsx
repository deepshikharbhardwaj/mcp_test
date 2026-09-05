"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg" | "sm";

const variantClasses: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink/90 active:bg-ink/80",
  secondary: "bg-white text-ink border border-sand hover:border-clay/60",
  ghost: "bg-transparent text-mist hover:text-ink hover:bg-sand/50",
  danger: "bg-transparent text-red-700 hover:bg-red-50",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-sm px-3 py-2 rounded-lg",
  md: "text-[15px] px-4 py-3 rounded-xl",
  lg: "text-base px-6 py-4 rounded-2xl",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", fullWidth, className = "", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none select-none ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    />
  );
});
