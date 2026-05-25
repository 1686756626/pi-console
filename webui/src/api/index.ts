import client from "./client";

export { client };

export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string | null;
  tools: string[] | null;
  model_name: string;
  temperature: number | null | undefined;
  max_tokens: number | null | undefined;
  runtime: string;
  enabled: boolean;
  mcp_server_ids: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface AgentUpdateData {
  name?: string;
  description?: string | null;
  tools?: string[];
  model_name?: string;
  temperature?: number | null;
  max_tokens?: number | null;
  enabled?: boolean;
  mcp_server_ids?: string[] | null;
}

export interface AgentCreateData {
  id: string;
  name: string;
  role: string;
  description?: string;
  tools?: string[];
  model_name?: string;
  temperature?: number;
  max_tokens?: number;
  mcp_server_ids?: string[] | null;
}

export interface Artifact {
  id: string;
  run_id: string | null;
  plan_step_id: string | null;
  type: string;
  title: string;
  path_or_url: string;
  markdown_content: string | null;
  created_at: string;
  run_name?: string | null;
}

export interface Space {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
  page_count: number;
}

export interface WikiPage {
  id: string;
  space_id: string;
  parent_id: string | null;
  title: string;
  content: string | null;
  source_artifact_id: string | null;
  source_run_id: string | null;
  created_at: string;
  updated_at: string;
  children: WikiPage[];
}

export interface SearchResult {
  id: string;
  title: string;
  space_id: string;
  space_name: string;
  updated_at: string | null;
  snippet: string;
}

export interface TagItem {
  id: string;
  name: string;
  normalized_name: string;
  color: string | null;
  description: string | null;
  usage_count: number;
  created_at: string;
}

export interface Memo {
  id: string;
  content: string;
  visibility: string;
  pinned: boolean;
  tags_extracted: string[] | null;
  parent_id: string | null;
  source: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface DailyReview {
  date: string;
  memos: { id: string; content: string; pinned: boolean; tags_extracted: string[] | null; created_at: string }[];
  artifacts: { id: string; type: string; title: string; created_at: string }[];
  runs: { id: string; name: string; status: string; created_at: string }[];
  pages_updated: { id: string; title: string; updated_at: string }[];
}

export interface Checkpoint {
  id: string;
  run_id: string;
  step_index: number;
  step_status: string;
  input_data: string | null;
  output_data: string | null;
  error_message: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface ScheduledJob {
  id: string;
  name: string;
  pipeline_id: string;
  cron_expression: string;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  run_config: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeDocument {
  id: string;
  source_type: string;
  source_id: string | null;
  title: string;
  status: string;
  chunk_count: number;
  created_at: string;
}

export interface KnowledgeQueryResult {
  document_id: string;
  title: string;
  source_type: string;
  source_id: string | null;
  chunk_index: number;
  content: string;
  score: number;
}

export interface PageRevision {
  id: string;
  page_id: string;
  revision_number: number;
  title: string;
  content_length: number;
  created_at: string;
}

export interface PageRevisionDetail extends PageRevision {
  content: string | null;
}

export interface PlanStep {
  id: string;
  plan_id: string;
  step_order: number;
  title: string;
  description: string | null;
  status: string;
  agent_id: string | null;
  output_artifact_id: string | null;
  error_message: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  artifact: Artifact | null;
}

export interface Plan {
  id: string;
  run_id: string;
  title: string;
  status: string;
  created_by_agent_id: string | null;
  created_at: string;
  updated_at: string;
  steps: PlanStep[];
}

export interface Run {
  id: string;
  name: string;
  status: string;
  trigger_type: string;
  started_at: string | null;
  ended_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  plans: {
    id: string;
    title: string;
    status: string;
    created_at: string;
    steps: {
      id: string;
      step_order: number;
      title: string;
      status: string;
      agent_id: string | null;
      error_message: string | null;
      started_at: string | null;
      ended_at: string | null;
    }[];
  }[];
}

export interface RunBrief {
  id: string;
  name: string;
  status: string;
  trigger_type: string;
  started_at: string | null;
  ended_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface PipelineStep {
  agent_id: string;
  title: string;
  description: string;
  prompt_template?: string;
  input_key?: string;
  output_key?: string;
  condition?: string;
  parallel_group?: string;
  temperature_override?: number | null;
  max_tokens_override?: number | null;
}

export interface Pipeline {
  id: string;
  label: string;
  description: string;
  steps: PipelineStep[];
  is_custom?: boolean;
}

export interface PipelineCreateData {
  id: string;
  label: string;
  description?: string;
  steps: PipelineStep[];
}

export interface PipelineUpdateData {
  label?: string;
  description?: string;
  steps?: PipelineStep[];
}

export interface Dashboard {
  running_count: number;
  failed_count: number;
  waiting_confirmation_count: number;
  today_artifacts_count: number;
  latest_runs: RunBrief[];
  latest_artifacts: Artifact[];
}

export interface McpServer {
  id: string;
  name: string;
  url: string;
  headers: Record<string, string> | null;
  enabled: boolean;
  transport: string;
  command: string[] | null;
  env: Record<string, string> | null;
  tools: McpTool[] | null;
  created_at: string;
  updated_at: string;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface McpServerCreateData {
  name: string;
  url: string;
  headers?: Record<string, string>;
  enabled?: boolean;
  transport?: string;
  command?: string[];
  env?: Record<string, string>;
}

export interface McpServerUpdateData {
  name?: string;
  url?: string;
  headers?: Record<string, string>;
  enabled?: boolean;
}

export const api = {
  dashboard: {
    get: () => client.get<Dashboard>("/dashboard").then((r) => r.data),
  },
  agents: {
    list: () => client.get<Agent[]>("/agents").then((r) => r.data),
    get: (id: string) => client.get<Agent>(`/agents/${id}`).then((r) => r.data),
    create: (data: AgentCreateData) =>
      client.post<Agent>("/agents", data).then((r) => r.data),
    update: (id: string, data: AgentUpdateData) =>
      client.put<Agent>(`/agents/${id}`, data).then((r) => r.data),
    delete: (id: string) =>
      client.delete(`/agents/${id}`).then((r) => r.data),
    getSystemPrompt: (id: string) =>
      client.get<{ agent_id: string; content: string }>(`/agents/${id}/system-prompt`).then((r) => r.data),
    updateSystemPrompt: (id: string, content: string) =>
      client.put<{ agent_id: string; content: string; saved: boolean }>(`/agents/${id}/system-prompt`, { content }).then((r) => r.data),
    testRunUrl: (id: string) => `/api/agents/${id}/test-run`,
  },
  runs: {
    list: (status?: string) => client.get<RunBrief[]>("/runs", { params: { status } }).then((r) => r.data),
    create: (pipelineId: string, name?: string) =>
      client.post<Run>("/runs", { pipeline_id: pipelineId, name, trigger_type: "manual" }).then((r) => r.data),
    get: (id: string) => client.get<Run>(`/runs/${id}`).then((r) => r.data),
  },
  pipelines: {
    list: () => client.get<Pipeline[]>("/pipelines").then((r) => r.data),
    create: (data: PipelineCreateData) =>
      client.post<Pipeline>("/pipelines", data).then((r) => r.data),
    update: (id: string, data: PipelineUpdateData) =>
      client.put<Pipeline>(`/pipelines/${id}`, data).then((r) => r.data),
    delete: (id: string) =>
      client.delete(`/pipelines/${id}`).then((r) => r.data),
    duplicate: (id: string) =>
      client.post<Pipeline>(`/pipelines/${id}/duplicate`).then((r) => r.data),
  },
  plans: {
    get: (id: string) => client.get<Plan>(`/plans/${id}`).then((r) => r.data),
    confirm: (id: string) => client.post(`/plans/${id}/confirm`, { response: "approved" }).then((r) => r.data),
    cancel: (id: string) => client.post(`/plans/${id}/cancel`).then((r) => r.data),
  },
  steps: {
    retry: (id: string) => client.post(`/steps/${id}/retry`).then((r) => r.data),
  },
  artifacts: {
    list: (params?: { type?: string; run_id?: string }) =>
      client.get<Artifact[]>("/artifacts", { params }).then((r) => r.data),
    get: (id: string) => client.get<Artifact>(`/artifacts/${id}`).then((r) => r.data),
    exportUrl: (id: string) => `/api/artifacts/${id}/export`,
  },
  news: {
    list: () => client.get("/news").then((r) => r.data),
    get: (id: string) => client.get(`/news/${id}`).then((r) => r.data),
    update: (id: string, data: { title?: string; summary?: string }) =>
      client.patch(`/news/${id}`, data).then((r) => r.data),
    refresh: () => client.post("/news/refresh").then((r) => r.data),
  },
  documents: {
    list: (type?: string) => client.get<Artifact[]>("/documents", { params: { type } }).then((r) => r.data),
  },
  docmost: {
    status: () => client.get<{configured: boolean; mode: string; url: string | null}>("/docmost/status").then((r) => r.data),
    publish: (artifactIds: string[], spaceId?: string) =>
      client.post("/docmost/publish", { artifact_ids: artifactIds, space_id: spaceId || "" }).then((r) => r.data),
  },
  wiki: {
    listSpaces: () => client.get<Space[]>("/wiki/spaces").then((r) => r.data),
    createSpace: (data: {name: string; slug: string; description?: string; icon?: string}) =>
      client.post<Space>("/wiki/spaces", data).then((r) => r.data),
    deleteSpace: (id: string) => client.delete(`/wiki/spaces/${id}`).then((r) => r.data),
    listPages: (spaceId: string) => client.get<WikiPage[]>(`/wiki/spaces/${spaceId}/pages`).then((r) => r.data),
    getPage: (id: string) => client.get<WikiPage>(`/wiki/pages/${id}`).then((r) => r.data),
    createPage: (data: {space_id: string; parent_id?: string; title: string; content?: string}) =>
      client.post<WikiPage>("/wiki/pages", data).then((r) => r.data),
    updatePage: (id: string, data: {title?: string; content?: string}) =>
      client.patch<WikiPage>(`/wiki/pages/${id}`, data).then((r) => r.data),
    deletePage: (id: string) => client.delete(`/wiki/pages/${id}`).then((r) => r.data),
    search: (q: string) => client.get<SearchResult[]>("/wiki/search", {params: {q}}).then((r) => r.data),
    importArtifacts: (spaceId: string, artifactIds: string[]) =>
      client.post<WikiPage[]>("/wiki/import-artifacts", {space_id: spaceId, artifact_ids: artifactIds}).then((r) => r.data),
    listRevisions: (pageId: string) =>
      client.get<PageRevision[]>(`/wiki/pages/${pageId}/revisions`).then((r) => r.data),
    getRevision: (pageId: string, revisionId: string) =>
      client.get<PageRevisionDetail>(`/wiki/pages/${pageId}/revisions/${revisionId}`).then((r) => r.data),
    restoreRevision: (pageId: string, revisionId: string) =>
      client.post(`/wiki/pages/${pageId}/revisions/${revisionId}/restore`).then((r) => r.data),
  },
  tags: {
    list: () => client.get<TagItem[]>("/tags").then((r) => r.data),
    create: (data: {name: string; color?: string; description?: string}) =>
      client.post<TagItem>("/tags", data).then((r) => r.data),
    aiTag: (targetType: string, targetId: string) =>
      client.post<{tags: string[]}>(`/tags/ai-tag/${targetType}/${targetId}`).then((r) => r.data),
  },
  memos: {
    list: (params?: {date?: string; tag?: string; pinned_only?: boolean; limit?: number}) =>
      client.get<Memo[]>("/memos", {params}).then((r) => r.data),
    create: (data: {content: string; visibility?: string; pinned?: boolean; tags?: string[]}) =>
      client.post<Memo>("/memos", data).then((r) => r.data),
    update: (id: string, data: {content?: string; visibility?: string; pinned?: boolean}) =>
      client.patch<Memo>(`/memos/${id}`, data).then((r) => r.data),
    delete: (id: string) => client.delete(`/memos/${id}`).then((r) => r.data),
    dailyReview: (date?: string) =>
      client.get<DailyReview>("/memos/daily-review", {params: date ? {date} : {}}).then((r) => r.data),
  },
  checkpoints: {
    list: (runId: string) => client.get<Checkpoint[]>(`/checkpoints/${runId}`).then((r) => r.data),
    snapshot: (runId: string, data: {step_index: number; step_status: string; output_data?: any; error_message?: string}) =>
      client.post(`/checkpoints/${runId}/snapshot`, data).then((r) => r.data),
    replay: (runId: string) => client.post(`/checkpoints/${runId}/replay`).then((r) => r.data),
  },
  scheduler: {
    list: () => client.get<ScheduledJob[]>("/scheduler/jobs").then((r) => r.data),
    create: (data: { name: string; pipeline_id: string; cron_expression: string; enabled?: boolean }) =>
      client.post("/scheduler/jobs", data).then((r) => r.data),
    update: (id: string, data: Partial<ScheduledJob>) =>
      client.patch(`/scheduler/jobs/${id}`, data).then((r) => r.data),
    delete: (id: string) =>
      client.delete(`/scheduler/jobs/${id}`).then((r) => r.data),
    trigger: (id: string) =>
      client.post(`/scheduler/jobs/${id}/trigger`).then((r) => r.data),
  },
  knowledge: {
    list: () => client.get<KnowledgeDocument[]>("/knowledge/documents").then((r) => r.data),
    getContent: (id: string) =>
      client.get<{ id: string; title: string; content: string; chunk_count: number }>(`/knowledge/documents/${id}/content`).then((r) => r.data),
    add: (data: { source_type: string; source_ids: string[] }) =>
      client.post("/knowledge/documents", data).then((r) => r.data),
    delete: (id: string) =>
      client.delete(`/knowledge/documents/${id}`).then((r) => r.data),
    query: (query: string, top_k?: number) =>
      client.post<{ results: KnowledgeQueryResult[] }>("/knowledge/query", { query, top_k }).then((r) => r.data),
    reindex: () =>
      client.post("/knowledge/reindex").then((r) => r.data),
  },
  schedulerExecutions: {
    list: (jobId: string) =>
      client.get(`/scheduler/jobs/${jobId}/executions`).then((r) => r.data),
  },
  mcp: {
    list: () => client.get<McpServer[]>("/mcp/servers").then((r) => r.data),
    get: (id: string) => client.get<McpServer>(`/mcp/servers/${id}`).then((r) => r.data),
    create: (data: McpServerCreateData) =>
      client.post<McpServer>("/mcp/servers", data).then((r) => r.data),
    update: (id: string, data: McpServerUpdateData) =>
      client.put<McpServer>(`/mcp/servers/${id}`, data).then((r) => r.data),
    delete: (id: string) =>
      client.delete(`/mcp/servers/${id}`).then((r) => r.data),
    refresh: (id: string) =>
      client.post<McpServer>(`/mcp/servers/${id}/refresh`).then((r) => r.data),
    call: (id: string, tool_name: string, args: Record<string, any>) =>
      client.post<{ result: string }>(`/mcp/servers/${id}/call`, { tool_name, arguments: args }).then((r) => r.data),
  },
  memories: {
    list: (agentId: string) => client.get(`/memories/${agentId}`).then((r) => r.data),
    create: (data: { agent_id: string; key: string; content: string; category?: string }) =>
      client.post("/memories", data).then((r) => r.data),
    delete: (id: string) => client.delete(`/memories/${id}`).then((r) => r.data),
    search: (agentId: string, query: string, limit?: number) =>
      client.post("/memories/search", { agent_id: agentId, query, limit }).then((r) => r.data),
  },
  chat: {
    listSessions: (agentId: string) =>
      client.get<any[]>("/chat/sessions", { params: { agent_id: agentId } }).then((r) => r.data),
    createSession: (agentId: string, title?: string) =>
      client.post("/chat/sessions", { agent_id: agentId, title: title || "新对话" }).then((r) => r.data),
    getSession: (sessionId: string) =>
      client.get<any>(`/chat/sessions/${sessionId}`).then((r) => r.data),
    updateSession: (sessionId: string, title: string) =>
      client.patch(`/chat/sessions/${sessionId}`, { title }).then((r) => r.data),
    deleteSession: (sessionId: string) =>
      client.delete(`/chat/sessions/${sessionId}`).then((r) => r.data),
    appendMessages: (sessionId: string, messages: { role: string; content: string }[]) =>
      client.post(`/chat/sessions/${sessionId}/messages`, { messages }).then((r) => r.data),
  },
  today: {
    overview: () => client.get("/today/overview").then((r) => r.data),
    statsTrend: (days?: number) => client.get("/today/stats-trend", { params: { days } }).then((r) => r.data),
  },
  materials: {
    list: (params?: { type?: string; keyword?: string; limit?: number }) =>
      client.get("/materials", { params }).then((r) => r.data),
    search: (q: string) => client.get("/materials/search", { params: { q } }).then((r) => r.data),
  },
  writing: {
    list: (status?: string) =>
      client.get("/writing/projects", { params: { status } }).then((r) => r.data),
    get: (id: string) => client.get(`/writing/projects/${id}`).then((r) => r.data),
    create: (data: { title: string; topic?: string }) =>
      client.post("/writing/projects", data).then((r) => r.data),
    update: (id: string, data: Record<string, unknown>) =>
      client.patch(`/writing/projects/${id}`, data).then((r) => r.data),
    delete: (id: string) => client.delete(`/writing/projects/${id}`).then((r) => r.data),
    createDraft: (id: string, data: { content: string; label?: string }) =>
      client.post(`/writing/projects/${id}/drafts`, data).then((r) => r.data),
    addMaterial: (id: string, data: Record<string, unknown>) =>
      client.post(`/writing/projects/${id}/materials`, data).then((r) => r.data),
    autoGather: (id: string) =>
      client.post(`/writing/projects/${id}/auto-gather`).then((r) => r.data),
  },
  review: {
    daily: (days?: number) => client.get("/review/daily", { params: { days } }).then((r) => r.data),
    insights: () => client.get("/review/insights").then((r) => r.data),
  },
};
