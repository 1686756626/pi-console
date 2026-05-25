import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, type Run } from "../api";
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
  Download,
  Timer,
  Calendar,
  Zap,
} from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import MarkdownPreview from "../components/MarkdownPreview";
import ConfirmDialog from "../components/ConfirmDialog";
import { toast } from "../components/Toast";

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
  succeeded: "#4a9",
  failed: "#e54",
  waiting_confirmation: "#d90",
  skipped: "#aaa",
};

export default function RunDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<Run | null>(null);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.runs.get(id).then(setRun).catch(() => setError("运行不存在或已删除"));
    const interval = setInterval(() => {
      api.runs.get(id!).then(setRun).catch(() => {});
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

  if (!run) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, opacity: 0.4 }}>
        加载中...
      </div>
    );
  }

  const plan = run.plans?.[0];
  const steps = plan?.steps || [];
  const completedCount = steps.filter((s) => s.status === "succeeded").length;
  const totalCount = steps.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isWaitingConfirmation = run.status === "waiting_confirmation";
  const planId = plan?.id;

  const totalDuration =
    run.started_at && run.ended_at
      ? ((new Date(run.ended_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1)
      : null;

  return (
    <div>
      <ConfirmDialog
        open={confirmDialog}
        title="确认执行流水线"
        message={plan ? `确认执行「${plan.title}」？\n共 ${totalCount} 个步骤将按序执行。` : "确认执行？"}
        onConfirm={async () => {
          if (planId) {
            try {
              await api.plans.confirm(planId);
              toast("已确认，流水线开始执行", "success");
              api.runs.get(run.id).then(setRun);
            } finally {
              setConfirmDialog(false);
            }
          }
        }}
        onCancel={() => setConfirmDialog(false)}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate("/runs")}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--ht-fg)", display: "flex", alignItems: "center",
            gap: 4, fontSize: 13, opacity: 0.5, padding: 0,
          }}
        >
          <ArrowLeft size={16} /> 返回
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{run.name}</h1>
            <StatusBadge status={run.status} size="md" pulse={run.status === "running"} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        <Card variant="outlined" style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Zap size={14} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: 12, opacity: 0.5 }}>触发方式</span>
          </div>
          <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4 }}>{run.trigger_type}</div>
        </Card>
        <Card variant="outlined" style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Calendar size={14} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: 12, opacity: 0.5 }}>开始时间</span>
          </div>
          <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4 }}>
            {run.started_at ? new Date(run.started_at).toLocaleString("zh-CN") : "--"}
          </div>
        </Card>
        <Card variant="outlined" style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Timer size={14} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: 12, opacity: 0.5 }}>总耗时</span>
          </div>
          <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4 }}>
            {totalDuration ? `${totalDuration}s` : run.status === "running" ? "进行中..." : "--"}
          </div>
        </Card>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.6 }}>
            执行进度 {completedCount}/{totalCount}
          </span>
          <span style={{ fontSize: 12, opacity: 0.4 }}>{Math.round(progress)}%</span>
        </div>
        <div style={{ height: 4, background: "var(--ht-border)", borderRadius: 2, overflow: "hidden" }}>
          <div
            style={{
              height: "100%", width: `${progress}%`,
              background: run.status === "failed" ? "#e54" : "var(--ht-accent)",
              borderRadius: 2, transition: "width 0.5s ease",
            }}
          />
        </div>
      </div>

      {isWaitingConfirmation && planId && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <Button variant="primary" size="sm" onClick={() => setConfirmDialog(true)}>
            <Check size={14} style={{ marginRight: 4 }} /> 确认执行
          </Button>
          <Button variant="outline" size="sm" onClick={async () => {
            await api.plans.cancel(planId);
            toast("已取消", "info");
            api.runs.get(run.id).then(setRun);
          }}>
            <X size={14} style={{ marginRight: 4 }} /> 取消
          </Button>
        </div>
      )}

      {run.error_message && (
        <div style={{ fontSize: 13, color: "#e54", marginBottom: 20, padding: "10px 14px", background: "rgba(238,85,68,0.06)", borderRadius: 8 }}>
          {run.error_message}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column" }}>
        {steps.map((step, idx) => {
          const Icon = stepStatusIcon[step.status] || Circle;
          const isRunning = step.status === "running";
          const isExpanded = expandedStep === step.id;
          const isActive = step.status === "running" || step.status === "waiting_confirmation";
          const isDone = step.status === "succeeded";
          const color = stepStatusColor[step.status] || "#ccc";
          const isLast = idx === steps.length - 1;

          return (
            <div key={step.id} style={{ display: "flex", gap: 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 40, flexShrink: 0 }}>
                <div
                  style={{
                    width: 28, height: 28, borderRadius: "50%", background: color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--ht-on-accent)", flexShrink: 0,
                    border: isActive ? "3px solid" : "3px solid transparent",
                    borderColor: isActive ? `${color}40` : "transparent",
                    boxShadow: isRunning ? `0 0 0 4px ${color}15` : "none",
                  }}
                >
                  <Icon size={13} className={isRunning ? "animate-spin" : undefined} />
                </div>
                {!isLast && (
                  <div style={{
                    width: 2, flex: 1, background: isDone ? color : "var(--ht-border)",
                    minHeight: 24, transition: "background 0.3s ease",
                  }} />
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
                    <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.3, width: 18 }}>{step.step_order}</span>
                    <span style={{ fontWeight: 500, fontSize: 14, flex: 1 }}>{step.title}</span>
                    {step.agent_id && <Tag color="accent">{step.agent_id}</Tag>}
                    <StatusBadge status={step.status} pulse={isRunning} />
                  </div>

                  {step.error_message && (
                    <div style={{ fontSize: 12, color: step.status === "failed" ? "#e54" : "#4a9", marginTop: 8, marginLeft: 26, padding: "6px 10px", background: step.status === "failed" ? "rgba(238,85,68,0.06)" : "rgba(68,170,153,0.06)", borderRadius: 6 }}>
                      {step.error_message}
                    </div>
                  )}

                  <div style={{ fontSize: 11, opacity: 0.35, marginTop: 6, marginLeft: 26, display: "flex", gap: 12 }}>
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
                      <Button variant="outline" size="sm" onClick={async () => {
                        await api.steps.retry(step.id);
                        api.runs.get(run.id).then(setRun);
                      }}>
                        <RotateCcw size={12} style={{ marginRight: 4 }} /> 重试
                      </Button>
                    </div>
                  )}
                </Card>

                {isDone && (
                  <div style={{ marginTop: 6, marginLeft: 26 }}>
                    <button
                      onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                      style={{
                        background: "none", border: "1px solid var(--ht-border)",
                        borderRadius: 6, padding: "4px 10px", fontSize: 12,
                        cursor: "pointer", color: "var(--ht-accent)",
                        display: "flex", alignItems: "center", gap: 4,
                      }}
                    >
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      查看产出
                    </button>
                    {isExpanded && (
                      <div className="animate-fade-in" style={{ marginTop: 8 }}>
                        <ArtifactLoader runId={run.id} stepId={step.id} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ArtifactLoader({ runId, stepId }: { runId: string; stepId: string }) {
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.artifacts.list({ run_id: runId }).then((all) => {
      setArtifacts(all);
      setLoading(false);
    });
  }, [runId]);

  if (loading) return <div style={{ opacity: 0.4, fontSize: 12 }}>加载中...</div>;

  const artifact = artifacts.find((a) => a.plan_step_id === stepId);
  if (!artifact) return <div style={{ opacity: 0.4, fontSize: 12 }}>暂无产出</div>;

  return (
    <Card variant="outlined" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{artifact.title}</div>
          <div style={{ fontSize: 11, opacity: 0.4, marginTop: 2 }}>
            <Tag color="accent">{artifact.type}</Tag>
            <span style={{ marginLeft: 8 }}>{new Date(artifact.created_at).toLocaleString("zh-CN")}</span>
          </div>
        </div>
        <a href={api.artifacts.exportUrl(artifact.id)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--ht-accent)" }}>
          <Download size={12} /> 导出
        </a>
      </div>
      {artifact.markdown_content && <MarkdownPreview content={artifact.markdown_content} maxHeight={400} />}
    </Card>
  );
}
