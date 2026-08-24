import type { InputHTMLAttributes } from "react";

export function FormField({
  label,
  hint,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  const message = error ?? hint;
  return (
    <label className="form-field">
      {label}
      <input {...props} aria-invalid={Boolean(error)} />
      {message && (
        <span className={error ? "field-error" : "field-hint"}>{message}</span>
      )}
    </label>
  );
}
