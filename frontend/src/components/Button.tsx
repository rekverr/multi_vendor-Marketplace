import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "primary",
  loading = false,
  children,
  disabled,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      {...props}
      className={`button button-${variant} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? "Please wait..." : children}
    </button>
  );
}
