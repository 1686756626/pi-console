from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AgentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
    id: str
    name: str
    role: str
    description: str | None = None
    tools: list[str] | None = None
    model_name: str = "glm-5.1"
    temperature: float | None = 0.7
    max_tokens: int | None = 8192
    runtime: str = "pi"
    enabled: bool = True
    mcp_server_ids: list[str] | None = None
    created_at: datetime
    updated_at: datetime


class AgentCreate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    id: str
    name: str
    role: str
    description: str | None = None
    tools: list[str] | None = None
    model_name: str = "glm-5.1"
    temperature: float | None = 0.7
    max_tokens: int | None = 8192
    runtime: str = "pi"
    mcp_server_ids: list[str] | None = None


class AgentUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    name: str | None = None
    description: str | None = None
    tools: list[str] | None = None
    model_name: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    enabled: bool | None = None
    mcp_server_ids: list[str] | None = None


class ArtifactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    run_id: str | None = None
    plan_step_id: str | None = None
    type: str
    title: str
    path_or_url: str = ""
    markdown_content: str | None = None
    created_at: datetime


class ArtifactCreate(BaseModel):
    run_id: str | None = None
    plan_step_id: str | None = None
    type: str
    title: str
    path_or_url: str = ""
    markdown_content: str | None = None


class PlanStepResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    plan_id: str
    step_order: int
    title: str
    description: str | None = None
    status: str
    agent_id: str | None = None
    output_artifact_id: str | None = None
    error_message: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    artifact: ArtifactResponse | None = None


class PlanStepBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    step_order: int
    title: str
    status: str
    agent_id: str | None = None
    error_message: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None


class PlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    run_id: str
    title: str
    status: str
    created_by_agent_id: str | None = None
    created_at: datetime
    updated_at: datetime
    steps: list[PlanStepResponse] = []


class PlanBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    status: str
    created_at: datetime
    steps: list[PlanStepBrief] = []


class RunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    status: str
    trigger_type: str
    started_at: datetime | None = None
    ended_at: datetime | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime
    plans: list[PlanBrief] = []


class RunCreate(BaseModel):
    name: str
    trigger_type: str = "manual"


class PipelineCreate(BaseModel):
    pipeline_id: str = "standard"
    name: str | None = None
    trigger_type: str = "manual"


class RunBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    status: str
    trigger_type: str
    started_at: datetime | None = None
    ended_at: datetime | None = None
    error_message: str | None = None
    created_at: datetime


class NewsItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    source: str
    published_at: datetime | None = None
    url: str
    summary: str | None = None
    language: str | None = None
    region: str | None = None
    tags: list[str] | None = None
    tagging_status: str = "pending"
    created_at: datetime


class NewsItemCreate(BaseModel):
    title: str
    source: str
    published_at: datetime | None = None
    url: str
    summary: str | None = None
    language: str | None = None
    region: str | None = None


class NewsItemUpdate(BaseModel):
    title: str | None = None
    summary: str | None = None
    source: str | None = None
    url: str | None = None
    tags: list[str] | None = None


class ConfirmationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    run_id: str
    plan_id: str | None = None
    plan_step_id: str | None = None
    status: str
    question: str
    response: str | None = None
    created_at: datetime
    responded_at: datetime | None = None


class ConfirmAction(BaseModel):
    response: str = "approved"


class StepUpdate(BaseModel):
    status: str | None = None
    error_message: str | None = None
    output_artifact_id: str | None = None


class DashboardResponse(BaseModel):
    running_count: int
    failed_count: int
    waiting_confirmation_count: int
    today_artifacts_count: int
    latest_runs: list[RunBrief]
    latest_artifacts: list[ArtifactResponse]


class StepRetryResponse(BaseModel):
    step: PlanStepResponse
    message: str


class SpaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    slug: str
    description: str | None = None
    icon: str | None = None
    created_at: datetime
    updated_at: datetime
    page_count: int = 0


class SpaceCreate(BaseModel):
    name: str
    slug: str
    description: str | None = None
    icon: str | None = None


class PageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    space_id: str
    parent_id: str | None = None
    title: str
    content: str | None = None
    source_artifact_id: str | None = None
    source_run_id: str | None = None
    created_at: datetime
    updated_at: datetime
    tags: list[str] = []


class PageCreate(BaseModel):
    space_id: str
    parent_id: str | None = None
    title: str
    content: str | None = None
    source_artifact_id: str | None = None


class PageUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    parent_id: str | None = None


class TagResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    normalized_name: str
    color: str | None = None
    description: str | None = None
    usage_count: int = 0
    created_at: datetime


class TagCreate(BaseModel):
    name: str
    color: str | None = None
    description: str | None = None


class MemoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    content: str
    visibility: str = "private"
    pinned: bool = False
    tags_extracted: list[str] | None = None
    parent_id: str | None = None
    source: str = "web"
    tags: list[str] = []
    created_at: datetime
    updated_at: datetime


class MemoCreate(BaseModel):
    content: str
    visibility: str = "private"
    pinned: bool = False
    parent_id: str | None = None
    tags: list[str] | None = None


class MemoUpdate(BaseModel):
    content: str | None = None
    visibility: str | None = None
    pinned: bool | None = None


class DailyReviewResponse(BaseModel):
    date: str
    memos: list[MemoResponse]
    artifacts: list[ArtifactResponse]
    runs: list[RunBrief]
    pages_updated: list[PageResponse]


class RunCheckpointResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    run_id: str
    step_index: int
    step_status: str
    input_data: str | None = None
    output_data: str | None = None
    error_message: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    created_at: datetime


class PipelineStepResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    pipeline_id: str
    step_order: int
    agent_id: str
    title: str
    description: str | None = None
    prompt_template: str | None = None
    input_key: str | None = None
    output_key: str | None = None
    condition: str | None = None
    parallel_group: str | None = None
    temperature_override: float | None = None
    max_tokens_override: int | None = None
    agent_name: str | None = None


class PipelineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    label: str
    description: str | None = None
    steps: list[PipelineStepResponse] = []
    created_at: datetime
    updated_at: datetime


class PipelineCreateRequest(BaseModel):
    id: str
    label: str
    description: str | None = None
    steps: list["PipelineStepInput"] = []


class PipelineStepInput(BaseModel):
    agent_id: str
    title: str
    description: str | None = None
    prompt_template: str | None = None
    input_key: str | None = None
    output_key: str | None = None
    condition: str | None = None
    parallel_group: str | None = None
    temperature_override: float | None = None
    max_tokens_override: int | None = None


class PipelineUpdateRequest(BaseModel):
    label: str | None = None
    description: str | None = None
    steps: list[PipelineStepInput] | None = None
