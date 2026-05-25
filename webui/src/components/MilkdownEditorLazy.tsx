import { lazy, Suspense } from "react";

interface MilkdownEditorProps {
  value: string;
  onChange: (markdown: string) => void;
}

const LazyMilkdownEditor = lazy(() => import("./MilkdownEditorCore"));

export default function MilkdownEditor(props: MilkdownEditorProps) {
  return (
    <div
      className="milkdown-editor"
      style={{
        minHeight: 400,
        border: "1px solid var(--ht-border)",
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        lineHeight: 1.7,
        color: "var(--ht-fg)",
        background: "var(--ht-bg)",
        overflow: "auto",
        maxHeight: 600,
      }}
    >
      <Suspense
        fallback={
          <div style={{ opacity: 0.3, fontSize: 13, padding: 12 }}>
            加载编辑器...
          </div>
        }
      >
        <LazyMilkdownEditor {...props} />
      </Suspense>
    </div>
  );
}
