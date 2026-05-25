import { readFileSync } from "fs";
import { join } from "path";
import { Type, type Model, type TSchema, type Static } from "@earendil-works/pi-ai";
import { Agent, type AgentTool, type AgentToolResult } from "@earendil-works/pi-agent-core";
import { updateStepStatus, createArtifact } from "./api-client.js";

const AGENTS_DIR = process.env.AGENTS_DIR || join(process.cwd(), "agents");

const GLM_BASE_URL = process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/coding/paas/v4";
const GLM_API_KEY = process.env.GLM_API_KEY || "";
const GLM_MODEL = process.env.GLM_MODEL || "glm-5.1";

const SEARCH_AGENTS = new Set([
  "news-curator",
  "researcher",
  "deep-researcher",
  "zhihu-writer",
  "journal-summarizer",
]);

function createGlmModel(): Model<"openai-completions"> {
  return {
    id: GLM_MODEL,
    name: GLM_MODEL,
    api: "openai-completions",
    provider: "glm",
    baseUrl: GLM_BASE_URL,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
    },
  };
}

function createSaveArtifactTool(runId: string, stepId: string): AgentTool {
  const schema = Type.Object({
    type: Type.String({ description: "类型: news, research_report, article_draft, journal_summary" }),
    title: Type.String({ description: "标题" }),
    content: Type.String({ description: "Markdown 内容" }),
  });
  return {
    name: "save_artifact",
    label: "保存产出",
    description: "保存产出物到后端。完成内容后调用此工具保存。",
    parameters: schema,
    execute: async (_toolCallId, rawParams): Promise<AgentToolResult<any>> => {
      const params = rawParams as { type: string; title: string; content: string };
      const artifact = await createArtifact({
        run_id: runId || undefined,
        plan_step_id: stepId || undefined,
        type: params.type,
        title: params.title,
        markdown_content: params.content,
      });
      return {
        content: [{ type: "text", text: `已保存: ${artifact.id}` }],
        details: undefined as any,
      };
    },
  };
}

function createNotifyStatusTool(stepId: string): AgentTool {
  const schema = Type.Object({
    status: Type.String({ description: "状态: running, succeeded, failed" }),
    message: Type.Optional(Type.String({ description: "可选消息" })),
  });
  return {
    name: "notify_status",
    label: "更新状态",
    description: "更新当前步骤状态",
    parameters: schema,
    execute: async (_toolCallId, rawParams): Promise<AgentToolResult<any>> => {
      const params = rawParams as { status: string; message?: string };
      await updateStepStatus(stepId, params.status, params.message);
      return {
        content: [{ type: "text", text: `状态更新为 ${params.status}` }],
        details: undefined as any,
      };
    },
  };
}

function loadSystemPrompt(agentId: string): string {
  const agentFile = join(AGENTS_DIR, `${agentId}.md`);
  try {
    return readFileSync(agentFile, "utf-8");
  } catch {
    return `你是一个有用的 AI 智能体，名为 ${agentId}。完成用户描述的任务。`;
  }
}

export async function runAgent(
  agentId: string,
  prompt: string,
  runId: string,
  stepId: string,
): Promise<string> {
  const model = createGlmModel();
  const systemPrompt = loadSystemPrompt(agentId);

  const tools: AgentTool[] = [
    createSaveArtifactTool(runId, stepId),
    createNotifyStatusTool(stepId),
  ];

  if (SEARCH_AGENTS.has(agentId)) {
    const searchSchema = Type.Object({
      query: Type.String({ description: "搜索查询关键词" }),
    });
    tools.push({
      name: "web_search",
      label: "搜索网页",
      description: "搜索互联网获取最新信息。输入搜索查询，返回搜索结果。",
      parameters: searchSchema,
      execute: async (_toolCallId, rawParams, signal): Promise<AgentToolResult<any>> => {
        const params = rawParams as { query: string };
        const axios = (await import("axios")).default;
        const client = axios.create({
          baseURL: GLM_BASE_URL,
          headers: {
            Authorization: `Bearer ${GLM_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 60000,
          signal,
        });

        const response = await client.post("/chat/completions", {
          model: GLM_MODEL,
          messages: [
            { role: "system", content: "根据用户的搜索查询，提供准确、最新的信息。用中文回答。" },
            { role: "user", content: params.query },
          ],
          tools: [{ type: "web_search", web_search: { enable: true, search_result: true } }],
        });

        const content = response.data.choices?.[0]?.message?.content || "无搜索结果";
        return {
          content: [{ type: "text", text: content }],
          details: undefined as any,
        };
      },
    });
  }

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model,
      tools,
      thinkingLevel: "off",
      messages: [],
    },
    getApiKey: () => GLM_API_KEY,
    toolExecution: "sequential",
  });

  let output = "";

  agent.subscribe((event) => {
    switch (event.type) {
      case "message_update":
        if ("delta" in event && typeof (event as any).delta === "string") {
          output += (event as any).delta;
        } else if ("assistantMessageEvent" in event) {
          const msgEvent = (event as any).assistantMessageEvent;
          if (msgEvent?.type === "text_delta" && msgEvent?.delta) {
            output += msgEvent.delta;
          }
        }
        break;
      case "tool_execution_start":
        console.log(`[runner] 工具调用: ${(event as any).toolName}`, JSON.stringify((event as any).args || {}).substring(0, 200));
        break;
      case "tool_execution_end":
        console.log(`[runner] 工具完成: ${(event as any).toolCallId}`);
        break;
      case "turn_end":
        console.log(`[runner] 轮次结束, stopReason: ${(event as any).message?.stopReason}`);
        break;
    }
  });

  console.log(`[runner] 启动 Agent: ${agentId}, 模型: ${GLM_MODEL}`);
  await agent.prompt(prompt);

  if (!output) {
    const state = agent.state;
    for (const msg of state.messages) {
      if ("content" in msg && Array.isArray((msg as any).content)) {
        for (const block of (msg as any).content) {
          if (block.type === "text" && block.text) {
            output += block.text;
          }
        }
      }
    }
  }

  console.log(`[runner] Agent 完成, 输出长度: ${output.length}`);
  return output;
}
