import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type RunBrief, type Pipeline } from "../api";
import { Card, PillTabs, Button, Tag, statusTagColor } from "../ui";
import { Play, XCircle, Trash2, CheckSquare } from "lucide-react";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import PipelineFlow from "../components/PipelineFlow";
import Select from "../components/Select";
import ConfirmDialog from "../components/ConfirmDialog";
import { toast } from "../components/Toast";

const statusOptions = [
  { label: "全部", value: "" },
  { label: "运行中", value: "running" },
  { label: "已完成", value: "succeeded" },
  { label: "失败", value: "failed" },
  { label: "等待中", value: "pending" },
];

export default function Runs() {
  const [runs, setRuns] = useState<RunBrief[]>([]);
  const [filter, setFilter] = useState("");
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState("standard");
  const [triggering, setTriggering] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchConfirm, setBatchConfirm] = useState<"cancel" | "delete" | null>(null);
  const navigate = useNavigate();

  function loadRuns() {
    api.runs.list(filter || undefined).then(setRuns);
  }

  useEffect(() => { loadRuns(); }, [filter]);
  useEffect(() => { api.pipelines.list().then(setPipelines); }, []);

  function handleClickRun(run: RunBrief) {
    if (selected.size > 0) {
      toggleSelect(run.id);
      return;
    }
    navigate(`/runs/${run.id}`);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function handleTrigger() {
    setTriggering(true);
    try {
      const run = await api.runs.create(selectedPipeline);
      navigate(`/runs/${run.id}`);
    } catch (err) {
      console.error("Failed to trigger pipeline:", err);
    } finally {
      setTriggering(false);
    }
  }

  async function handleBatchCancel() {
    try {
      const result = await fetch("/api/runs/batch-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      }).then((r) => r.json());
      toast(`已取消 ${result.cancelled} 个运行`, "success");
    } catch {
      toast("批量取消失败", "error");
    }
    setSelected(new Set());
    setBatchConfirm(null);
    loadRuns();
  }

  async function handleBatchDelete() {
    try {
      const result = await fetch("/api/runs/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      }).then((r) => r.json());
      toast(`已删除 ${result.deleted} 个运行`, "success");
    } catch {
      toast("批量删除失败", "error");
    }
    setSelected(new Set());
    setBatchConfirm(null);
    loadRuns();
  }

  const selectedPipelineData = pipelines.find((p) => p.id === selectedPipeline);

  return (
    <div>
      <PageHeader title="运行" subtitle="流水线执行记录" action={
        selected.size > 0 ? (
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              <CheckSquare size={14} style={{ marginRight: 4 }} /> 取消选择 ({selected.size})
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBatchConfirm("cancel")}>
              <XCircle size={14} style={{ marginRight: 4 }} /> 批量取消
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBatchConfirm("delete")}>
              <Trash2 size={14} style={{ marginRight: 4 }} /> 批量删除
            </Button>
          </div>
        ) : undefined
      } />

      <Card variant="outlined" style={{ padding: 16, marginBottom: 24, borderRadius: "var(--ht-radius-lg)" }}>
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>触发流水线</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Select
            value={selectedPipeline}
            onChange={setSelectedPipeline}
            options={pipelines.map((p) => ({ value: p.id, label: p.label, description: p.description }))}
          />
          <Button variant="primary" onClick={handleTrigger} disabled={triggering}>
            <Play size={14} style={{ marginRight: 6 }} />
            {triggering ? "启动中..." : "立即运行"}
          </Button>
        </div>
        {selectedPipelineData && (
          <div style={{ marginTop: 10 }}>
            <PipelineFlow pipeline={selectedPipelineData} />
          </div>
        )}
      </Card>

      <div style={{ marginBottom: 20 }}>
        <PillTabs
          tabs={statusOptions.map((s) => ({ key: s.value, label: s.label }))}
          activeKey={filter}
          onChange={(v) => { setFilter(v); setSelected(new Set()); }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {runs.length === 0 && <EmptyState message="暂无运行记录，触发一条流水线开始" />}
        {runs.map((run) => (
          <Card
            key={run.id}
            variant="outlined"
            style={{
              padding: "14px 16px",
              cursor: "pointer",
              transition: "box-shadow 0.15s ease, border-color 0.15s ease",
              borderLeft: selected.has(run.id) ? "3px solid var(--ht-accent)" : undefined,
              background: selected.has(run.id) ? "var(--ht-accent-subtle)" : undefined,
              borderRadius: "var(--ht-radius-lg)",
            }}
            onClick={() => handleClickRun(run)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                {selected.size > 0 || selected.has(run.id) ? (
                  <input
                    type="checkbox"
                    checked={selected.has(run.id)}
                    onChange={() => toggleSelect(run.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ cursor: "pointer" }}
                  />
                ) : null}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 15 }}>{run.name}</div>
                    <div style={{ fontSize: 12, color: "var(--ht-fg-secondary)", marginTop: 4, display: "flex", gap: 14 }}>
                    <span>{run.trigger_type}</span>
                    <span>
                      {run.started_at ? new Date(run.started_at).toLocaleString("zh-CN") : "未启动"}
                    </span>
                    {run.ended_at && (
                      <span>
                        {(new Date(run.ended_at).getTime() - new Date(run.started_at!).getTime()) / 1000}s
                      </span>
                    )}
                  </div>
                  {run.error_message && (
                    <div style={{ fontSize: 12, color: "var(--ht-error)", marginTop: 4 }}>
                      {run.error_message}
                    </div>
                  )}
                </div>
              </div>
              <Tag color={statusTagColor(run.status)}>{run.status}</Tag>
            </div>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={batchConfirm === "cancel"}
        title="批量取消运行"
        message={`确定要取消选中的 ${selected.size} 个运行吗？`}
        confirmLabel="取消运行"
        cancelLabel="返回"
        onConfirm={handleBatchCancel}
        onCancel={() => setBatchConfirm(null)}
      />

      <ConfirmDialog
        open={batchConfirm === "delete"}
        title="批量删除运行"
        message={`确定要删除选中的 ${selected.size} 个运行吗？此操作不可撤销。`}
        confirmLabel="删除"
        cancelLabel="返回"
        onConfirm={handleBatchDelete}
        onCancel={() => setBatchConfirm(null)}
      />
    </div>
  );
}
