import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent
ENV_FILE_PATH = BASE_DIR.parent / ".env"


class Settings(BaseSettings):
    DEMO_MODE: bool = True
    PUBLIC_BASE_URL: str = "http://localhost:8000"
    TOOL_WEBHOOK_SECRET: str = "nightwatch-dev-secret-2026"

    # Agora Conversational AI & RTC
    AGORA_APP_ID: str = ""
    AGORA_APP_CERTIFICATE: str = ""
    AGORA_CUSTOMER_ID: str = ""
    AGORA_CUSTOMER_SECRET: str = ""

    # Google Gemini API
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.6-flash"
    GEMINI_AGORA_MODE: str = "openai_compat"  # openai_compat | native | managed

    # Agora RTM Transcripts (Optional)
    ENABLE_RTM_TRANSCRIPTS: bool = False

    # Murf AI TTS (Falcon streaming). If empty, falls back to Agora Managed MiniMax
    MURF_API_KEY: str = ""

    # GitHub Actions Integration (Optional)
    GITHUB_TOKEN: str = ""
    GITHUB_REPO: str = "owner/repo"
    GITHUB_ROLLBACK_WORKFLOW: str = "rollback.yml"
    GITHUB_DEFAULT_BRANCH: str = "main"

    model_config = SettingsConfigDict(
        env_file=(str(ENV_FILE_PATH), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def agora_ready(self) -> bool:
        """Returns True if Agora App & Customer REST credentials are present."""
        return bool(
            self.AGORA_APP_ID
            and self.AGORA_APP_CERTIFICATE
            and self.AGORA_CUSTOMER_ID
            and self.AGORA_CUSTOMER_SECRET
        )

    @property
    def llm_mode(self) -> str:
        if self.GEMINI_API_KEY and self.GEMINI_AGORA_MODE == "native":
            return "gemini_native"
        elif self.GEMINI_API_KEY and self.GEMINI_AGORA_MODE == "openai_compat":
            return "gemini_openai_compat"
        return "agora_managed_openai"

    @property
    def tts_mode(self) -> str:
        if self.MURF_API_KEY:
            return "murf_falcon"
        return "agora_managed_minimax"

    @property
    def asr_mode(self) -> str:
        return "agora_managed_deepgram_nova3"

    @property
    def public_tools_url_ready(self) -> bool:
        url = self.PUBLIC_BASE_URL.strip().lower()
        return (
            url.startswith("https://")
            and "your-ngrok-url" not in url
            and "placeholder" not in url
            and "example" not in url
        )

    @property
    def github_mode(self) -> str:
        if self.GITHUB_TOKEN and self.GITHUB_REPO and self.GITHUB_REPO != "owner/repo" and not self.DEMO_MODE:
            return "live"
        return "dry_run"

    @property
    def is_live_ready(self) -> bool:
        """Returns True if Agora and LLM capabilities are configured and not in DEMO_MODE."""
        if self.DEMO_MODE:
            return False
        return self.agora_ready and (bool(self.GEMINI_API_KEY) or self.GEMINI_AGORA_MODE == "managed")


settings = Settings()
