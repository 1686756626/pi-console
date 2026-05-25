import { useCallback } from "react";
import { Editor, rootCtx, defaultValueCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { history } from "@milkdown/kit/plugin/history";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { cursor } from "@milkdown/kit/plugin/cursor";
import { trailing } from "@milkdown/kit/plugin/trailing";
import { indent } from "@milkdown/kit/plugin/indent";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";

interface MilkdownEditorProps {
  value: string;
  onChange: (markdown: string) => void;
}

function EditorCore({ value, onChange }: MilkdownEditorProps) {
  const { loading } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, value);
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          onChange(markdown);
        });
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(clipboard)
      .use(cursor)
      .use(trailing)
      .use(indent)
      .use(listener)
  );

  if (loading) {
    return <div style={{ opacity: 0.3, fontSize: 13, padding: 12 }}>加载编辑器...</div>;
  }
  return <Milkdown />;
}

export default function MilkdownEditor({ value, onChange }: MilkdownEditorProps) {
  const stableOnChange = useCallback(onChange, [onChange]);

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
      <MilkdownProvider>
        <EditorCore value={value} onChange={stableOnChange} />
      </MilkdownProvider>
    </div>
  );
}
