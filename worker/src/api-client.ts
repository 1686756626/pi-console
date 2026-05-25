import axios from "axios";

const API_BASE = process.env.API_BASE_URL || "http://localhost:7001";
const WORKER_SECRET = process.env.WORKER_SECRET || "change-me-in-production";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "X-Worker-Secret": WORKER_SECRET },
});

export async function getPendingTasks() {
  const { data } = await api.get("/api/internal/worker/pending-tasks");
  return data.tasks as Array<{
    run_id: string;
    run_name: string;
    step_id: string;
    step_order: number;
    step_title: string;
    agent_id: string;
  }>;
}

export async function updateStepStatus(
  stepId: string,
  status: string,
  errorMessage?: string,
) {
  await api.post("/api/internal/worker/step-update", {
    status,
    error_message: errorMessage || null,
  }, {
    params: { step_id: stepId },
  });
}

export async function createArtifact(params: {
  run_id?: string;
  plan_step_id?: string;
  type: string;
  title: string;
  path_or_url?: string;
  markdown_content?: string;
}) {
  const { data } = await api.post("/api/internal/worker/artifact", params);
  return data;
}

export async function updateRunStatus(
  runId: string,
  status: string,
  errorMessage?: string,
) {
  await api.post(`/api/internal/worker/run/${runId}/status`, {
    status,
    error_message: errorMessage || null,
  });
}

export interface ArtifactData {
  id: string;
  run_id: string | null;
  plan_step_id: string | null;
  type: string;
  title: string;
  markdown_content: string | null;
  created_at: string;
}

export async function getRunArtifacts(runId: string): Promise<ArtifactData[]> {
  const { data } = await api.get(`/api/internal/worker/run/${runId}/artifacts`);
  return data;
}
