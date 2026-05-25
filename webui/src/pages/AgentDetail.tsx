import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, type Agent, type AgentUpdateData, type McpServer } from "../api";
import { Button, Card, inputStyle, labelStyle } from "../ui";
import { useToast } from "../components/Toast";
import MarkdownPreview from "../components/MarkdownPreview";
import {
  ArrowLeft,
  Bot,
  FileText,
  Settings,
  Wrench,
  Save,
  RotateCcw,
  Loader,
  MessageCircle,
  Send,
  Cable,
  Brain,
  Trash2,
  Plus,
  PanelLeftClose,
  PanelLeft,
  User,
  Sparkles,
  Zap,
  CheckCircle2,
} from "lucide-react";

type TabKey = "overview" | "prompt" | "params" | "tools" | "memory" | "test";

const TAB_ITEMS: { key: TabKey; label: string; icon: typeof Bot }[] = [
  { key: "overview", label: "概述", icon: Bot },
  { key: "prompt", label: "系统提示", icon: FileText },
  { key: "params", label: "参数", icon: Settings },
  { key: "tools", label: "工具", icon: Wrench },
  { key: "memory", label: "记忆", icon: Brain },
  { key: "test", label: "对话", icon: MessageCircle },
];

const AVAILABLE_MODELS = [
  { value: "glm-5.1", label: "GLM-5.1" },
  { value: "glm-4-flash", label: "GLM-4-Flash" },
  { value: "glm-4-plus", label: "GLM-4-Plus" },
  { value: "glm-4-long", label: "GLM-4-Long" },
];

const AVAILABLE_TOOLS = [
  "web_search",
  "save_artifact",
  "notify_status",
  "knowledge_query",
  "call_agent",
  "execute_code",
  "save_memory",
  "recall_memory",
];

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 400,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontSize: 13,
  lineHeight: 1.6,
  resize: "vertical" as const,
};

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [originalPrompt, setOriginalPrompt] = useState("");
  const [promptDirty, setPromptDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<AgentUpdateData>({});
  const [editDirty, setEditDirty] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.agents.get(id).then((a) => {
      setAgent(a);
      setEditData({
        name: a.name,
        description: a.description || "",
        model_name: a.model_name,
        temperature: a.temperature,
        max_tokens: a.max_tokens,
        enabled: a.enabled,
        tools: a.tools || [],
        mcp_server_ids: a.mcp_server_ids ?? [],
      });
    });
    api.agents.getSystemPrompt(id).then((r) => {
      setSystemPrompt(r.content);
      setOriginalPrompt(r.content);
    });
  }, [id]);

  const handleSaveSettings = useCallback(async () => {
    if (!id || !editDirty) return;
    setSaving(true);
    try {
      const updated = await api.agents.update(
        id,
        Object.fromEntries(
          Object.entries(editData).filter(([_, v]) => v !== undefined)
        )
      );
      setAgent(updated);
      setEditDirty(false);
      addToast("已保存", "success");
    } catch (e: any) {
      addToast("保存失败: " + (e.message || "未知错误"), "error");
    } finally {
      setSaving(false);
    }
  }, [id, editData, editDirty, addToast]);

  const handleSavePrompt = useCallback(async () => {
    if (!id || !promptDirty) return;
    setSaving(true);
    try {
      await api.agents.updateSystemPrompt(id, systemPrompt);
      setOriginalPrompt(systemPrompt);
      setPromptDirty(false);
      addToast("系统提示已保存", "success");
    } catch (e: any) {
      addToast("保存失败: " + (e.message || "未知错误"), "error");
    } finally {
      setSaving(false);
    }
  }, [id, systemPrompt, promptDirty, addToast]);

  const handleResetPrompt = useCallback(() => {
    setSystemPrompt(originalPrompt);
    setPromptDirty(false);
  }, [originalPrompt]);

  const handleToolToggle = useCallback(
    (tool: string) => {
      const currentTools = editData.tools || agent?.tools || [];
      const next = currentTools.includes(tool)
        ? currentTools.filter((t) => t !== tool)
        : [...currentTools, tool];
      setEditData((d) => ({ ...d, tools: next }));
      setEditDirty(true);
    },
    [editData.tools, agent?.tools]
  );

  if (!agent) {
    return (
      <div style={{ padding: 40, opacity: 0.5, textAlign: "center" as const }}>
        加载中...
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <Button variant="ghost" size="sm" onClick={() => navigate("/agents")}>
          <ArrowLeft size={16} />
        </Button>
        <div style={{ flex: 1 }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            {agent.name}
          </h1>
          <div style={{ fontSize: 13, opacity: 0.5 }}>{agent.role}</div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            opacity: 0.6,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: agent.enabled ? "var(--ht-success)" : "var(--ht-error)",
            }}
          />
          {agent.enabled ? "已启用" : "已禁用"}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid var(--ht-border)",
          marginBottom: 20,
        }}
      >
        {TAB_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: activeTab === key ? 600 : 400,
              color:
                activeTab === key
                  ? "var(--ht-accent)"
                  : "var(--ht-fg)",
              borderBottom: activeTab === key ? "2px solid var(--ht-accent)" : "2px solid transparent",
              background: "transparent",
              border: "none",
              borderBottomColor: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s ease",
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <OverviewTab
          agent={agent}
          editData={editData}
          onEditData={(d) => {
            setEditData(d);
            setEditDirty(true);
          }}
        />
      )}
      {activeTab === "prompt" && (
        <PromptTab
          value={systemPrompt}
          dirty={promptDirty}
          saving={saving}
          onChange={(v) => {
            setSystemPrompt(v);
            setPromptDirty(true);
          }}
          onSave={handleSavePrompt}
          onReset={handleResetPrompt}
        />
      )}
      {activeTab === "params" && (
        <ParamsTab
          editData={editData}
          saving={saving}
          dirty={editDirty}
          onEditData={(d) => {
            setEditData(d);
            setEditDirty(true);
          }}
          onSave={handleSaveSettings}
        />
      )}
      {activeTab === "tools" && (
        <ToolsTab
          tools={editData.tools || agent.tools || []}
          mcpServerIds={editData.mcp_server_ids ?? agent.mcp_server_ids ?? []}
          onToggle={handleToolToggle}
          onMcpToggle={(serverId) => {
            const current = editData.mcp_server_ids ?? agent.mcp_server_ids ?? [];
            const next = current.includes(serverId)
              ? current.filter((s: string) => s !== serverId)
              : [...current, serverId];
            setEditData((d) => ({ ...d, mcp_server_ids: next }));
            setEditDirty(true);
          }}
          saving={saving}
          dirty={editDirty}
          onSave={handleSaveSettings}
        />
      )}
      {activeTab === "memory" && <MemoryTab agentId={agent.id} />}
      {activeTab === "test" && <TestTab agentId={agent.id} />}
    </div>
  );
}

function OverviewTab({
  agent,
  editData,
  onEditData,
}: {
  agent: Agent;
  editData: AgentUpdateData;
  onEditData: (d: AgentUpdateData) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 600 }}>
      <Card variant="outlined" style={{ padding: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>名称</label>
            <input
              style={inputStyle}
              value={editData.name || ""}
              onChange={(e) =>
                onEditData({ ...editData, name: e.target.value })
              }
            />
          </div>
          <div>
            <label style={labelStyle}>描述</label>
            <textarea
              style={{ ...inputStyle, minHeight: 80, resize: "vertical" as const }}
              value={editData.description || ""}
              onChange={(e) =>
                onEditData({ ...editData, description: e.target.value })
              }
            />
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>角色 ID</label>
              <input style={{ ...inputStyle, opacity: 0.6 }} value={agent.role} readOnly />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>运行时</label>
              <input style={{ ...inputStyle, opacity: 0.6 }} value={agent.runtime} readOnly />
            </div>
          </div>
          <div>
            <label style={labelStyle}>状态</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() =>
                  onEditData({ ...editData, enabled: !editData.enabled })
                }
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  border: "none",
                  background: editData.enabled
                    ? "var(--ht-accent)"
                    : "var(--ht-border)",
                  cursor: "pointer",
                  position: "relative" as const,
                  transition: "background 0.2s ease",
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "var(--ht-surface)",
                    position: "absolute" as const,
                    top: 3,
                    left: editData.enabled ? 23 : 3,
                    transition: "left 0.2s ease",
                  }}
                />
              </button>
              <span style={{ fontSize: 13 }}>
                {editData.enabled ? "已启用" : "已禁用"}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function PromptTab({
  value,
  dirty,
  saving,
  onChange,
  onSave,
  onReset,
}: {
  value: string;
  dirty: boolean;
  saving: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
        }}
      >
        <Button variant="ghost" size="sm" onClick={onReset} disabled={!dirty || saving}>
          <RotateCcw size={14} />
          重置
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onSave}
          disabled={!dirty || saving}
        >
          <Save size={14} />
          {saving ? "保存中..." : "保存提示"}
        </Button>
      </div>
      <Card variant="outlined" style={{ padding: 16 }}>
        <textarea
          style={textareaStyle}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="输入系统提示词..."
        />
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            opacity: 0.4,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>{value.length} 字符</span>
          {dirty && (
            <span style={{ color: "var(--ht-accent)" }}>
              未保存修改
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}

function ParamsTab({
  editData,
  saving,
  dirty,
  onEditData,
  onSave,
}: {
  editData: AgentUpdateData;
  saving: boolean;
  dirty: boolean;
  onEditData: (d: AgentUpdateData) => void;
  onSave: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 500 }}>
      <Card variant="outlined" style={{ padding: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>模型</label>
            <select
              style={inputStyle}
              value={editData.model_name || "glm-5.1"}
              onChange={(e) =>
                onEditData({ ...editData, model_name: e.target.value })
              }
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>
              Temperature ({editData.temperature ?? 0.7})
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={editData.temperature ?? 0.7}
              onChange={(e) =>
                onEditData({
                  ...editData,
                  temperature: parseFloat(e.target.value),
                })
              }
              style={{ width: "100%" }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                opacity: 0.4,
              }}
            >
              <span>精确 (0)</span>
              <span>创意 (2)</span>
            </div>
          </div>
          <div>
            <label style={labelStyle}>最大输出 Token</label>
            <input
              type="number"
              style={inputStyle}
              value={editData.max_tokens ?? 8192}
              min={256}
              max={32768}
              step={256}
              onChange={(e) =>
                onEditData({
                  ...editData,
                  max_tokens: parseInt(e.target.value, 10) || 8192,
                })
              }
            />
          </div>
        </div>
      </Card>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="primary"
          size="sm"
          onClick={onSave}
          disabled={!dirty || saving}
        >
          <Save size={14} />
          {saving ? "保存中..." : "保存参数"}
        </Button>
      </div>
    </div>
  );
}

function ToolsTab({
  tools,
  mcpServerIds,
  onToggle,
  onMcpToggle,
  saving,
  dirty,
  onSave,
}: {
  tools: string[];
  mcpServerIds: string[];
  onToggle: (tool: string) => void;
  onMcpToggle: (serverId: string) => void;
  saving: boolean;
  dirty: boolean;
  onSave: () => void;
}) {
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);

  useEffect(() => {
    api.mcp.list().then(setMcpServers).catch(() => {});
  }, []);

  const toolDescriptions: Record<string, string> = {
    web_search: "搜索互联网获取最新信息",
    save_artifact: "保存产出物到后端",
    notify_status: "更新当前步骤状态",
    knowledge_query: "从知识库检索相关文档片段（BM25）",
    call_agent: "委托任务给其他智能体执行",
    execute_code: "沙箱中执行 Python 代码",
    save_memory: "保存信息到持久记忆",
    recall_memory: "从持久记忆中检索信息",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13, opacity: 0.5, marginBottom: 4 }}>
        管理此智能体可使用的工具。启用后，智能体在运行时可以调用这些工具。
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.3, marginTop: 8 }}>
        内置工具
      </div>
      {AVAILABLE_TOOLS.map((tool) => {
        const enabled = tools.includes(tool);
        return (
          <Card key={tool} variant="outlined" style={{ padding: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    fontFamily: "monospace",
                  }}
                >
                  {tool}
                </div>
                <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>
                  {toolDescriptions[tool] || ""}
                </div>
              </div>
              <button
                onClick={() => onToggle(tool)}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  border: "none",
                  background: enabled
                    ? "var(--ht-accent)"
                    : "var(--ht-border)",
                  cursor: "pointer",
                  position: "relative" as const,
                  transition: "background 0.2s ease",
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "var(--ht-surface)",
                    position: "absolute" as const,
                    top: 3,
                    left: enabled ? 23 : 3,
                    transition: "left 0.2s ease",
                  }}
                />
              </button>
            </div>
          </Card>
        );
      })}

      {mcpServers.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.3, marginTop: 12 }}>
            MCP 服务器工具
          </div>
          <div style={{ fontSize: 12, opacity: 0.45, marginBottom: 4 }}>
            选择此智能体可以使用哪些 MCP 服务器的工具。
          </div>
          {mcpServers.filter((s) => s.enabled).map((srv) => {
            const selected = mcpServerIds.includes(srv.id);
            const toolNames = (srv.tools || []).map((t) => t.name);
            return (
              <Card key={srv.id} variant="outlined" style={{ padding: 16 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Cable size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{srv.name}</span>
                      <span style={{ fontSize: 11, opacity: 0.4 }}>
                        {toolNames.length} 个工具
                      </span>
                    </div>
                    {toolNames.length > 0 && (
                      <div style={{ fontSize: 12, opacity: 0.45, marginTop: 4, fontFamily: "monospace" }}>
                        {toolNames.join(", ")}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => onMcpToggle(srv.id)}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      border: "none",
                      background: selected
                        ? "var(--ht-accent)"
                        : "var(--ht-border)",
                      cursor: "pointer",
                      position: "relative" as const,
                      transition: "background 0.2s ease",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "var(--ht-surface)",
                        position: "absolute" as const,
                        top: 3,
                        left: selected ? 23 : 3,
                        transition: "left 0.2s ease",
                      }}
                    />
                  </button>
                </div>
              </Card>
            );
          })}
        </>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="primary"
          size="sm"
          onClick={onSave}
          disabled={!dirty || saving}
        >
          <Save size={14} />
          {saving ? "保存中..." : "保存工具配置"}
        </Button>
      </div>
    </div>
  );
}

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  web_search_prime: "网络搜索",
  web_reader: "网页阅读",
  save_artifact: "保存内容",
  knowledge_query: "知识检索",
  call_agent: "调用智能体",
  execute_code: "执行代码",
  save_memory: "保存记忆",
  recall_memory: "回忆记忆",
  zread: "阅读工具",
};

function TestTab({ agentId }: { agentId: string }) {
  interface ToolCallInfo {
    tool: string;
    args: Record<string, unknown>;
    status: "running" | "done";
  }
  interface ChatMsg {
    role: "user" | "assistant" | "tool_calls";
    content: string;
    toolCalls?: ToolCallInfo[];
  }

  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { addToast } = useToast();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSessions = useCallback(async () => {
    try {
      const data = await api.chat.listSessions(agentId);
      setSessions(Array.isArray(data) ? data : []);
    } catch {
      setSessions([]);
    }
  }, [agentId]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleNewSession = async () => {
    try {
      const s = await api.chat.createSession(agentId);
      setSessions((prev) => [s, ...prev]);
      setActiveSessionId(s.id);
      setMessages([]);
    } catch {
      addToast("创建会话失败", "error");
    }
  };

  const handleSelectSession = async (sessionId: string) => {
    try {
      const data = await api.chat.getSession(sessionId);
      setActiveSessionId(sessionId);
      setMessages(
        (data.messages || []).map((m: any) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      );
    } catch {
      addToast("加载会话失败", "error");
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await api.chat.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch {
      addToast("删除失败", "error");
    }
  };

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || running) return;

    const userMsg: ChatMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setRunning(true);

    let sessionId = activeSessionId;
    if (!sessionId) {
      try {
        const s = await api.chat.createSession(agentId, text.slice(0, 30));
        sessionId = s.id;
        setActiveSessionId(sessionId);
        setSessions((prev) => [s, ...prev]);
        await api.chat.appendMessages(s.id, [{ role: "user", content: text }]);
      } catch {
        setRunning(false);
        return;
      }
    } else {
      try {
        await api.chat.appendMessages(sessionId, [{ role: "user", content: text }]);
      } catch {}
    }

    const apiMessages = newMessages.map((m) => ({ role: m.role, content: m.content }));
    const controller = new AbortController();
    abortRef.current = controller;

    let fullReply = "";
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const resp = await fetch(api.agents.testRunUrl(agentId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        fullReply = `[错误] HTTP ${resp.status}`;
        setMessages((prev) => {
          const u = [...prev]; u[u.length - 1] = { role: "assistant", content: fullReply }; return u;
        });
        setRunning(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "delta") {
              fullReply += data.content;
              setMessages((prev) => {
                const u = [...prev]; u[u.length - 1] = { role: "assistant", content: fullReply }; return u;
              });
            } else if (data.type === "tool_call") {
              setMessages((prev) => {
                const u = [...prev];
                const last = u[u.length - 1];
                if (last.role === "tool_calls" && last.toolCalls) {
                  last.toolCalls = [...last.toolCalls, { tool: data.tool, args: data.args, status: "running" as const }];
                  return [...u];
                }
                u.splice(u.length - 1, 0, {
                  role: "tool_calls" as const,
                  content: "",
                  toolCalls: [{ tool: data.tool, args: data.args, status: "running" as const }],
                });
                return u;
              });
            } else if (data.type === "tool_result") {
              setMessages((prev) => {
                const u = [...prev];
                for (let j = u.length - 1; j >= 0; j--) {
                  if (u[j].role === "tool_calls" && u[j].toolCalls) {
                    u[j] = { ...u[j], toolCalls: u[j].toolCalls!.map(tc => ({ ...tc, status: "done" as const })) };
                    break;
                  }
                }
                return u;
              });
            } else if (data.type === "error") {
              fullReply += `\n[错误] ${data.message}`;
              setMessages((prev) => {
                const u = [...prev]; u[u.length - 1] = { role: "assistant", content: fullReply }; return u;
              });
            }
          } catch {}
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        fullReply += `\n[错误] ${e.message}`;
        setMessages((prev) => {
          const u = [...prev]; u[u.length - 1] = { role: "assistant", content: fullReply }; return u;
        });
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
      inputRef.current?.focus();
      if (sessionId && fullReply) {
        try {
          await api.chat.appendMessages(sessionId, [{ role: "assistant", content: fullReply }]);
        } catch {}
        loadSessions();
      }
    }
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 220px)", minHeight: 460, margin: "-20px", borderRadius: 0 }}>
      <style>{`
        .chat-sidebar-item { transition: background 0.15s ease; }
        .chat-sidebar-item:hover { background: var(--ht-accent-muted); }
        .chat-sidebar-item.active { background: var(--ht-accent-muted); }
        .chat-sidebar-item .chat-delete-btn { opacity: 0; transition: opacity 0.15s ease; }
        .chat-sidebar-item:hover .chat-delete-btn { opacity: 0.5; }
        .chat-sidebar-item .chat-delete-btn:hover { opacity: 0.8 !important; }
        .chat-msg-enter { animation: chat-msg-in 0.25s ease-out; }
        @keyframes chat-msg-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
        .typing-dot { animation: typing-bounce 1.2s ease-in-out infinite; }
        .typing-dot:nth-child(2) { animation-delay: 0.15s; }
        .typing-dot:nth-child(3) { animation-delay: 0.3s; }
      `}</style>

      {sidebarOpen && (
        <div style={{
          width: 240, flexShrink: 0,
          background: "var(--ht-surface)",
          borderRight: "1px solid var(--ht-border)",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{
            padding: "16px 12px 12px",
            borderBottom: "1px solid var(--ht-border)",
          }}>
            <button
              onClick={handleNewSession}
              style={{
                width: "100%", padding: "9px 0", borderRadius: "var(--ht-radius-md)",
                border: "1px dashed var(--ht-border)",
                background: "transparent", cursor: "pointer",
                fontSize: 13, fontWeight: 500,
                color: "var(--ht-accent)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--ht-accent-subtle)";
                e.currentTarget.style.borderColor = "var(--ht-accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "var(--ht-border)";
              }}
            >
              <Plus size={14} /> 新对话
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px" }}>
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => handleSelectSession(s.id)}
                className={`chat-sidebar-item ${activeSessionId === s.id ? "active" : ""}`}
                style={{
                  padding: "10px 10px",
                  borderRadius: "var(--ht-radius-md)",
                  marginBottom: 2,
                  cursor: "pointer",
                  fontSize: 13,
                  lineHeight: 1.4,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  position: "relative",
                }}
              >
                <div style={{
                   width: 28, height: 28, borderRadius: "var(--ht-radius-md)", flexShrink: 0,
                  background: activeSessionId === s.id
                    ? "var(--ht-accent)"
                    : "var(--ht-accent-subtle)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s ease",
                }}>
                  <MessageCircle size={13} style={{
                    color: activeSessionId === s.id ? "#fff" : "var(--ht-accent)",
                    opacity: activeSessionId === s.id ? 1 : 0.6,
                  }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: activeSessionId === s.id ? 600 : 400,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {s.title}
                  </div>
                  {s.last_message && (
                    <div style={{
                      fontSize: 11, opacity: 0.4, marginTop: 1,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {s.last_message}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => handleDeleteSession(e, s.id)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    opacity: 0, padding: 4, display: "flex",
                    color: "var(--ht-fg)", borderRadius: 4,
                    position: "absolute", right: 4, top: 10,
                    transition: "opacity 0.15s ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.6"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "0"; }}
                  className="chat-delete-btn"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {sessions.length === 0 && (
              <div style={{ padding: "24px 12px", textAlign: "center", fontSize: 12, opacity: 0.3, lineHeight: 1.6 }}>
                暂无历史会话
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--ht-bg)" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 20px",
          borderBottom: "1px solid var(--ht-border)",
          background: "var(--ht-surface)",
        }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              display: "flex", padding: 4, color: "var(--ht-fg)",
              opacity: 0.4, borderRadius: 4,
              transition: "opacity 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.7"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.4"; }}
          >
            {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {activeSessionId ? sessions.find(s => s.id === activeSessionId)?.title || "对话" : "新对话"}
            </div>
            <div style={{ fontSize: 11, opacity: 0.4, marginTop: 1 }}>
              {activeSessionId ? `${messages.length} 条消息` : "输入消息开始"}
            </div>
          </div>
          {running && (
            <div style={{
              fontSize: 11, color: "var(--ht-accent)",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <Loader size={12} className="pi-spin" />
              生成中
            </div>
          )}
        </div>

        <div style={{
          flex: 1, overflowY: "auto",
          padding: "20px 24px",
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          {messages.length === 0 && (
            <div style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ textAlign: "center", opacity: 0.35 }}>
                <div style={{
                   width: 56, height: 56, borderRadius: "var(--ht-radius-lg)",
                  background: "var(--ht-accent-subtle)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px",
                }}>
                  <Sparkles size={24} style={{ color: "var(--ht-accent)" }} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>开始新对话</div>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                  输入消息与智能体对话<br/>
                  <span style={{ fontSize: 11 }}>Enter 发送 / Shift+Enter 换行</span>
                </div>
              </div>
            </div>
          )}
          {messages.map((msg, i) => {
            if (msg.role === "tool_calls" && msg.toolCalls) {
              return (
                <div key={i} className="chat-msg-enter" style={{
                  display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap",
                  padding: "4px 0",
                }}>
                  {msg.toolCalls.map((tc, j) => (
                    <div key={j} style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "4px 10px 4px 8px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 500,
                      background: tc.status === "done"
                        ? "var(--ht-accent-subtle)"
                        : "var(--ht-accent-muted)",
                      color: "var(--ht-accent)",
                      border: "1px solid var(--ht-border)",
                      transition: "all 0.2s ease",
                    }}>
                      {tc.status === "running" ? (
                        <Loader size={11} className="pi-spin" />
                      ) : (
                        <CheckCircle2 size={11} style={{ opacity: 0.6 }} />
                      )}
                      <Zap size={10} style={{ opacity: 0.5 }} />
                      {TOOL_DISPLAY_NAMES[tc.tool] || tc.tool}
                      {(() => {
                        const els: React.ReactNode[] = [];
                        if (tc.args?.query && typeof tc.args.query === "string") {
                          els.push(<span key="q" style={{ opacity: 0.5, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tc.args.query as string}</span>);
                        }
                        if (tc.args?.keywords && typeof tc.args.keywords === "string") {
                          els.push(<span key="kw" style={{ opacity: 0.5, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tc.args.keywords as string}</span>);
                        }
                        return els;
                      })()}
                    </div>
                  ))}
                </div>
              );
            }
            return (
              <div key={i} className="chat-msg-enter" style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                gap: 10,
              }}>
                {msg.role === "assistant" && (
                  <div style={{
                   width: 30, height: 30, borderRadius: "var(--ht-radius-md)", flexShrink: 0,
                     background: "var(--ht-accent)",
                     display: "flex", alignItems: "center", justifyContent: "center",
                     marginTop: 2,
                   }}>
                     <Bot size={14} style={{ color: "var(--ht-on-accent)" }} />
                  </div>
                )}
                <div style={{ maxWidth: "72%", minWidth: 40 }}>
                  <div style={{
                    padding: msg.role === "user" ? "10px 16px" : "14px 16px",
                    borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    fontSize: 14,
                    lineHeight: 1.6,
                    background: msg.role === "user"
                      ? "var(--ht-accent)"
                      : "var(--ht-surface)",
                    color: msg.role === "user" ? "#fff" : "var(--ht-fg)",
                    boxShadow: msg.role === "user"
                      ? "none"
                      : "0 1px 3px rgba(0,0,0,0.06)",
                    border: msg.role === "user" ? "none" : "1px solid var(--ht-border)",
                  }}>
                    {msg.role === "assistant" && !msg.content ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 0" }}>
                        <div className="typing-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ht-accent)", opacity: 0.6 }} />
                        <div className="typing-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ht-accent)", opacity: 0.6 }} />
                        <div className="typing-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ht-accent)", opacity: 0.6 }} />
                      </div>
                    ) : msg.role === "assistant" ? (
                      <MarkdownPreview content={msg.content} inline />
                    ) : (
                      <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.content}</span>
                    )}
                  </div>
                </div>
                {msg.role === "user" && (
                  <div style={{
                     width: 30, height: 30, borderRadius: "var(--ht-radius-md)", flexShrink: 0,
                     background: "var(--ht-accent-muted)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginTop: 2,
                  }}>
                    <User size={14} style={{ color: "var(--ht-accent)" }} />
                  </div>
                )}
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        <div style={{
          padding: "16px 24px 20px",
          background: "var(--ht-surface)",
          borderTop: "1px solid var(--ht-border)",
        }}>
          <div style={{
            display: "flex", gap: 10, alignItems: "flex-end",
            background: "var(--ht-bg)",
            borderRadius: "var(--ht-radius-lg)",
            border: "1px solid var(--ht-border)",
            padding: "4px 4px 4px 16px",
            transition: "border-color 0.2s ease",
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              rows={1}
              style={{
                flex: 1, padding: "8px 0",
                border: "none", background: "transparent",
                color: "var(--ht-fg)",
                fontSize: 14, outline: "none",
                resize: "none",
                minHeight: 36, maxHeight: 120, lineHeight: 1.5,
              }}
            />
            {running ? (
              <button
                onClick={() => abortRef.current?.abort()}
                style={{
                   width: 36, height: 36, borderRadius: "var(--ht-radius-md)",
                   border: "none", cursor: "pointer",
                   background: "var(--ht-border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--ht-fg)", fontSize: 12, fontWeight: 600,
                  transition: "background 0.15s ease",
                }}
              >
                停止
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                style={{
                   width: 36, height: 36, borderRadius: "var(--ht-radius-md)",
                   border: "none", cursor: input.trim() ? "pointer" : "default",
                  background: input.trim()
                    ? "var(--ht-accent)"
                    : "var(--ht-border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s ease",
                  opacity: input.trim() ? 1 : 0.5,
                }}
              >
                <Send size={14} style={{ color: input.trim() ? "#fff" : "var(--ht-fg)" }} />
              </button>
            )}
          </div>
          <div style={{ fontSize: 10, opacity: 0.25, textAlign: "center", marginTop: 6 }}>
            Enter 发送 / Shift+Enter 换行
          </div>
        </div>
      </div>
    </div>
  );
}

function MemoryTab({ agentId }: { agentId: string }) {
  const { addToast } = useToast();
  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("fact");
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);

  const loadMemories = useCallback(async () => {
    try {
      const data = await api.memories.list(agentId);
      setMemories(Array.isArray(data) ? data : []);
    } catch {
      setMemories([]);
    }
    setLoading(false);
  }, [agentId]);

  useEffect(() => { loadMemories(); }, [loadMemories]);

  const handleAdd = async () => {
    if (!newKey.trim() || !newContent.trim()) return;
    setSaving(true);
    try {
      await api.memories.create({
        agent_id: agentId,
        key: newKey.trim(),
        content: newContent.trim(),
        category: newCategory,
      });
      setNewKey("");
      setNewContent("");
      addToast("记忆已保存", "success");
      loadMemories();
    } catch {
      addToast("保存失败", "error");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.memories.delete(id);
      addToast("已删除", "success");
      loadMemories();
    } catch {
      addToast("删除失败", "error");
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    try {
      const data = await api.memories.search(agentId, searchQuery);
      setSearchResults(data.memories);
    } catch {
      addToast("搜索失败", "error");
    }
  };

  const displayMemories = searchResults ?? memories;

  const categoryLabels: Record<string, string> = {
    preference: "偏好",
    fact: "事实",
    context: "上下文",
    instruction: "指令",
  };
  const categoryColors: Record<string, string> = {
    preference: "#6b5b95",
    fact: "var(--ht-success)",
    context: "#e9a",
    instruction: "#e93",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 13, opacity: 0.5 }}>
        管理此智能体的持久记忆。智能体在运行时可通过 recall_memory 工具检索这些记忆。
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>搜索记忆</label>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="输入关键词搜索..."
            style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: "1px solid var(--ht-border)", borderRadius: "var(--ht-radius-md)", background: "var(--ht-bg)", color: "var(--ht-fg)" }}
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleSearch}>搜索</Button>
        {searchResults && (
          <Button variant="outline" size="sm" onClick={() => { setSearchResults(null); setSearchQuery(""); }}>清除</Button>
        )}
      </div>

      <Card variant="outlined" style={{ padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>添加新记忆</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="键名 (如: user_preference_theme)"
            style={{ flex: 1, padding: "8px 12px", fontSize: 13, border: "1px solid var(--ht-border)", borderRadius: "var(--ht-radius-md)", background: "var(--ht-bg)", color: "var(--ht-fg)" }}
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            style={{ padding: "8px 12px", fontSize: 13, border: "1px solid var(--ht-border)", borderRadius: "var(--ht-radius-md)", background: "var(--ht-bg)", color: "var(--ht-fg)" }}
          >
            <option value="fact">事实</option>
            <option value="preference">偏好</option>
            <option value="context">上下文</option>
            <option value="instruction">指令</option>
          </select>
        </div>
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="记忆内容..."
          rows={3}
          style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: "1px solid var(--ht-border)", borderRadius: "var(--ht-radius-md)", marginBottom: 8, resize: "vertical", background: "var(--ht-bg)", color: "var(--ht-fg)" }}
        />
        <Button variant="primary" size="sm" onClick={handleAdd} disabled={saving || !newKey.trim() || !newContent.trim()}>
          {saving ? "保存中..." : "添加记忆"}
        </Button>
      </Card>

      <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.5 }}>
        {searchResults ? `搜索结果 (${displayMemories.length})` : `全部记忆 (${memories.length})`}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 20, opacity: 0.5 }}>加载中...</div>
      ) : displayMemories.length === 0 ? (
        <div style={{ textAlign: "center", padding: 20, opacity: 0.4 }}>暂无记忆</div>
      ) : (
        displayMemories.map((m) => (
          <Card key={m.id} variant="outlined" style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600 }}>{m.key}</span>
                  <span style={{
                    fontSize: 10,
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: categoryColors[m.category] || "var(--ht-fg-secondary)",
                    color: "var(--ht-on-accent)",
                  }}>
                    {categoryLabels[m.category] || m.category}
                  </span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>{m.content}</div>
              </div>
              <button
                onClick={() => handleDelete(m.id)}
                style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.3, padding: 4 }}
                title="删除"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
