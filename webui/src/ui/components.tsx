import { type ReactNode, type CSSProperties } from "react";

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  style?: CSSProperties;
}

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: "var(--ht-accent)",
    color: "var(--ht-on-accent)",
    border: "1px solid var(--ht-accent)",
  },
  outline: {
    background: "transparent",
    color: "var(--ht-fg)",
    border: "1px solid var(--ht-border)",
  },
  ghost: {
    background: "transparent",
    color: "var(--ht-fg)",
    border: "1px solid transparent",
  },
  danger: {
    background: "var(--ht-error-bg)",
    color: "var(--ht-error)",
    border: "1px solid var(--ht-error-bg)",
  },
};

const sizeStyles: Record<ButtonSize, CSSProperties> = {
  sm: { padding: "5px 12px", fontSize: 12 },
  md: { padding: "8px 16px", fontSize: 14 },
};

export function Button({ variant = "outline", size = "md", disabled, onClick, children, style }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        borderRadius: "var(--ht-radius-md)",
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "all 0.15s ease",
        lineHeight: 1.4,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

type CardVariant = "outlined" | "elevated";

interface CardProps {
  variant?: CardVariant;
  style?: CSSProperties;
  className?: string;
  onClick?: () => void;
  onMouseEnter?: React.MouseEventHandler;
  onMouseLeave?: React.MouseEventHandler;
  children: ReactNode;
}

export function Card({ variant = "outlined", style, className, onClick, onMouseEnter, onMouseLeave, children }: CardProps) {
  return (
    <div
      className={className}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{
        borderRadius: "var(--ht-radius-lg)",
        border: variant === "outlined" ? "1px solid var(--ht-border)" : undefined,
        boxShadow: variant === "elevated" ? "0 2px 8px rgba(0,0,0,0.06)" : undefined,
        background: "var(--ht-surface)",
        transition: "box-shadow 0.15s ease, border-color 0.15s ease",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

type TagColor = "accent" | "accent2" | "success" | "warning" | "error" | "neutral" | "info";

const tagColors: Record<TagColor, CSSProperties> = {
  accent: { background: "var(--ht-accent-muted)", color: "var(--ht-accent)" },
  accent2: { background: "var(--ht-info-bg)", color: "var(--ht-info)" },
  success: { background: "var(--ht-success-bg)", color: "var(--ht-success)" },
  warning: { background: "var(--ht-warning-bg)", color: "var(--ht-warning)" },
  error: { background: "var(--ht-error-bg)", color: "var(--ht-error)" },
  info: { background: "var(--ht-info-bg)", color: "var(--ht-info)" },
  neutral: { background: "var(--ht-accent-subtle)", color: "var(--ht-fg-secondary)" },
};

interface TagProps {
  color?: TagColor;
  children: ReactNode;
}

export function Tag({ color = "neutral", children }: TagProps) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 8px",
      borderRadius: "var(--ht-radius-sm)",
      fontSize: 11,
      fontWeight: 500,
      ...tagColors[color],
    }}>
      {children}
    </span>
  );
}

interface PillTabsProps {
  tabs: { key: string; label: string }[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function PillTabs({ tabs, activeKey, onChange }: PillTabsProps) {
  return (
    <div style={{
      display: "flex",
      gap: 2,
      padding: 3,
      background: "var(--ht-accent-subtle)",
      borderRadius: "var(--ht-radius-lg)",
    }}>
      {tabs.map((item) => (
        <button
          key={item.key}
          onClick={() => onChange(item.key)}
          style={{
            padding: "6px 14px",
            borderRadius: "var(--ht-radius-md)",
            border: "none",
            fontSize: 13,
            fontWeight: activeKey === item.key ? 600 : 400,
            cursor: "pointer",
            background: activeKey === item.key ? "var(--ht-surface)" : "transparent",
            color: activeKey === item.key ? "var(--ht-accent)" : "var(--ht-fg-secondary)",
            boxShadow: activeKey === item.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid var(--ht-border)",
  borderRadius: "var(--ht-radius-md)",
  fontSize: 14,
  background: "var(--ht-bg)",
  color: "var(--ht-fg)",
  outline: "none",
  transition: "border-color 0.15s ease",
};

export const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 6,
  color: "var(--ht-fg-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

export const statusColor = (status: string): string => {
  if (["completed", "success", "done", "approved", "indexed"].includes(status)) return "var(--ht-success)";
  if (["failed", "error", "rejected", "cancelled"].includes(status)) return "var(--ht-error)";
  if (["running", "active", "processing", "indexing"].includes(status)) return "var(--ht-accent)";
  if (["pending", "waiting", "queued", "warning"].includes(status)) return "var(--ht-warning)";
  return "var(--ht-fg-secondary)";
};

export const statusTagColor = (status: string): TagColor => {
  if (["completed", "success", "done", "approved", "indexed"].includes(status)) return "success";
  if (["failed", "error", "rejected", "cancelled"].includes(status)) return "error";
  if (["running", "active", "processing", "indexing"].includes(status)) return "accent";
  if (["pending", "waiting", "queued"].includes(status)) return "warning";
  return "neutral";
};

export const pageHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 24,
};

export const pageTitleStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: "var(--ht-fg)",
};

export const pageDescStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--ht-fg-secondary)",
  marginTop: 4,
};
