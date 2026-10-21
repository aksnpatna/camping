import React from "react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  selectSize?: "sm" | "md";
  children: React.ReactNode;
}

export function Select({
  selectSize = "md",
  className = "",
  disabled,
  children,
  ...props
}: SelectProps) {
  const sizes = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-3 py-2 text-sm"
  };

  return (
    <select
      className={`w-full bg-paper-sunk text-ink rounded-sm border border-paper-rule focus:outline-none focus:ring-1 focus:ring-eucalypt focus:border-eucalypt disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${sizes[selectSize]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </select>
  );
}

export default Select;
