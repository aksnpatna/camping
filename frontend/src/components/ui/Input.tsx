import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  inputSize?: "sm" | "md";
}

export function Input({
  inputSize = "md",
  className = "",
  disabled,
  ...props
}: InputProps) {
  const sizes = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-3 py-2 text-sm"
  };

  return (
    <input
      className={`w-full bg-paper-sunk text-ink rounded-sm border border-paper-rule placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-eucalypt focus:border-eucalypt disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${sizes[inputSize]} ${className}`}
      disabled={disabled}
      {...props}
    />
  );
}

export default Input;
