import type { Pipeline } from "../api";

interface PipelineFlowProps {
  pipeline: Pipeline;
}

const agentLabels: Record<string, string> = {
  "news-curator": "新闻",
  researcher: "研究",
  "deep-researcher": "深度研究",
  writer: "写作",
  "zhihu-writer": "知乎",
  "journal-summarizer": "摘要",
};

export default function PipelineFlow({ pipeline }: PipelineFlowProps) {
  return (
    <div className="pipeline-flow">
      {pipeline.steps.map((step, i) => {
        const hasTemplate = !!step.prompt_template;
        const hasCondition = !!step.condition;
        const hasKeys = !!step.input_key || !!step.output_key;
        return (
          <span key={step.agent_id + i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span className="pipeline-flow-step" style={{
              position: "relative",
              borderColor: hasTemplate ? "var(--ht-accent)" : undefined,
            }}>
              {agentLabels[step.agent_id] || step.agent_id}
              {(hasTemplate || hasCondition || hasKeys) && (
                <span style={{
                  position: "absolute", top: -4, right: -4,
                  width: 7, height: 7, borderRadius: "50%",
                  background: "var(--ht-accent)",
                }} />
              )}
            </span>
            {i < pipeline.steps.length - 1 && <span className="pipeline-flow-arrow">&rarr;</span>}
          </span>
        );
      })}
      {pipeline.steps.some(s => s.prompt_template || s.condition || s.input_key || s.output_key) && (
        <span style={{ fontSize: 10, opacity: 0.4, marginLeft: 8 }}>
          含自定义配置
        </span>
      )}
    </div>
  );
}
