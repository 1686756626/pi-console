import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Agent, type Pipeline, type AgentCreateData } from "../api";
import { Button, Card, Tag, inputStyle, labelStyle } from "../ui";
import { useToast } from "../components/Toast";
import {
  Bot,
  FileText,
  PenLine,
  BookOpen,
  Newspaper,
  BarChart3,
  Microscope,
  ChevronRight,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import PageHeader from "../components/PageHeader";

const roleConfig: Record<string, {
  color: string;
  tagColor: "accent" | "accent2" | "success" | "warning" | "neutral";
  icon: typeof Bot;
}> = {
  "news-curator": { color: "#d97706", tagColor: "warning", icon: Newspaper },
  researcher: { color: "#2563eb", tagColor: "accent2", icon: BookOpen },
  "deep-researcher": { color: "#7c3aed", tagColor: "accent", icon: Microscope },
  writer: { color: "#059669", tagColor: "success", icon: PenLine },
  "zhihu-writer": { color: "#0ea5e9", tagColor: "accent", icon: FileText },
  "journal-summarizer": { color: "#8b5cf6", tagColor: "accent2", icon: BarChart3 },
};

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState<AgentCreateData>({
    id: "",
    name: "",
    role: "custom",
    description: "",
    tools: ["save_artifact"],
  });
  const navigate = useNavigate();
  const { addToast } = useToast();

  useEffect(() => {
    api.agents.list().then(setAgents);
    api.pipelines.list().then(setPipelines);
  }, []);

  function getAgentPipelines(agentId: string): string[] {
    return pipelines
      .filter((p) => p.steps.some((s) => s.agent_id === agentId))
      .map((p) => p.label);
  }

  async function handleCreate() {
    if (!formData.id || !formData.name) {
      addToast("请填写 ID 和名称", "error");
      return;
    }
    try {
      const agent = await api.agents.create(formData);
      setAgents((prev) => [...prev, agent]);
      setShowCreate(false);
      setFormData({ id: "", name: "", role: "custom", description: "", tools: ["save_artifact"] });
      addToast("智能体已创建", "success");
    } catch (e: any) {
      addToast("创建失败: " + (e.response?.data?.detail || e.message), "error");
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.agents.delete(id);
      setAgents((prev) => prev.filter((a) => a.id !== id));
      setDeleteConfirm(null);
      addToast("智能体已删除", "success");
    } catch (e: any) {
      addToast("删除失败: " + (e.response?.data?.detail || e.message), "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="智能体"
        subtitle={`${agents.length} 个智能体已配置`}
        action={
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            新建智能体
          </Button>
        }
      />

      {showCreate && (
        <Card variant="outlined" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>新建智能体</div>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
              <X size={14} />
            </Button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>ID（英文、数字、短横线）</label>
              <input
                style={inputStyle}
                placeholder="my-agent"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value.replace(/[^a-zA-Z0-9_-]/g, "") })}
              />
            </div>
            <div>
              <label style={labelStyle}>名称</label>
              <input
                style={inputStyle}
                placeholder="我的智能体"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>描述</label>
            <input
              style={inputStyle}
              placeholder="智能体的用途描述"
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>角色标识</label>
            <input
              style={inputStyle}
              placeholder="custom"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            />
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
          background: "var(--ht-overlay)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Card variant="outlined" style={{ padding: 24, maxWidth: 400, width: "90%" }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>确认删除</div>
            <div style={{ fontSize: 14, opacity: 0.6, marginBottom: 20 }}>
              确定要删除智能体「{agents.find((a) => a.id === deleteConfirm)?.name}」吗？此操作不可撤销。
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(null)}>取消</Button>
              <Button variant="primary" size="sm" onClick={() => handleDelete(deleteConfirm)} style={{ background: "var(--ht-error)" }}>
                删除
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
        {agents.map((agent) => {
          const config = roleConfig[agent.role] || {
            color: "var(--ht-fg-secondary)",
            tagColor: "neutral" as const,
            icon: Bot,
          };
          const tools = agent.tools || ["save_artifact"];
          const Icon = config.icon;
          const agentPipelines = getAgentPipelines(agent.id);

          return (
            <Card
              key={agent.id}
              variant="outlined"
              style={{
                padding: 20,
                cursor: "pointer",
                transition: "box-shadow 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div
                  onClick={() => navigate(`/agents/${agent.id}`)}
                  style={{
                    width: 42, height: 42, borderRadius: "var(--ht-radius-lg)", background: config.color,
                    display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ht-on-accent)", flexShrink: 0,
                  }}
                >
                  <Icon size={20} />
                </div>
                <div style={{ flex: 1 }} onClick={() => navigate(`/agents/${agent.id}`)}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{agent.name}</div>
                  <Tag color={config.tagColor}>{agent.role}</Tag>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(agent.id); }}
                    style={{
                      background: "transparent", border: "none", cursor: "pointer",
                      padding: 4, borderRadius: "var(--ht-radius-md)", color: "var(--ht-fg)", opacity: 0.3,
                      transition: "opacity 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.3")}
                  >
                    <Trash2 size={14} />
                  </button>
                  <ChevronRight size={16} style={{ opacity: 0.3 }} onClick={() => navigate(`/agents/${agent.id}`)} />
                </div>
              </div>

              <p style={{ fontSize: 13, opacity: 0.6, margin: "0 0 14px", lineHeight: 1.5 }}
                onClick={() => navigate(`/agents/${agent.id}`)}>
                {agent.description || "暂无描述"}
              </p>

              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}
                onClick={() => navigate(`/agents/${agent.id}`)}>
                {tools.map((tool) => (
                  <span key={tool} style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: "var(--ht-radius-md)",
                    background: "var(--ht-accent-muted)",
                    color: "var(--ht-accent)", fontFamily: "monospace",
                  }}>
                    {tool}
                  </span>
                ))}
              </div>

              {agentPipelines.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", gap: 4, flexWrap: "wrap" }}
                  onClick={() => navigate(`/agents/${agent.id}`)}>
                  {agentPipelines.map((name) => (
                    <span key={name} style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: "var(--ht-radius-md)",
                      border: "1px solid var(--ht-border)", color: "var(--ht-fg)",
                    }}>
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
