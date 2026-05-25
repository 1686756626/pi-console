import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, type Plan } from "../api";
import { Button, Card, Tag } from "../ui";
import {
  ArrowLeft,
  Check,
  X,
  RotateCcw,
  Clock,
  Loader,
  CheckCircle2,
  XCircle,
  Circle,
  AlertTriangle,
  SkipForward,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import MarkdownPreview from "../components/MarkdownPreview";

const stepStatusIcon: Record<string, typeof Circle> = {
  todo: Circle,
  running: Loader,
  succeeded: CheckCircle2,
  failed: XCircle,
  waiting_confirmation: AlertTriangle,
  skipped: SkipForward,
};

const stepStatusColor: Record<string, string> = {
  todo: "#ccc",
  running: "var(--ht-accent)",
  succeeded: "var(--ht-success)",
  failed: "var(--ht-error)",
  waiting_confirmation: "var(--ht-warning)",
  skipped: "var(--ht-fg-secondary)",
};

export default function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.plans.get(id).then(setPlan).catch(() => setError("计划不存在或已删除"));
    const interval = setInterval(() => {
      api.plans.get(id!).then(setPlan).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [id]);

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 12 }}>
        <div style={{ fontSize: 48, opacity: 0.15 }}>404</div>
        <div style={{ opacity: 0.5, fontSize: 14 }}>{error}</div>
        <button onClick={() => navigate("/runs")} style={{ background: "none", border: "1px solid var(--ht-border)", borderRadius: 6, padding: "6px 16px", cursor: "pointer", fontSize: 13 }}>
          返回运行列表
        </button>
      </div>
    );
  }

  if (!plan) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, opacity: 0.4 }}>
        加载中...
      </div>
    );
  }

  const hasWaitingStep = plan.steps.some((s) => s.status === "waiting_confirmation");
  const completedCount = plan.steps.filter((s) => s.status === "succeeded").length;
  const totalCount = plan.steps.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--ht-fg)",
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 13,
            opacity: 0.5,
            padding: 0,
          }}
        >
          <ArrowLeft size={16} /> 返回
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{plan.title}</h1>
            <StatusBadge status={plan.status} size="md" pulse={plan.status === "running"} />
          </div>
          <div style={{ fontSize: 12, opacity: 0.4, marginTop: 4 }}>
            {completedCount}/{totalCount} 步已完成
          </div>
        </div>
      </div>

      <div
        style={{
          height: 4,
          background: "var(--ht-border)",
          borderRadius: 2,
          marginBottom: 20,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "var(--ht-accent)",
            borderRadius: 2,
            transition: "width 0.5s ease",
          }}
        />
      </div>

      {hasWaitingStep && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <Button variant="primary" size="sm" onClick={() => api.plans.confirm(plan.id)}>
            <Check size={14} style={{ marginRight: 4 }} /> 确认继续
          </Button>
          <Button variant="outline" size="sm" onClick={() => api.plans.cancel(plan.id)}>
            <X size={14} style={{ marginRight: 4 }} /> 取消
          </Button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column" }}>
        {plan.steps.map((step, idx) => {
          const Icon = stepStatusIcon[step.status] || Circle;
          const isRunning = step.status === "running";
          const artifact = step.artifact;
          const isExpanded = expandedStep === step.id;
          const isActive = step.status === "running" || step.status === "waiting_confirmation";
          const isDone = step.status === "succeeded";
          const color = stepStatusColor[step.status] || "#ccc";
          const isLast = idx === plan.steps.length - 1;

          return (
            <div key={step.id} style={{ display: "flex", gap: 0 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: 40,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--ht-on-accent)",
                    flexShrink: 0,
                    border: isActive ? "3px solid" : "3px solid transparent",
                    borderColor: isActive ? `${color}40` : "transparent",
                    boxShadow: isRunning ? `0 0 0 4px ${color}15` : "none",
                  }}
                >
                  <Icon
                    size={13}
                    className={isRunning ? "animate-spin" : undefined}
                  />
                </div>
                {!isLast && (
                  <div
                    style={{
                      width: 2,
                      flex: 1,
                      background: isDone ? color : "var(--ht-border)",
                      minHeight: 24,
                      transition: "background 0.3s ease",
                    }}
                  />
                )}
              </div>

              <div style={{ flex: 1, paddingBottom: isLast ? 0 : 16 }}>
                <Card
                  variant="outlined"
                  style={{
                    padding: "14px 18px",
                    borderLeft: `3px solid ${color}`,
                    opacity: step.status === "todo" ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.3, width: 18 }}>
                      {step.step_order}
                    </span>
                    <span style={{ fontWeight: 500, fontSize: 14, flex: 1 }}>{step.title}</span>
                    {step.agent_id && (
                      <Tag color="accent">{step.agent_id}</Tag>
                    )}
                    <StatusBadge status={step.status} pulse={isRunning} />
                  </div>

                  {step.description && (
                    <p style={{ fontSize: 12, opacity: 0.5, margin: "4px 0 0 26px" }}>
                      {step.description}
                    </p>
                  )}

                  {step.error_message && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--ht-error)",
                        marginTop: 8,
                        marginLeft: 26,
                        padding: "6px 10px",
                        background: "rgba(238,85,68,0.06)",
                        borderRadius: 6,
                      }}
                    >
                      {step.error_message}
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: 11,
                      opacity: 0.35,
                      marginTop: 6,
                      marginLeft: 26,
                      display: "flex",
                      gap: 12,
                    }}
                  >
                    {step.started_at && (
                      <span>
                        <Clock size={10} style={{ marginRight: 3 }} />
                        {new Date(step.started_at).toLocaleTimeString("zh-CN")}
                      </span>
                    )}
                    {step.ended_at && step.started_at && (
                      <span>
                        {((new Date(step.ended_at).getTime() - new Date(step.started_at).getTime()) / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>

                  {step.status === "failed" && (
                    <div style={{ marginTop: 8, marginLeft: 26 }}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await api.steps.retry(step.id);
                          api.plans.get(plan.id).then(setPlan);
                        }}
                      >
                        <RotateCcw size={12} style={{ marginRight: 4 }} /> 重试
                      </Button>
                    </div>
                  )}

                  {(artifact || (isDone && !artifact)) && artifact && (
                    <div style={{ marginTop: 8, marginLeft: 26 }}>
                      <button
                        onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                        style={{
                          background: "none",
                          border: "1px solid var(--ht-border)",
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: 12,
                          cursor: "pointer",
                          color: "var(--ht-accent)",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {artifact.title}
                      </button>
                      {isExpanded && artifact.markdown_content && (
                        <MarkdownPreview content={artifact.markdown_content} />
                      )}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
