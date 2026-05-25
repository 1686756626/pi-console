from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"protected_namespaces": ("settings_",)}

    database_url: str = "sqlite+aiosqlite:///./pi_console.db"
    api_host: str = "0.0.0.0"
    api_port: int = 7001
    worker_secret: str = "change-me-in-production"
    glm_api_key: str = ""
    glm_base_url: str = "https://open.bigmodel.cn/api/coding/paas/v4"
    glm_model: str = "glm-5.1"
    exports_dir: str = "/app/exports"
    dify_api_url: str = "http://dify-api:5001"
    dify_knowledge_api_key: str = ""
    dify_dataset_id: str = ""
    docmost_url: str = "http://docmost:3000"
    docmost_api_token: str = ""


settings = Settings()
