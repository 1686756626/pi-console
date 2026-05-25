import { getPendingTasks, updateStepStatus, updateRunStatus, getRunArtifacts, createArtifact, type ArtifactData } from "./api-client.js";
import { runAgent } from "./runner.js";

const POLL_INTERVAL = parseInt(process.env.WORKER_POLL_INTERVAL || "5000", 10);
const SCHEDULE_ENABLED = process.env.SCHEDULE_ENABLED === "true";
const SCHEDULE_CRON = process.env.SCHEDULE_CRON || "0 8 * * *";
const SCHEDULE_PIPELINE = process.env.SCHEDULE_PIPELINE || "standard";

interface CronFields {
  minute: number;
  hour: number;
}

function parseCron(cron: string): CronFields | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return null;
  const minute = parseInt(parts[0], 10);
  const hour = parseInt(parts[1], 10);
  if (isNaN(minute) || isNaN(hour)) return null;
  return { minute, hour };
}

function shouldTriggerNow(cron: string, now: Date): boolean {
  const fields = parseCron(cron);
  if (!fields) return false;
  return now.getUTCMinutes() === fields.minute && now.getUTCHours() === fields.hour;
}

let lastTriggerDate = "";

async function checkSchedule() {
  if (!SCHEDULE_ENABLED) return;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  if (today === lastTriggerDate) return;
  if (!shouldTriggerNow(SCHEDULE_CRON, now)) return;

  lastTriggerDate = today;
  console.log(`[scheduler] 定时触发: ${SCHEDULE_PIPELINE} @ ${now.toISOString()}`);

  try {
    const { default: axios } = await import("axios");
    const apiBase = process.env.API_BASE_URL || "http://localhost:7001";
    const secret = process.env.WORKER_SECRET || "change-me-in-production";
    await axios.post(
      `${apiBase}/api/webhook/trigger`,
      { pipeline_id: SCHEDULE_PIPELINE, name: `定时任务 ${today}` },
      { headers: { "X-Webhook-Secret": secret, "Content-Type": "application/json" } },
    );
    console.log(`[scheduler] 定时触发成功`);
  } catch (err: any) {
    console.error(`[scheduler] 定时触发失败:`, err.message);
  }
}

function buildArtifactContext(artifacts: ArtifactData[]): string {
  if (artifacts.length === 0) return "";
  const sections = artifacts
    .filter((a) => a.markdown_content)
    .map((a) => `## ${a.title} [${a.type}]\n${a.markdown_content}`)
    .join("\n\n---\n\n");
  return sections
    ? `\n\n--- 前序步骤输出 ---\n${sections}\n--- 结束 ---\n`
    : "";
}

const AGENT_PROMPTS: Record<string, (task: any, context: string) => string> = {
  "news-curator": (t, _ctx) =>
    `搜索本周国内外新闻（中文和英文）。使用 search_web 工具搜索真实新闻。使用 save_artifact 保存类型为 "news" 的新闻摘要。\n\n任务: ${t.step_title}`,

  researcher: (t, ctx) =>
    `根据下方采集的新闻，生成结构化研究报告。包含：核心问题、关键材料、可用论点、风险和反方观点、可用写作素材、来源。使用 save_artifact 保存类型为 "research_report"。\n\n任务: ${t.step_title}${ctx}`,

  "deep-researcher": (t, ctx) =>
    `对关键议题进行多源深度研究。使用 search_web 至少 3 次不同查询。交叉验证发现并记录矛盾。使用 save_artifact 保存类型为 "research_report"。\n\n任务: ${t.step_title}${ctx}`,

  writer: (t, ctx) =>
    `根据下方研究报告和新闻材料，撰写 Markdown 文章草稿。适当引用来源。使用 save_artifact 保存类型为 "article_draft"。\n\n任务: ${t.step_title}${ctx}`,

  "zhihu-writer": (t, ctx) =>
    `将下方研究和材料转化为知乎风格文章。使用 search_web 验证关键论点。专业但对话式风格，2000-4000 字。使用 save_artifact 保存类型为 "article_draft"。\n\n任务: ${t.step_title}${ctx}`,

  "journal-summarizer": (t, ctx) =>
    `将下方研究和材料摘要为结构化总结。用简体中文解释术语。控制在 2000 字内。使用 save_artifact 保存类型为 "journal_summary"。\n\n任务: ${t.step_title}${ctx}`,
};

async function processTask(task: {
  run_id: string;
  run_name: string;
  step_id: string;
  step_order: number;
  step_title: string;
  agent_id: string;
}) {
  console.log(`[worker] 处理步骤 ${task.step_order}: ${task.step_title} (智能体: ${task.agent_id})`);

  try {
    await updateStepStatus(task.step_id, "running");
    await updateRunStatus(task.run_id, "running");

    let artifacts: ArtifactData[] = [];
    if (task.step_order > 1) {
      artifacts = await getRunArtifacts(task.run_id);
    }
    const context = buildArtifactContext(artifacts);

    const promptBuilder = AGENT_PROMPTS[task.agent_id];
    if (!promptBuilder) {
      throw new Error(`未知智能体: ${task.agent_id}`);
    }
    const prompt = promptBuilder(task, context);

    await runAgent(task.agent_id, prompt, task.run_id, task.step_id);
    await updateStepStatus(task.step_id, "succeeded");

    console.log(`[worker] 步骤 ${task.step_order} 完成`);
  } catch (err: any) {
    console.error(`[worker] 步骤 ${task.step_order} 失败:`, err.message);
    await updateStepStatus(task.step_id, "failed", err.message).catch(() => {});
    await updateRunStatus(task.run_id, "failed", err.message).catch(() => {});
  }
}

async function mainLoop() {
  console.log("[worker] 主循环启动...");
  console.log(`[worker] GLM 模型: ${process.env.GLM_MODEL || "glm-5.1"}`);
  console.log(`[worker] API 地址: ${process.env.API_BASE_URL || "http://localhost:7001"}`);
  if (SCHEDULE_ENABLED) {
    console.log(`[worker] 定时调度: 已启用 (${SCHEDULE_CRON}, 流水线: ${SCHEDULE_PIPELINE})`);
  }

  while (true) {
    try {
      await checkSchedule();

      const tasks = await getPendingTasks();
      if (tasks.length > 0) {
        const task = tasks[0];
        await processTask(task);
        await new Promise((r) => setTimeout(r, 5000));

        const remaining = await getPendingTasks();
        if (remaining.length === 0) {
          const { default: axios } = await import("axios");
          const apiBase = process.env.API_BASE_URL || "http://localhost:7001";
          const secret = process.env.WORKER_SECRET || "change-me-in-production";
          const runResp = await axios.get(`${apiBase}/api/runs/${task.run_id}`, {
            headers: { "X-Worker-Secret": secret },
          });
          const runData = runResp.data;
          const hasFailed = runData.plans?.some((p: any) =>
            p.steps?.some((s: any) => s.status === "failed"),
          );
          if (hasFailed) {
            await updateRunStatus(task.run_id, "failed").catch(() => {});
            console.log(`[worker] 运行 ${task.run_name} 有失败步骤，标记为 failed`);
          } else {
            await updateRunStatus(task.run_id, "succeeded").catch(() => {});
            console.log(`[worker] 运行 ${task.run_name} 全部完成`);
          }
        }
      }
    } catch (err: any) {
      console.error("[worker] 轮询错误:", err.message);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
}

process.on("SIGTERM", () => {
  console.log("[worker] 收到 SIGTERM，关闭...");
  process.exit(0);
});

mainLoop().catch((err) => {
  console.error("[worker] 致命错误:", err);
  process.exit(1);
});
