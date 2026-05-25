import { useMemo } from "react";
import { marked } from "marked";

marked.setOptions({
  breaks: true,
  gfm: true,
});

interface MarkdownPreviewProps {
  content: string;
  maxHeight?: number;
  inline?: boolean;
}

export default function MarkdownPreview({ content, maxHeight = 400, inline = false }: MarkdownPreviewProps) {
  const html = useMemo(() => marked.parse(content) as string, [content]);
  if (inline) {
    return (
      <div
        className="md-preview"
        style={{ wordBreak: "break-word" }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return (
    <div
      className="md-preview animate-fade-in"
      style={{
        marginTop: 10,
        padding: 14,
        background: "var(--ht-surface)",
        border: "1px solid var(--ht-border)",
        borderRadius: 8,
        maxHeight,
        overflow: "auto",
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
