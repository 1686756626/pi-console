import { useEffect, useState } from "react";
import {
  api,
  type ScheduledJob,
  type Pipeline,
} from "../api";
import { Button, Card, inputStyle, labelStyle } from "../ui";
import {
  Plus,
  Trash2,
  Play,
  Clock,
  ToggleLeft,
  ToggleRight,
  X,
  Save,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";
import { toast } from "../components/Toast";

function parseCron(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hour, dom, month, dow] = parts;
  const dayNames = ["日", "一", "二", "三", "四", "五", "六"];
  if (min === "0" && hour !== "*" && dom === "*" && month === "*" && dow === "*") {
    return `每天 ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
  }
  if (min === "0" && hour !== "*" && dom === "*" && month === "*" && dow !== "*") {
    const dayNum = parseInt(dow);
    if (!isNaN(dayNum) && dayNum >= 0 && dayNum <= 6) {
      return `每周${dayNames[dayNum]} ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
    }
    if (dow === "1-5") {
      return `工作日 ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
    }
  }
  if (min === "0" && hour === "0" && dom !== "*" && month === "*" && dow === "*") {
    return `每月 ${dom} 日 00:00`;
  }
  return expr;
}

export default function Scheduler() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    pipeline_id: "",
    cron_expression: "0 8 * * *",
    enabled: true,
  });

  useEffect(() => {
    api.scheduler.list().then(setJobs);
    api.pipelines.list().then(setPipelines);
  }, []);

  async function handleCreate() {
    if (!form.name || !form.pipeline_id || !form.cron_expression) return;
    try {
      await api.scheduler.create(form);
      toast("定时任务已创建", "success");
      setShowCreate(false);
      setForm({ name: "", pipeline_id: "", cron_expression: "0 8 * * *", enabled: true });
      api.scheduler.list().then(setJobs);
    } catch {
      toast("创建失败", "error");
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    await api.scheduler.update(id, { enabled: !enabled });
    api.scheduler.list().then(setJobs);
  }

  async function handleTrigger(id: string) {
    try {
      await api.scheduler.trigger(id);
      toast("已手动触发", "success");
      api.scheduler.list().then(setJobs);
    } catch {
      toast("触发失败", "error");
    }
  }

  async function handleDelete(id: string) {
    await api.scheduler.delete(id);
    setDeleteTarget(null);
    api.scheduler.list().then(setJobs);
    toast("已删除", "info");
  }

  const pipelineMap = new Map(pipelines.map((p) => [p.id, p.label || p.id]));

  return (
    <div>
      <PageHeader
        title="定时调度"
        subtitle={`${jobs.filter((j) => j.enabled).length} 个活跃任务`}
        action={
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} style={{ marginRight: 4 }} /> 新建任务
          </Button>
        }
      />

      {showCreate && (
        <Card variant="outlined" style={{ padding: 20, marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600 }}>新建定时任务</div>
            <button
              onClick={() => setShowCreate(false)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                opacity: 0.4,
                transition: "opacity 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}
            >
              <X size={18} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>任务名称</label>
              <input
                style={inputStyle}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="每日新闻采集"
              />
            </div>
            <div>
              <label style={labelStyle}>流水线</label>
              <select
                style={inputStyle}
                value={form.pipeline_id}
                onChange={(e) => setForm({ ...form, pipeline_id: e.target.value })}
              >
                <option value="">选择流水线</option>
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label || p.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Cron 表达式</label>
              <input
                style={inputStyle}
                value={form.cron_expression}
                onChange={(e) =>
                  setForm({ ...form, cron_expression: e.target.value })
                }
                placeholder="0 8 * * *"
              />
              <div style={{ fontSize: 11, opacity: 0.4, marginTop: 4 }}>
                {parseCron(form.cron_expression)}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <Button variant="primary" onClick={handleCreate}>
                <Save size={14} style={{ marginRight: 6 }} /> 创建任务
              </Button>
            </div>
          </div>
        </Card>
      )}

      {jobs.length === 0 && !showCreate && (
        <EmptyState
          message="暂无定时任务，点击上方按钮创建"
          icon={<Clock size={40} />}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {jobs.map((job) => (
          <Card
            key={job.id}
            variant="outlined"
            style={{
              padding: 16,
              display: "flex",
              alignItems: "center",
              gap: 16,
              opacity: job.enabled ? 1 : 0.5,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "var(--ht-radius-lg)",
                background: job.enabled
                  ? "var(--ht-accent-subtle)"
                  : "var(--ht-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Clock
                size={20}
                style={{
                  color: job.enabled
                    ? "var(--ht-accent)"
                    : "var(--ht-fg)",
                }}
              />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                {job.name}
                <span
                  style={{
                    fontSize: 11,
                    marginLeft: 8,
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: "var(--ht-accent-subtle)",
                    color: "var(--ht-accent)",
                    fontWeight: 500,
                  }}
                >
                  {pipelineMap.get(job.pipeline_id) || job.pipeline_id}
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.5,
                  marginTop: 4,
                  display: "flex",
                  gap: 16,
                }}
              >
                <span>
                  <code
                    style={{
                      background: "var(--ht-accent-subtle)",
                      padding: "1px 6px",
                      borderRadius: 4,
                      fontSize: 11,
                    }}
                  >
                    {job.cron_expression}
                  </code>{" "}
                  {parseCron(job.cron_expression)}
                </span>
                {job.last_run_at && (
                  <span>
                    上次运行:{" "}
                    {new Date(job.last_run_at).toLocaleString("zh-CN")}
                  </span>
                )}
                {job.next_run_at && job.enabled && (
                  <span>
                    下次运行:{" "}
                    {new Date(job.next_run_at).toLocaleString("zh-CN")}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button
                onClick={() => handleToggle(job.id, job.enabled)}
                title={job.enabled ? "禁用" : "启用"}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: job.enabled
                    ? "var(--ht-accent)"
                    : "var(--ht-fg)",
                  display: "flex",
                  padding: 0,
                }}
              >
                {job.enabled ? (
                  <ToggleRight size={22} />
                ) : (
                  <ToggleLeft size={22} />
                )}
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTrigger(job.id)}
                disabled={!job.enabled}
              >
                <Play size={12} style={{ marginRight: 4 }} /> 立即执行
              </Button>
              <button
                onClick={() => setDeleteTarget(job.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  opacity: 0.3,
                  padding: 0,
                  display: "flex",
                  transition: "opacity 0.15s ease, color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "0.8";
                  e.currentTarget.style.color = "var(--ht-error)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "0.3";
                  e.currentTarget.style.color = "inherit";
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除定时任务"
        message="确定要删除这个定时任务吗？"
        confirmLabel="删除"
        cancelLabel="取消"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
