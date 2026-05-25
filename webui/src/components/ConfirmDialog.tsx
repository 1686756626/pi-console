import { AlertTriangle, Check, X } from "lucide-react";
import { useEffect } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "确认执行",
  cancelLabel = "取消",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: "rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-in"
        style={{
          background: "var(--ht-surface)",
          borderRadius: 12,
          padding: 24,
          maxWidth: 440,
          width: "90%",
          boxShadow: "0 16px 48px rgba(0,0,0,0.15)",
          border: "1px solid var(--ht-border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "rgba(217,144,0,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ht-warning)",
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={18} />
          </div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{title}</div>
        </div>

        <div style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.7, marginBottom: 20, whiteSpace: "pre-line" }}>
          {message}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid var(--ht-border)",
              background: "transparent",
              cursor: "pointer",
              fontSize: 13,
              color: "var(--ht-fg)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <X size={14} />
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "var(--ht-accent)",
              color: "var(--ht-on-accent)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Check size={14} />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
