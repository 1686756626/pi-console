import { useEffect, useState } from "react";
import { api, type McpServer, type McpServerCreateData } from "../api";
import { Button, Card, Tag, inputStyle } from "../ui";
import {
  Plus,
  RefreshCw,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Wrench,
  Server,
  X,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";
import { toast } from "../components/Toast";

export default function McpServers() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);

  useEffect(() => {
    loadServers();
  }, []);

  async function loadServers() {
    try {
      const data = await api.mcp.list();
      setServers(data);
    } catch {
      toast("加载 MCP 服务器失败", "error");
    }
  }

  async function handleRefresh(id: string) {
    setRefreshing(id);
    try {
      const updated = await api.mcp.refresh(id);
      setServers((prev) => prev.map((s) => (s.id === id ? updated : s)));
      toast("工具列表已刷新", "success");
    } catch {
      toast("刷新失败", "error");
    } finally {
      setRefreshing(null);
    }
  }

  async function handleToggle(srv: McpServer) {
    try {
      const updated = await api.mcp.update(srv.id, { enabled: !srv.enabled });
      setServers((prev) => prev.map((s) => (s.id === srv.id ? updated : s)));
      toast(srv.enabled ? "已禁用" : "已启用", "info");
    } catch {
      toast("操作失败", "error");
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.mcp.delete(id);
      setServers((prev) => prev.filter((s) => s.id !== id));
      setDeleteTarget(null);
      toast("已删除", "info");
    } catch {
      toast("删除失败", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="MCP 服务器"
        subtitle="管理 Model Context Protocol 远程工具服务器"
        action={
          <Button
            size="sm"
            onClick={() => setShowAdd(true)}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Plus size={14} />
            添加服务器
          </Button>
        }
      />

      {servers.length === 0 ? (
        <EmptyState message="暂无 MCP 服务器，添加一个以扩展智能体的工具能力" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {servers.map((srv) => (
            <Card key={srv.id} style={{ padding: 20 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 4,
                    }}
                  >
                    <Server size={16} style={{ opacity: 0.6, flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: 15 }}>
                      {srv.name}
                    </span>
                    <Tag color={srv.enabled ? "success" : "neutral"}>
                      {srv.enabled ? "已启用" : "已禁用"}
                    </Tag>
                    {srv.tools && srv.tools.length > 0 && (
                      <span
                        style={{
                          fontSize: 12,
                          opacity: 0.5,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Wrench size={12} />
                        {srv.tools.length} 个工具
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.5,
                      fontFamily: "monospace",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {srv.url}
                  </div>

                  {srv.tools && srv.tools.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <button
                        onClick={() =>
                          setExpandedServer(
                            expandedServer === srv.id ? null : srv.id
                          )
                        }
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 12,
                          color: "var(--ht-accent)",
                          padding: 0,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Wrench size={12} />
                        {expandedServer === srv.id ? "收起工具列表" : "查看工具列表"}
                      </button>
                      {expandedServer === srv.id && (
                        <div
                          style={{
                            marginTop: 8,
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          {srv.tools.map((tool) => (
                            <div
                              key={tool.name}
                              style={{
                                padding: "8px 12px",
                                 background: "var(--ht-accent-muted)",
                                 borderRadius: "var(--ht-radius-md)",
                                fontSize: 13,
                              }}
                            >
                              <div style={{ fontWeight: 600, fontSize: 13 }}>
                                {tool.name}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  opacity: 0.6,
                                  marginTop: 2,
                                }}
                              >
                                {tool.description}
                              </div>
                              {tool.inputSchema?.properties && (
                                <div
                                  style={{
                                    fontSize: 11,
                                    opacity: 0.4,
                                    marginTop: 4,
                                    fontFamily: "monospace",
                                  }}
                                >
                                  参数:{" "}
                                  {Object.keys(tool.inputSchema.properties).join(
                                    ", "
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  <button
                    onClick={() => handleToggle(srv)}
                    title={srv.enabled ? "禁用" : "启用"}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: srv.enabled
                        ? "var(--ht-accent)"
                        : "var(--ht-fg)",
                      opacity: srv.enabled ? 1 : 0.4,
                      padding: 4,
                      display: "flex",
                    }}
                  >
                    {srv.enabled ? (
                      <ToggleRight size={22} />
                    ) : (
                      <ToggleLeft size={22} />
                    )}
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRefresh(srv.id)}
                    disabled={refreshing === srv.id}
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <RefreshCw
                      size={14}
                      className={refreshing === srv.id ? "pi-spin" : ""}
                    />
                    刷新
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteTarget(srv.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      color: "var(--ht-danger)",
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showAdd && (
        <AddServerDialog
          onClose={() => setShowAdd(false)}
          onCreated={(srv) => {
            setServers((prev) => [...prev, srv]);
            setShowAdd(false);
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          open={true}
          title="确认删除"
          message="确定要删除此 MCP 服务器吗？相关工具将不再可用。"
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function AddServerDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (srv: McpServer) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [headerKey, setHeaderKey] = useState("");
  const [headerValue, setHeaderValue] = useState("");
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function addHeader() {
    if (headerKey.trim() && headerValue.trim()) {
      setHeaders((prev) => ({ ...prev, [headerKey.trim()]: headerValue.trim() }));
      setHeaderKey("");
      setHeaderValue("");
    }
  }

  function removeHeader(key: string) {
    setHeaders((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit() {
    if (!name.trim() || !url.trim()) {
      toast("请填写名称和 URL", "error");
      return;
    }
    setLoading(true);
    try {
      const data: McpServerCreateData = {
        name: name.trim(),
        url: url.trim().replace(/\/+$/, ""),
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        enabled: true,
      };
      const srv = await api.mcp.create(data);
      toast("MCP 服务器已添加", "success");
      onCreated(srv);
    } catch (e: any) {
      toast(`添加失败: ${e?.message || "未知错误"}`, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--ht-overlay)",
        backdropFilter: "blur(2px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--ht-surface)",
          borderRadius: "var(--ht-radius-lg)",
          padding: 24,
          width: 520,
          maxWidth: "90vw",
          maxHeight: "85vh",
          overflow: "auto",
          boxShadow: "0 8px 40px var(--ht-overlay)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
            添加 MCP 服务器
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              opacity: 0.4,
              padding: 4,
              transition: "opacity 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ fontSize: 13 }}>
            <span style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
              名称
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如: 智谱搜索"
              style={{ ...inputStyle, boxSizing: "border-box" }}
            />
          </label>

          <label style={{ fontSize: 13 }}>
            <span style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
              MCP 服务器 URL
            </span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="如: https://open.bigmodel.cn/api/mcp/web_search_prime"
              style={{ ...inputStyle, boxSizing: "border-box", fontFamily: "monospace" }}
            />
            <div style={{ fontSize: 11, opacity: 0.4, marginTop: 4 }}>
              StreamableHTTP 端点 (需支持 POST /mcp)
            </div>
          </label>

          <div style={{ fontSize: 13 }}>
            <span style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
              请求头 (可选)
            </span>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                value={headerKey}
                onChange={(e) => setHeaderKey(e.target.value)}
                placeholder="Header 名称"
                onKeyDown={(e) => {
                  if (e.key === "Enter") addHeader();
                }}
                style={{
                  ...inputStyle,
                  flex: 1,
                  padding: "6px 10px",
                  fontSize: 13,
                }}
              />
              <input
                value={headerValue}
                onChange={(e) => setHeaderValue(e.target.value)}
                placeholder="值"
                onKeyDown={(e) => {
                  if (e.key === "Enter") addHeader();
                }}
                style={{
                  ...inputStyle,
                  flex: 1,
                  padding: "6px 10px",
                  fontSize: 13,
                }}
              />
              <Button size="sm" onClick={addHeader}>
                添加
              </Button>
            </div>
            {Object.entries(headers).map(([key, val]) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  padding: "4px 0",
                }}
              >
                <span style={{ fontFamily: "monospace", opacity: 0.7 }}>
                  {key}: {val.substring(0, 20)}...
                </span>
                <button
                  onClick={() => removeHeader(key)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--ht-danger)",
                    padding: 0,
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 8,
            }}
          >
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "添加中..." : "添加并获取工具"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
