import { FileX } from "lucide-react";

interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
}

export default function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div
      className="animate-fade-in"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 20px",
        opacity: 0.45,
        gap: 12,
      }}
    >
      <div style={{ width: 40, height: 40, opacity: 0.5 }}>
        {icon || <FileX size={40} />}
      </div>
      <div style={{ fontSize: 14, textAlign: "center" }}>{message}</div>
    </div>
  );
}
