import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  style?: React.CSSProperties;
}

export default function Select({ value, onChange, options, style }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 240, ...style }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          padding: "9px 14px", borderRadius: "var(--ht-radius-md)", width: "100%",
          border: "1px solid var(--ht-border)",
          background: "var(--ht-surface)", color: "var(--ht-fg)",
          fontSize: 14, cursor: "pointer",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          borderColor: open ? "var(--ht-accent)" : undefined,
          boxShadow: open ? "0 0 0 3px var(--ht-accent-subtle)" : "none",
        }}
      >
        <span style={{ fontWeight: 500 }}>{selected?.label || "请选择"}</span>
        <ChevronDown size={16} style={{ opacity: 0.4, transition: "transform 0.15s ease", transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <div
          className="animate-fade-in"
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100,
            background: "var(--ht-surface)",
            border: "1px solid var(--ht-border)", borderRadius: "var(--ht-radius-md)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.08)", overflow: "hidden",
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: opt.description ? "10px 14px" : "8px 14px",
                border: "none", background: opt.value === value ? "var(--ht-accent-subtle)" : "transparent",
                color: "var(--ht-fg)", fontSize: 14, cursor: "pointer",
                transition: "background 0.1s ease",
              }}
              onMouseEnter={(e) => { if (opt.value !== value) e.currentTarget.style.background = "var(--ht-accent-subtle)"; }}
              onMouseLeave={(e) => { if (opt.value !== value) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ fontWeight: opt.value === value ? 600 : 400 }}>{opt.label}</div>
              {opt.description && <div style={{ fontSize: 11, color: "var(--ht-fg-secondary)", marginTop: 2 }}>{opt.description}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
