const statusColorMap: Record<string, { color: string; bg: string }> = {
  pending: { color: "var(--ht-fg-secondary)", bg: "var(--ht-accent-subtle)" },
  todo: { color: "var(--ht-fg-secondary)", bg: "var(--ht-accent-subtle)" },
  running: { color: "var(--ht-accent)", bg: "var(--ht-accent-muted)" },
  succeeded: { color: "var(--ht-success)", bg: "var(--ht-success-bg)" },
  completed: { color: "var(--ht-success)", bg: "var(--ht-success-bg)" },
  failed: { color: "var(--ht-error)", bg: "var(--ht-error-bg)" },
  waiting_confirmation: { color: "var(--ht-warning)", bg: "var(--ht-warning-bg)" },
  cancelled: { color: "var(--ht-fg-secondary)", bg: "var(--ht-accent-subtle)" },
  skipped: { color: "var(--ht-fg-secondary)", bg: "var(--ht-accent-subtle)" },
  approved: { color: "var(--ht-success)", bg: "var(--ht-success-bg)" },
  rejected: { color: "var(--ht-error)", bg: "var(--ht-error-bg)" },
};

const statusLabel: Record<string, string> = {
  pending: "等待中",
  todo: "待执行",
  running: "运行中",
  succeeded: "已完成",
  completed: "已完成",
  failed: "失败",
  waiting_confirmation: "待确认",
  cancelled: "已取消",
  skipped: "已跳过",
  approved: "已通过",
  rejected: "已拒绝",
};

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  pulse?: boolean;
}

export default function StatusBadge({ status, size = "sm", pulse }: StatusBadgeProps) {
  const scheme = statusColorMap[status] || statusColorMap.pending;
  const isRunning = status === "running";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: size === "sm" ? 11 : 12,
        fontWeight: 600,
        padding: size === "sm" ? "3px 10px" : "4px 12px",
        borderRadius: 20,
        background: scheme.bg,
        color: scheme.color,
        whiteSpace: "nowrap",
        letterSpacing: "0.02em",
      }}
    >
      {(isRunning || pulse) && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: scheme.color,
            animation: "pulse-dot 1.5s ease-in-out infinite",
          }}
        />
      )}
      {statusLabel[status] || status.replace(/_/g, " ")}
    </span>
  );
}
