import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const base = "inline-flex items-center justify-center font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none";
  
  const sizes = {
    sm: "text-xs px-2.5 py-1.5 rounded-sm gap-1.5",
    md: "text-sm px-4 py-2 rounded-sm gap-2"
  };

  const variants = {
    primary: "bg-eucalypt text-paper-card hover:bg-eucalypt-hover active:bg-eucalypt-hover border border-eucalypt",
    secondary: "bg-paper-card text-ink hover:bg-paper-sunk active:bg-paper-sunk border border-paper-rule",
    ghost: "bg-transparent text-ink-muted hover:text-ink hover:bg-paper-sunk/60 border border-transparent",
    danger: "bg-safety-danger text-paper-card hover:bg-red-800 border border-safety-danger"
  };

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
