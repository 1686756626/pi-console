import { useEffect, useState, useCallback } from "react";
import { api, type Pipeline, type Agent } from "../api";
import { Button, Card, inputStyle, labelStyle } from "../ui";
import { useToast } from "../components/Toast";
import PageHeader from "../components/PageHeader";
import PipelineFlow from "../components/PipelineFlow";
import {
  Plus,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  X,
  Save,
  Copy,
  ChevronRight,
} from "lucide-react";

interface StepInput {
  agent_id: string;
  title: string;
  description: string;
  prompt_template: string;
  input_key: string;
  output_key: string;
  condition: string;
  parallel_group: string;
  temperature_override: number | null;
  max_tokens_override: number | null;
}

const emptyStep = (order: number, agentId: string): StepInput => ({
  agent_id: agentId,
  title: `步骤 ${order}`,
  description: "",
  prompt_template: "",
  input_key: "",
  output_key: "",
  condition: "",
  parallel_group: "",
  temperature_override: null,
  max_tokens_override: null,
})

export default function Pipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ id: string; label: string; description: string; steps: StepInput[] }>({
    id: "",
    label: "",
    description: "",
    steps: [],
  });
  const [editSteps, setEditSteps] = useState<StepInput[]>([]);
  const [editLabel, setEditLabel] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const { addToast } = useToast();

  useEffect(() => {
    api.pipelines.list().then(setPipelines);
    api.agents.list().then(setAgents);
  }, []);

  const reloadPipelines = useCallback(async () => {
    const p = await api.pipelines.list();
    setPipelines(p);
  }, []);

  async function handleCreate() {
    if (!formData.id || !formData.label) {
      addToast("请填写 ID 和名称", "error");
      return;
    }
    try {
      await api.pipelines.create(formData);
      await reloadPipelines();
      setShowCreate(false);
      setFormData({ id: "", label: "", description: "", steps: [] });
      addToast("流水线已创建", "success");
    } catch (e: any) {
      addToast("创建失败: " + (e.response?.data?.detail || e.message), "error");
    }
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    try {
      await api.pipelines.update(editingId, {
        label: editLabel,
        description: editDesc,
        steps: editSteps,
      });
      await reloadPipelines();
      setEditingId(null);
      addToast("流水线已更新", "success");
    } catch (e: any) {
      addToast("更新失败: " + (e.response?.data?.detail || e.message), "error");
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.pipelines.delete(id);
      await reloadPipelines();
      setDeleteConfirm(null);
      addToast("流水线已删除", "success");
    } catch (e: any) {
      addToast("删除失败: " + (e.response?.data?.detail || e.message), "error");
    }
  }

  async function handleDuplicate(id: string) {
    try {
      await api.pipelines.duplicate(id);
      await reloadPipelines();
      addToast("已复制为自定义流水线", "success");
    } catch (e: any) {
      addToast("复制失败: " + (e.response?.data?.detail || e.message), "error");
    }
  }

  function startEdit(p: Pipeline) {
    setEditingId(p.id);
    setEditLabel(p.label);
    setEditDesc(p.description || "");
    setEditSteps(
      p.steps.map((s) => ({
        agent_id: s.agent_id,
        title: s.title,
        description: s.description || "",
        prompt_template: s.prompt_template || "",
        input_key: s.input_key || "",
        output_key: s.output_key || "",
        condition: s.condition || "",
        parallel_group: s.parallel_group || "",
        temperature_override: s.temperature_override ?? null,
        max_tokens_override: s.max_tokens_override ?? null,
      }))
    );
    setExpandedSteps(new Set());
  }

  function addStep() {
    const firstAgent = agents[0]?.id || "";
    setEditSteps((prev) => [...prev, emptyStep(prev.length + 1, firstAgent)]);
  }

  function removeStep(index: number) {
    setEditSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function moveStep(index: number, direction: -1 | 1) {
    setEditSteps((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  function toggleStepExpand(index: number) {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const PROMPT_PRESETS: { label: string; template: string }[] = [
    { label: "继承上一步结果", template: "请基于以下内容继续工作：\n\n{{previous_output}}\n\n---\n\n{请在这里写你的具体指令}" },
    { label: "独立任务", template: "{请在这里写你的具体指令，不依赖前序步骤}" },
    { label: "分析并总结", template: "请仔细分析以下内容，提取关键信息并生成结构化总结：\n\n{{previous_output}}" },
    { label: "改写润色", template: "请将以下内容改写为更加专业、流畅的文本，保持原意不变：\n\n{{previous_output}}" },
    { label: "对比研究", template: "请对比分析以下内容中的不同观点，给出综合评价：\n\n{{previous_output}}" },
  ];

  const CREATIVE_LEVELS: { label: string; temp: number; desc: string }[] = [
    { label: "严谨", temp: 0.2, desc: "精确、事实性强" },
    { label: "平衡", temp: 0.7, desc: "兼顾创意和准确" },
    { label: "创意", temp: 1.0, desc: "更发散、更有想象力" },
    { label: "狂野", temp: 1.5, desc: "天马行空" },
  ];

  function renderStepEditor(
    step: StepInput, i: number,
    onUpdate: (index: number, field: keyof StepInput, value: any) => void,
    onRemove: (index: number) => void,
    onMove: (index: number, dir: -1 | 1) => void,
    totalSteps: number,
  ) {
    const expanded = expandedSteps.has(i);
    const agentName = agents.find(a => a.id === step.agent_id)?.name || step.agent_id;
    const hasAdvanced = step.condition || step.input_key || step.output_key;

    return (
      <div key={i} style={{
        marginBottom: 8, borderRadius: "var(--ht-radius-lg)",
        border: "1px solid var(--ht-border)",
        background: "var(--ht-surface)",
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
      }}>
        <div style={{
          display: "flex", gap: 8, alignItems: "center",
          padding: "10px 12px",
          background: expanded ? "var(--ht-accent-subtle)" : "transparent",
          cursor: "pointer",
        }} onClick={() => toggleStepExpand(i)}>
          <div style={{
            width: 26, height: 26, borderRadius: "var(--ht-radius-md)",
            background: "var(--ht-accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--ht-on-accent)", fontSize: 12, fontWeight: 700, flexShrink: 0,
          }}>
            {i + 1}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {step.title || "未命名步骤"}
              </span>
              <span style={{
                fontSize: 11, padding: "1px 6px", borderRadius: 4,
                background: "var(--ht-accent-subtle)",
                color: "var(--ht-accent)", fontWeight: 400,
              }}>
                {agentName}
              </span>
              {hasAdvanced && (
                <span style={{
                  fontSize: 10, padding: "1px 5px", borderRadius: 4,
                       background: "var(--ht-success-bg)", color: "var(--ht-success)", fontWeight: 500,
                }}>
                  自定义
                </span>
              )}
            </div>
            {step.description && !expanded && (
              <div style={{ fontSize: 12, opacity: 0.4, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {step.description}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            <button onClick={(e) => { e.stopPropagation(); onMove(i, -1); }} disabled={i === 0}
              style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.15 : 0.4, padding: 2, display: "flex" }}>
              <ChevronUp size={12} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onMove(i, 1); }} disabled={i === totalSteps - 1}
              style={{ background: "none", border: "none", cursor: i === totalSteps - 1 ? "default" : "pointer", opacity: i === totalSteps - 1 ? 0.15 : 0.4, padding: 2, display: "flex" }}>
              <ChevronDown size={12} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onRemove(i); }}
              style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.2, padding: 2, display: "flex", color: "var(--ht-error)" }}>
              <Trash2 size={12} />
            </button>
            <div style={{
              marginLeft: 4, transition: "transform 0.2s ease",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              display: "flex", opacity: 0.3,
            }}>
              <ChevronRight size={14} />
            </div>
          </div>
        </div>

        {expanded && (
          <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid var(--ht-border)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelStyle}>步骤名称</label>
                <input style={inputStyle} value={step.title} placeholder="如: 采集新闻热点"
                  onChange={(e) => onUpdate(i, "title", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>执行智能体</label>
                <select style={inputStyle} value={step.agent_id}
                  onChange={(e) => onUpdate(i, "agent_id", e.target.value)}>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name} - {a.role}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>任务说明</label>
              <input style={inputStyle} value={step.description} placeholder="一句话描述这个步骤要做什么"
                onChange={(e) => onUpdate(i, "description", e.target.value)} />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>自定义提示词</label>
                <div style={{ display: "flex", gap: 4 }}>
                  {PROMPT_PRESETS.map((p, pi) => (
                    <button key={pi} onClick={() => onUpdate(i, "prompt_template", p.template)}
                      style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 4,
                        border: "1px solid var(--ht-border)",
                        background: step.prompt_template === p.template
                          ? "var(--ht-accent)" : "var(--ht-bg)",
                        color: step.prompt_template === p.template ? "#fff" : "var(--ht-fg)",
                        cursor: "pointer", whiteSpace: "nowrap",
                      }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                style={{ ...inputStyle, minHeight: 80, resize: "vertical", fontFamily: "inherit", fontSize: 13, lineHeight: 1.5 }}
                value={step.prompt_template}
                placeholder={"留空则使用默认行为：把上一步的结果作为上下文传给智能体\n\n可以用的变量:\n{{previous_output}} = 上一步的输出内容"}
                onChange={(e) => onUpdate(i, "prompt_template", e.target.value)}
              />
            </div>

            <div style={{
              background: "var(--ht-bg)", borderRadius: "var(--ht-radius-md)", padding: "10px 12px",
              border: "1px solid var(--ht-border)",
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.5, marginBottom: 8 }}>高级选项</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>创意程度</label>
                  <div style={{ display: "flex", gap: 4 }}>
                    {CREATIVE_LEVELS.map((lv, li) => (
                      <button key={li} onClick={() => onUpdate(i, "temperature_override", step.temperature_override === lv.temp ? null : lv.temp)}
                        style={{
                           flex: 1, padding: "5px 0", borderRadius: "var(--ht-radius-md)", fontSize: 11,
                          border: "1px solid",
                          borderColor: step.temperature_override === lv.temp ? "var(--ht-accent)" : "var(--ht-border)",
                          background: step.temperature_override === lv.temp ? "var(--ht-accent)" : "transparent",
                          color: step.temperature_override === lv.temp ? "#fff" : "var(--ht-fg)",
                          cursor: "pointer",
                        }}
                        title={lv.desc}
                      >
                        {lv.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.3, marginTop: 2 }}>
                    {step.temperature_override != null
                      ? CREATIVE_LEVELS.find(l => l.temp === step.temperature_override)?.desc
                      : "使用智能体默认值"}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>输出长度</label>
                  <select style={inputStyle} value={step.max_tokens_override ?? ""}
                    onChange={(e) => onUpdate(i, "max_tokens_override", e.target.value ? parseInt(e.target.value) : null)}>
                    <option value="">使用智能体默认值</option>
                    <option value="1024">短 (约500字)</option>
                    <option value="2048">中 (约1000字)</option>
                    <option value="4096">长 (约2000字)</option>
                    <option value="8192">超长 (约4000字)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                <div>
                  <label style={labelStyle}>给输出起个名字</label>
                  <input style={inputStyle} value={step.output_key} placeholder="如: 新闻稿"
                    onChange={(e) => onUpdate(i, "output_key", e.target.value)} />
                  <div style={{ fontSize: 10, opacity: 0.3, marginTop: 2 }}>
                    给这步的输出起个名字，后面的步骤可以引用
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>仅在上一步包含以下内容时执行</label>
                  <input style={inputStyle} value={step.condition} placeholder="如留空则总是执行"
                    onChange={(e) => onUpdate(i, "condition", e.target.value)} />
                  <div style={{ fontSize: 10, opacity: 0.3, marginTop: 2 }}>
                    满足条件才运行，否则跳过
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function updateStep(index: number, field: keyof StepInput, value: any) {
    setEditSteps((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addCreateStep() {
    const firstAgent = agents[0]?.id || "";
    setFormData((prev) => ({
      ...prev,
      steps: [...prev.steps, emptyStep(prev.steps.length + 1, firstAgent)],
    }));
  }

  function updateCreateStep(index: number, field: keyof StepInput, value: any) {
    setFormData((prev) => {
      const steps = [...prev.steps];
      steps[index] = { ...steps[index], [field]: value };
      return { ...prev, steps };
    });
  }

  function removeCreateStep(index: number) {
    setFormData((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }));
  }

  return (
    <div>
      <PageHeader
        title="流水线编排"
        subtitle={`${pipelines.length} 条流水线`}
        action={
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            新建流水线
          </Button>
        }
      />

      {showCreate && (
        <Card variant="outlined" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>新建流水线</div>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
              <X size={14} />
            </Button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>ID</label>
              <input style={inputStyle} placeholder="my-pipeline" value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value.replace(/[^a-zA-Z0-9_-]/g, "") })} />
            </div>
            <div>
              <label style={labelStyle}>名称</label>
              <input style={inputStyle} placeholder="我的流水线" value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>描述</label>
            <input style={inputStyle} placeholder="流水线用途描述" value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>步骤</label>
              <Button variant="ghost" size="sm" onClick={addCreateStep}>
                <Plus size={12} /> 添加步骤
              </Button>
            </div>
            {formData.steps.length === 0 && (
              <div style={{ fontSize: 13, opacity: 0.4, padding: "12px 0" }}>
                暂无步骤，点击上方按钮添加
              </div>
            )}
            {formData.steps.map((step, i) => renderStepEditor(step, i, updateCreateStep, removeCreateStep, () => {}, formData.steps.length))}
          </div>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>取消</Button>
            <Button variant="primary" size="sm" onClick={handleCreate}>创建</Button>
          </div>
        </Card>
      )}

      {deleteConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999,
          background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Card variant="outlined" style={{ padding: 24, maxWidth: 400, width: "90%" }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>确认删除</div>
            <div style={{ fontSize: 14, opacity: 0.6, marginBottom: 20 }}>
              确定要删除流水线「{pipelines.find((p) => p.id === deleteConfirm)?.label}」吗？
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(null)}>取消</Button>
              <Button variant="primary" size="sm" onClick={() => handleDelete(deleteConfirm)} style={{ background: "var(--ht-error)" }}>删除</Button>
            </div>
          </Card>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {pipelines.map((pipeline) => {
          const isEditing = editingId === pipeline.id;
          return (
            <Card key={pipeline.id} variant="outlined" style={{ padding: 20 }}>
              {isEditing ? (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={labelStyle}>名称</label>
                      <input style={inputStyle} value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>描述</label>
                      <input style={inputStyle} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>步骤</label>
                    <Button variant="ghost" size="sm" onClick={addStep}><Plus size={12} /> 添加</Button>
                  </div>
                  {editSteps.map((step, i) => renderStepEditor(step, i, updateStep, removeStep, moveStep, editSteps.length))}
                  <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>取消</Button>
                    <Button variant="primary" size="sm" onClick={handleSaveEdit}>
                      <Save size={14} /> 保存
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>
                        {pipeline.label}
                        {pipeline.is_custom && (
                          <span style={{ fontSize: 11, marginLeft: 8, padding: "1px 6px", borderRadius: 4, background: "var(--ht-accent-muted)", color: "var(--ht-accent)" }}>
                            自定义
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.5, marginTop: 2 }}>{pipeline.description}</div>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => handleDuplicate(pipeline.id)} title="复制为自定义" className="pi-ghost-btn" style={{
                        background: "none", border: "none", cursor: "pointer",
                        opacity: 0.4, padding: "4px 6px", display: "flex", borderRadius: 4,
                        color: "var(--ht-fg)", fontSize: 13,
                      }}>
                        <Copy size={14} />
                      </button>
                      {pipeline.is_custom && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => startEdit(pipeline)}>
                            <Edit3 size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(pipeline.id)}>
                            <Trash2 size={14} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <PipelineFlow pipeline={pipeline} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
