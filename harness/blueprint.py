"""Blueprint — the loop's decision configuration as one versioned artifact.

Paper 2's meta-evolution treats the evolution *blueprint* (critic set, scoring
function, thresholds) as an editable object. This is that object for OpenTracy's
loop: which critics run, with which params, and how the winner is chosen. A
future meta-loop would mutate this; for now it is human-authored config that the
loop reads instead of module constants.

A critic in YAML is either a bare name or a ``{name, params}`` mapping:

    version: 1
    pre_critics: [scope]
    post_critics:
      - eval_lift
      - {name: regression_budget, params: {max_regressions: 1}}
    selection: selection_key   # or two_tier
    promote_strategy: best
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

CriticSpec = str | tuple[str, dict]  # mirrors harness.loop.CriticSpec

DEFAULT_BLUEPRINT_PATH = Path("policies/blueprint.yaml")
_DEFAULT_PRE: list[CriticSpec] = ["scope"]
_DEFAULT_POST: list[CriticSpec] = ["eval_lift"]
VALID_SELECTIONS = ("selection_key", "two_tier")


def _parse_critic(spec: Any) -> CriticSpec:
    if isinstance(spec, str):
        return spec
    if isinstance(spec, dict) and "name" in spec:
        return (str(spec["name"]), dict(spec.get("params") or {}))
    raise ValueError(f"invalid critic spec: {spec!r}")


def _critic_to_yaml(spec: CriticSpec) -> Any:
    if isinstance(spec, str):
        return spec
    name, params = spec
    return {"name": name, "params": dict(params)}


@dataclass
class Blueprint:
    version: int = 1
    pre_critics: list[CriticSpec] = field(default_factory=lambda: list(_DEFAULT_PRE))
    post_critics: list[CriticSpec] = field(default_factory=lambda: list(_DEFAULT_POST))
    selection: str = "selection_key"
    promote_strategy: str = "best"
    llm_stages: list[str] = field(default_factory=lambda: ["generate"])

    @classmethod
    def from_yaml(cls, path: Path | str = DEFAULT_BLUEPRINT_PATH) -> Blueprint:
        p = Path(path)
        if not p.exists():
            return cls()
        d = yaml.safe_load(p.read_text()) or {}
        selection = str(d.get("selection", "selection_key"))
        if selection not in VALID_SELECTIONS:
            raise ValueError(f"selection must be one of {VALID_SELECTIONS}, got {selection!r}")
        return cls(
            version=int(d.get("version", 1)),
            pre_critics=[_parse_critic(s) for s in (d.get("pre_critics") or _DEFAULT_PRE)],
            post_critics=[_parse_critic(s) for s in (d.get("post_critics") or _DEFAULT_POST)],
            selection=selection,
            promote_strategy=str(d.get("promote_strategy", "best")),
            llm_stages=[str(s) for s in (d.get("llm_stages") or ["generate"])],
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "pre_critics": [_critic_to_yaml(s) for s in self.pre_critics],
            "post_critics": [_critic_to_yaml(s) for s in self.post_critics],
            "selection": self.selection,
            "promote_strategy": self.promote_strategy,
            "llm_stages": list(self.llm_stages),
        }

    def write_yaml(self, path: Path | str = DEFAULT_BLUEPRINT_PATH) -> None:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(yaml.safe_dump(self.to_dict(), sort_keys=False))
