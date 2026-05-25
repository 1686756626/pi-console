interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
      }}
    >
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
          {title}
        </h1>
        {subtitle && (
          <div style={{ fontSize: 13, opacity: 0.5, marginTop: 4 }}>{subtitle}</div>
        )}
      </div>
      {action}
    </div>
  );
}
