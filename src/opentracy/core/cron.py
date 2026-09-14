"""Minimal 5-field cron expressions: minute hour day-of-month month day-of-week.

Supports the standard syntax subset OpenTracy needs, with zero dependencies:
``*``, exact values, ranges (``1-5``), steps (``*/15``, ``1-30/5``) and
lists (``0,30``). Day-of-week is 0-7 with both 0 and 7 meaning Sunday.
Standard cron quirk preserved: when BOTH day-of-month and day-of-week are
restricted, a date matches if EITHER matches.

Examples: ``0 23 * * *`` = 23:00 daily · ``*/30 * * * *`` = every 30 min ·
``0 5 * * 1`` = Mondays 05:00.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Iterator

_FIELD_BOUNDS = (("minute", 0, 59), ("hour", 0, 23), ("dom", 1, 31), ("month", 1, 12), ("dow", 0, 7))


def _parse_field(name: str, field: str, lo: int, hi: int) -> frozenset[int]:
    values: set[int] = set()
    for part in field.split(","):
        step = 1
        if "/" in part:
            part, step_str = part.split("/", 1)
            if not step_str.isdigit() or int(step_str) < 1:
                raise ValueError(f"invalid step in {name} field: {step_str!r}")
            step = int(step_str)
        if part == "*":
            start, end = lo, hi
        elif "-" in part:
            a, b = part.split("-", 1)
            start, end = int(a), int(b)
        else:
            start = end = int(part)
        if not (lo <= start <= hi and lo <= end <= hi and start <= end):
            raise ValueError(f"{name} value out of range [{lo},{hi}]: {part!r}")
        values.update(range(start, end + 1, step))
    return frozenset(values)


@dataclass(frozen=True)
class CronExpr:
    minutes: frozenset[int]
    hours: frozenset[int]
    dom: frozenset[int]
    months: frozenset[int]
    dow: frozenset[int]
    dom_restricted: bool
    dow_restricted: bool

    @classmethod
    def parse(cls, expr: str) -> "CronExpr":
        fields = expr.split()
        if len(fields) != 5:
            raise ValueError(f"cron expression must have 5 fields: {expr!r}")
        parsed = [
            _parse_field(name, field, lo, hi)
            for field, (name, lo, hi) in zip(fields, _FIELD_BOUNDS)
        ]
        dow = frozenset(v % 7 for v in parsed[4])  # 7 -> 0 (Sunday)
        return cls(
            minutes=parsed[0],
            hours=parsed[1],
            dom=parsed[2],
            months=parsed[3],
            dow=dow,
            dom_restricted=fields[2] != "*",
            dow_restricted=fields[4] != "*",
        )

    def matches(self, dt: datetime) -> bool:
        if dt.minute not in self.minutes or dt.hour not in self.hours:
            return False
        if dt.month not in self.months:
            return False
        dom_ok = dt.day in self.dom
        dow_ok = dt.isoweekday() % 7 in self.dow  # Sunday=0
        if self.dom_restricted and self.dow_restricted:
            return dom_ok or dow_ok  # standard cron OR semantics
        return dom_ok and dow_ok


def iter_matching_minutes(expr: CronExpr, start: datetime, end: datetime) -> Iterator[datetime]:
    """Yield every matching minute in (start, end], oldest first.
    Both bounds are truncated to minute precision."""
    current = start.replace(second=0, microsecond=0) + timedelta(minutes=1)
    end = end.replace(second=0, microsecond=0)
    while current <= end:
        if expr.matches(current):
            yield current
        current += timedelta(minutes=1)
