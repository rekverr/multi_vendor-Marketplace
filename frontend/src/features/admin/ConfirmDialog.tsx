import { useState, type ReactNode } from "react";
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  children,
  onConfirm,
  requireText,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  children: ReactNode;
  onConfirm: (text: string) => Promise<void>;
  requireText?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState(false);
  async function confirm() {
    if (requireText && text.trim().length < 3) return;
    setPending(true);
    setFailure(false);
    try {
      await onConfirm(text.trim());
      setOpen(false);
      setText("");
    } catch {
      setFailure(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <span onClick={() => setOpen(true)}>{children}</span>
      {open && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <span className="eyebrow">Confirmation required</span>
            <h2 id="confirm-title">{title}</h2>
            <p>{description}</p>
            {requireText && (
              <label>
                Resolution reason
                <textarea
                  minLength={3}
                  maxLength={2000}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                />
              </label>
            )}
            {failure && (
              <p className="dialog-error" role="alert">
                The backend rejected this action. Review the page error and try
                again.
              </p>
            )}
            <div>
              <button
                className="button button-secondary"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                disabled={
                  pending || Boolean(requireText && text.trim().length < 3)
                }
                onClick={() => void confirm()}
              >
                {pending ? "Applying..." : confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
