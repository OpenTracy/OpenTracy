"""Agent registry — discovers and loads agent .md files."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import yaml

logger = logging.getLogger(__name__)

DEFAULT_AGENTS_DIR = Path(__file__).parent / "agents"


@dataclass
class OutputSchema:
    """Expected output format from an agent."""

    type: str = "json"  # "json" | "text"
    fields: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentConfig:
    """Parsed agent configuration from a .md file."""

    name: str
    description: str = ""
    model: str = "mistral-small-latest"
    temperature: float = 0.1
    max_tokens: int = 500
    output_schema: OutputSchema = field(default_factory=OutputSchema)
    system_prompt: str = ""
    file_path: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "model": self.model,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "output_schema": {"type": self.output_schema.type, "fields": self.output_schema.fields},
            "system_prompt": self.system_prompt,
        }


def _parse_agent_file(path: Path) -> AgentConfig:
    """Parse a .md file with YAML frontmatter into AgentConfig."""
    text = path.read_text()

    # Split frontmatter from body
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            frontmatter_str = parts[1].strip()
            body = parts[2].strip()
        else:
            frontmatter_str = ""
            body = text
    else:
        frontmatter_str = ""
        body = text

    # Parse YAML frontmatter
    meta = yaml.safe_load(frontmatter_str) if frontmatter_str else {}
    if not isinstance(meta, dict):
        meta = {}

    # Parse output_schema
    schema_raw = meta.get("output_schema", {})
    schema = OutputSchema(
        type=schema_raw.get("type", "json"),
        fields=schema_raw.get("fields", {}),
    )

    return AgentConfig(
        name=meta.get("name", path.stem),
        description=meta.get("description", ""),
        model=meta.get("model", "mistral-small-latest"),
        temperature=meta.get("temperature", 0.1),
        max_tokens=meta.get("max_tokens", 500),
        output_schema=schema,
        system_prompt=body,
        file_path=str(path),
    )


class AgentRegistry:
    """Discovers and loads agent .md files from a directory."""

    def __init__(self, agents_dir: Optional[Path] = None):
        self.agents_dir = agents_dir or DEFAULT_AGENTS_DIR
        self._agents: dict[str, AgentConfig] = {}
        self.reload()

    def reload(self) -> None:
        """Scan agents directory and reload all .md files."""
        self._agents.clear()

        if not self.agents_dir.exists():
            logger.warning(f"Agents directory not found: {self.agents_dir}")
            return

        for path in sorted(self.agents_dir.glob("*.md")):
            try:
                config = _parse_agent_file(path)
                self._agents[config.name] = config
                logger.debug(f"Loaded agent: {config.name} from {path.name}")
            except Exception as e:
                logger.warning(f"Failed to load agent {path.name}: {e}")

        logger.info(f"Loaded {len(self._agents)} agents from {self.agents_dir}")

    def get(self, name: str) -> Optional[AgentConfig]:
        """Get an agent by name. Hot-reloads the file if it changed."""
        config = self._agents.get(name)
        if config and config.file_path:
            # Hot-reload: re-parse if file exists
            path = Path(config.file_path)
            if path.exists():
                fresh = _parse_agent_file(path)
                self._agents[name] = fresh
                return fresh
        return config

    def list_agents(self) -> list[AgentConfig]:
        """Return all registered agents."""
        self.reload()
        return list(self._agents.values())
