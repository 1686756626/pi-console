import { useState, createContext, useContext, useCallback, type ReactNode } from "react";
import { X } from "lucide-react";

export interface ToastItem {
  id: number;
  message: string;
  type: "error" | "success" | "info";
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastItem["type"]) => void;
}

const ToastContext = createContext<ToastContextValue>({
  addToast: () => {},
});

let nextId = 0;
let globalAddToast: ((message: string, type?: ToastItem["type"]) => void) | null = null;

export function toast(message: string, type: ToastItem["type"] = "error") {
  if (globalAddToast) {
    globalAddToast(message, type);
  }
}

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: ToastItem["type"] = "error") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  globalAddToast = addToast;

  const remove = (id: number) => setToasts((prev) => prev.filter((x) => x.id !== id));

  const colors = {
    error: { bg: "var(--ht-error-bg)", border: "var(--ht-error)", text: "var(--ht-error)", accent: "var(--ht-error)" },
    success: { bg: "var(--ht-success-bg)", border: "var(--ht-success)", text: "var(--ht-success)", accent: "var(--ht-success)" },
    info: { bg: "var(--ht-accent-subtle)", border: "var(--ht-border)", text: "var(--ht-fg)", accent: "var(--ht-accent)" },
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {toasts.length > 0 && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, maxWidth: 380 }}>
          {toasts.map((t) => {
            const c = colors[t.type];
            return (
              <div key={t.id} className="animate-fade-in" style={{
                padding: "10px 14px", borderRadius: "var(--ht-radius-md)", background: c.bg, border: `1px solid ${c.border}`,
                color: c.text, fontSize: 13, display: "flex", alignItems: "flex-start", gap: 8,
                boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
              }}>
                <div style={{ width: 4, borderRadius: 2, background: c.accent, alignSelf: "stretch", flexShrink: 0 }} />
                <div style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</div>
                <button onClick={() => remove(t.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, opacity: 0.5, color: c.text, display: "flex" }}>
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
}
