"""ClickHouse read client for lunar-router analytics.

Provides query methods against the llm_traces table and
pre-aggregated materialized views (model_hourly_stats, cluster_daily_stats).

Uses clickhouse-connect (HTTP protocol). Lazy singleton — no connection
created until the first query. Disabled entirely when LUNAR_CH_ENABLED is
not set to 'true'.

Environment variables (shared with the Go engine):
    LUNAR_CH_ENABLED      - 'true' to enable (default: disabled)
    LUNAR_CH_HOST         - ClickHouse host (default: localhost)
    LUNAR_CH_HTTP_PORT    - HTTP port (default: 8123)
    LUNAR_CH_DATABASE     - Database name (default: lunar_router)
    LUNAR_CH_USERNAME     - Username (default: default)
    LUNAR_CH_PASSWORD     - Password (default: empty)
"""

from __future__ import annotations

import json
import os
import math
import threading
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

_client = None
_lock = threading.Lock()


def _is_enabled() -> bool:
    return os.environ.get("LUNAR_CH_ENABLED", "").lower() in ("true", "1")


def _create_client():
    import clickhouse_connect

    return clickhouse_connect.get_client(
        host=os.environ.get("LUNAR_CH_HOST", "localhost"),
        port=int(os.environ.get("LUNAR_CH_HTTP_PORT", "8123")),
        database=os.environ.get("LUNAR_CH_DATABASE", "lunar_router"),
        username=os.environ.get("LUNAR_CH_USERNAME", "default"),
        password=os.environ.get("LUNAR_CH_PASSWORD", ""),
    )


def get_client():
    """Return the lazy singleton ClickHouse client. Returns None if disabled."""
    global _client
    if not _is_enabled():
        return None
    if _client is None:
        with _lock:
            if _client is None:
                _client = _create_client()
    return _client


# ---------------------------------------------------------------------------
# Query helpers
# ---------------------------------------------------------------------------


def query_traces(
    model: Optional[str] = None,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """Return recent traces from llm_traces, newest first."""
    client = get_client()
    if client is None:
        return []

    conditions = []
    params: dict[str, Any] = {"limit": limit, "offset": offset}

    if model:
        conditions.append("selected_model = {model:String}")
        params["model"] = model
    if start:
        conditions.append("timestamp >= {start:DateTime64(3)}")
        params["start"] = start
    if end:
        conditions.append("timestamp <= {end:DateTime64(3)}")
        params["end"] = end

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    sql = f"""
        SELECT *
        FROM llm_traces
        {where}
        ORDER BY timestamp DESC
        LIMIT {{limit:UInt32}} OFFSET {{offset:UInt32}}
    """

    result = client.query(sql, parameters=params)
    columns = result.column_names
    return [dict(zip(columns, row)) for row in result.result_rows]


def query_trace_count(
    model: Optional[str] = None,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> int:
    """Return total count of matching traces."""
    client = get_client()
    if client is None:
        return 0

    conditions = []
    params: dict[str, Any] = {}

    if model:
        conditions.append("selected_model = {model:String}")
        params["model"] = model
    if start:
        conditions.append("timestamp >= {start:DateTime64(3)}")
        params["start"] = start
    if end:
        conditions.append("timestamp <= {end:DateTime64(3)}")
        params["end"] = end

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    sql = f"SELECT count() FROM llm_traces {where}"
    result = client.query(sql, parameters=params)
    return result.result_rows[0][0] if result.result_rows else 0


def query_model_hourly(
    model: Optional[str] = None,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> list[dict[str, Any]]:
    """Return hourly aggregated model stats from the materialized view."""
    client = get_client()
    if client is None:
        return []

    conditions = []
    params: dict[str, Any] = {}

    if model:
        conditions.append("selected_model = {model:String}")
        params["model"] = model
    if start:
        conditions.append("hour >= {start:DateTime}")
        params["start"] = start
    if end:
        conditions.append("hour <= {end:DateTime}")
        params["end"] = end

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    sql = f"""
        SELECT
            selected_model,
            hour,
            countMerge(request_count)                            AS requests,
            sumMerge(error_count)                                AS errors,
            quantilesMerge(0.5, 0.95, 0.99)(latency_quantiles)  AS latency_pcts,
            quantilesMerge(0.5, 0.95)(ttft_quantiles)            AS ttft_pcts,
            sumMerge(total_tokens_in)                            AS tokens_in,
            sumMerge(total_tokens_out)                           AS tokens_out,
            sumMerge(total_cost_usd)                             AS cost_usd,
            uniqMerge(unique_providers)                          AS provider_count,
            uniqMerge(unique_clusters)                           AS cluster_count
        FROM model_hourly_stats
        {where}
        GROUP BY selected_model, hour
        ORDER BY hour
    """

    result = client.query(sql, parameters=params)
    columns = result.column_names
    return [dict(zip(columns, row)) for row in result.result_rows]


def query_cluster_daily(
    cluster_id: Optional[int] = None,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> list[dict[str, Any]]:
    """Return daily aggregated cluster stats from the materialized view."""
    client = get_client()
    if client is None:
        return []

    conditions = []
    params: dict[str, Any] = {}

    if cluster_id is not None:
        conditions.append("cluster_id = {cluster_id:Int32}")
        params["cluster_id"] = cluster_id
    if start:
        conditions.append("day >= {start:Date}")
        params["start"] = start
    if end:
        conditions.append("day <= {end:Date}")
        params["end"] = end

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    sql = f"""
        SELECT
            cluster_id,
            day,
            countMerge(request_count)                    AS requests,
            sumMerge(error_count)                        AS errors,
            quantilesMerge(0.5, 0.95)(latency_quantiles) AS latency_pcts,
            sumMerge(total_tokens)                       AS tokens,
            sumMerge(total_cost_usd)                     AS cost_usd,
            uniqMerge(unique_models)                     AS model_count
        FROM cluster_daily_stats
        {where}
        GROUP BY cluster_id, day
        ORDER BY day
    """

    result = client.query(sql, parameters=params)
    columns = result.column_names
    return [dict(zip(columns, row)) for row in result.result_rows]


def query_summary(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> dict[str, Any]:
    """Return overall summary stats from llm_traces."""
    client = get_client()
    if client is None:
        return {}

    conditions = []
    params: dict[str, Any] = {}

    if start:
        conditions.append("timestamp >= {start:DateTime64(3)}")
        params["start"] = start
    if end:
        conditions.append("timestamp <= {end:DateTime64(3)}")
        params["end"] = end

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    sql = f"""
        SELECT
            count()                                    AS total_requests,
            sum(is_error)                              AS total_errors,
            avg(latency_ms)                            AS avg_latency_ms,
            quantile(0.5)(latency_ms)                  AS p50_latency_ms,
            quantile(0.95)(latency_ms)                 AS p95_latency_ms,
            quantile(0.99)(latency_ms)                 AS p99_latency_ms,
            avg(ttft_ms)                               AS avg_ttft_ms,
            sum(tokens_in)                             AS total_tokens_in,
            sum(tokens_out)                            AS total_tokens_out,
            sum(total_cost_usd)                        AS total_cost_usd,
            uniq(selected_model)                       AS unique_models,
            uniq(provider)                             AS unique_providers
        FROM llm_traces
        {where}
    """

    result = client.query(sql, parameters=params)
    if not result.result_rows:
        return {}

    columns = result.column_names
    return dict(zip(columns, result.result_rows[0]))


def _safe(v: Any, default=0) -> float:
    """Coerce ClickHouse result to float, handling None/NaN."""
    if v is None:
        return float(default)
    f = float(v)
    return default if math.isnan(f) or math.isinf(f) else f


def _pct_change(cur: float, prev: float) -> Optional[float]:
    if prev == 0:
        return None
    return round(((cur - prev) / prev) * 100, 2)


def _dist(client, col: str, where: str, params: dict) -> dict:
    """Return distribution stats for a column."""
    sql = f"""
        SELECT
            quantile(0.5)({col})  AS p50,
            quantile(0.9)({col})  AS p90,
            quantile(0.95)({col}) AS p95,
            quantile(0.99)({col}) AS p99,
            avg({col})            AS mean,
            stddevPop({col})      AS std
        FROM llm_traces {where}
    """
    r = client.query(sql, parameters=params)
    if not r.result_rows:
        return {"p50": 0, "p90": 0, "p95": 0, "p99": 0, "mean": 0, "std": 0}
    row = r.result_rows[0]
    return {
        "p50": _safe(row[0]),
        "p90": _safe(row[1]),
        "p95": _safe(row[2]),
        "p99": _safe(row[3]),
        "mean": _safe(row[4]),
        "std": _safe(row[5]),
    }


def query_analytics(
    days: int = 30,
    trace_limit: int = 100,
    trace_offset: int = 0,
    model_id: Optional[str] = None,
    backend: Optional[str] = None,
    is_success: Optional[bool] = None,
    search: Optional[str] = None,
) -> dict[str, Any]:
    """
    Full analytics response matching the UI's AnalyticsMetricsResponse shape.
    Queries ClickHouse llm_traces directly.
    """
    client = get_client()
    if client is None:
        return _empty_analytics()

    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)

    # Build WHERE clause
    conditions = ["timestamp >= {start:DateTime64(3)}"]
    params: dict[str, Any] = {"start": start}

    if model_id:
        conditions.append("selected_model = {model_id:String}")
        params["model_id"] = model_id
    if backend:
        conditions.append("provider = {backend:String}")
        params["backend"] = backend
    if is_success is not None:
        conditions.append(f"is_error = {0 if is_success else 1}")
    if search:
        conditions.append("(selected_model ILIKE {search:String} OR provider ILIKE {search:String} OR error_message ILIKE {search:String})")
        params["search"] = f"%{search}%"

    where = f"WHERE {' AND '.join(conditions)}"

    # --- TOTALS ---
    totals_sql = f"""
        SELECT
            count()                         AS request_count,
            sum(tokens_in)                  AS total_input_tokens,
            sum(tokens_out)                 AS total_output_tokens,
            sum(total_cost_usd)             AS total_cost_usd,
            1 - (sum(is_error) / greatest(count(), 1)) AS success_rate,
            avg(latency_ms) / 1000.0        AS avg_latency_s,
            quantile(0.95)(latency_ms) / 1000.0 AS p95_latency_s,
            sum(is_stream)                  AS stream_count
        FROM llm_traces {where}
    """
    r = client.query(totals_sql, parameters=params)
    row = r.result_rows[0] if r.result_rows else [0] * 8
    total_requests = int(_safe(row[0]))
    total_input = int(_safe(row[1]))
    total_output = int(_safe(row[2]))
    total_cost = _safe(row[3])
    total_tokens = total_input + total_output
    avg_cost_per_1k = (total_cost / total_tokens * 1000) if total_tokens > 0 else 0
    stream_count = int(_safe(row[7]))

    totals = {
        "request_count": total_requests,
        "total_input_tokens": total_input,
        "total_output_tokens": total_output,
        "total_cost_usd": round(total_cost, 6),
        "success_rate": round(_safe(row[4]) * 100, 2),
        "avg_latency_s": round(_safe(row[5]), 4),
        "p95_latency_s": round(_safe(row[6]), 4),
        "avg_cost_per_1k_tokens_usd": round(avg_cost_per_1k, 6),
        "streaming_share": round(stream_count / max(total_requests, 1) * 100, 2),
    }

    # --- SERIES BY TIME (daily) ---
    time_sql = f"""
        SELECT
            toDate(timestamp)               AS day,
            count()                         AS request_count,
            sum(tokens_in)                  AS total_input_tokens,
            sum(tokens_out)                 AS total_output_tokens,
            avg(latency_ms) / 1000.0        AS avg_latency_s,
            quantile(0.95)(latency_ms) / 1000.0 AS p95_latency_s,
            sum(is_error) / greatest(count(), 1) AS error_rate,
            sum(total_cost_usd)             AS total_cost_usd
        FROM llm_traces {where}
        GROUP BY day ORDER BY day
    """
    r = client.query(time_sql, parameters=params)
    by_time = [
        {
            "time": str(row[0]),
            "request_count": int(row[1]),
            "total_input_tokens": int(row[2]),
            "total_output_tokens": int(row[3]),
            "avg_latency_s": round(_safe(row[4]), 4),
            "p95_latency_s": round(_safe(row[5]), 4),
            "error_rate": round(_safe(row[6]) * 100, 2),
            "total_cost_usd": round(_safe(row[7]), 6),
        }
        for row in r.result_rows
    ]

    # --- SERIES BY MODEL ---
    model_sql = f"""
        SELECT
            selected_model,
            count()                         AS request_count,
            sum(tokens_in)                  AS total_input_tokens,
            sum(tokens_out)                 AS total_output_tokens,
            avg(latency_ms) / 1000.0        AS avg_latency_s,
            quantile(0.95)(latency_ms) / 1000.0 AS p95_latency_s,
            sum(is_error) / greatest(count(), 1) AS error_rate,
            sum(total_cost_usd)             AS total_cost_usd
        FROM llm_traces {where}
        GROUP BY selected_model ORDER BY request_count DESC
    """
    r = client.query(model_sql, parameters=params)
    by_model = [
        {
            "model_id": row[0],
            "request_count": int(row[1]),
            "total_input_tokens": int(row[2]),
            "total_output_tokens": int(row[3]),
            "avg_latency_s": round(_safe(row[4]), 4),
            "p95_latency_s": round(_safe(row[5]), 4),
            "error_rate": round(_safe(row[6]) * 100, 2),
            "total_cost_usd": round(_safe(row[7]), 6),
        }
        for row in r.result_rows
    ]

    # --- SERIES BY BACKEND ---
    backend_sql = f"""
        SELECT
            provider,
            count()                         AS request_count,
            sum(tokens_in)                  AS total_input_tokens,
            sum(tokens_out)                 AS total_output_tokens,
            avg(latency_ms) / 1000.0        AS avg_latency_s,
            quantile(0.95)(latency_ms) / 1000.0 AS p95_latency_s,
            sum(is_error) / greatest(count(), 1) AS error_rate,
            sum(total_cost_usd)             AS total_cost_usd
        FROM llm_traces {where}
        GROUP BY provider ORDER BY request_count DESC
    """
    r = client.query(backend_sql, parameters=params)
    by_backend = [
        {
            "backend": row[0],
            "request_count": int(row[1]),
            "total_input_tokens": int(row[2]),
            "total_output_tokens": int(row[3]),
            "avg_latency_s": round(_safe(row[4]), 4),
            "p95_latency_s": round(_safe(row[5]), 4),
            "error_rate": round(_safe(row[6]) * 100, 2),
            "total_cost_usd": round(_safe(row[7]), 6),
        }
        for row in r.result_rows
    ]

    # --- DISTRIBUTIONS (latency in seconds, ttft in seconds) ---
    distributions = {
        "latency_s": _dist(client, "latency_ms / 1000.0", where, params),
        "ttft_s": _dist(client, "ttft_ms / 1000.0", where, params),
        "input_tokens": _dist(client, "tokens_in", where, params),
        "output_tokens": _dist(client, "tokens_out", where, params),
        "cost_per_request_usd": _dist(client, "total_cost_usd", where, params),
    }

    # --- TRENDS (last 7d vs prev 7d) ---
    def _period_stats(period_start: datetime, period_end: datetime) -> dict:
        ps = {**params, "ps": period_start, "pe": period_end}
        conds = [c for c in conditions if "start" not in c]
        conds.append("timestamp >= {ps:DateTime64(3)}")
        conds.append("timestamp < {pe:DateTime64(3)}")
        w = f"WHERE {' AND '.join(conds)}"
        sql = f"""
            SELECT
                count(),
                sum(total_cost_usd),
                quantile(0.95)(latency_ms) / 1000.0,
                sum(is_error) / greatest(count(), 1)
            FROM llm_traces {w}
        """
        r = client.query(sql, parameters=ps)
        row = r.result_rows[0] if r.result_rows else [0, 0, 0, 0]
        return {
            "requests": int(_safe(row[0])),
            "cost_usd": round(_safe(row[1]), 6),
            "p95_latency_s": round(_safe(row[2]), 4),
            "error_rate": round(_safe(row[3]) * 100, 2),
        }

    last_7d = _period_stats(now - timedelta(days=7), now)
    prev_7d = _period_stats(now - timedelta(days=14), now - timedelta(days=7))

    trends = {
        "last_7d": last_7d,
        "prev_7d": prev_7d,
        "pct_change": {
            "requests": _pct_change(last_7d["requests"], prev_7d["requests"]),
            "cost_usd": _pct_change(last_7d["cost_usd"], prev_7d["cost_usd"]),
            "p95_latency_s": _pct_change(last_7d["p95_latency_s"], prev_7d["p95_latency_s"]),
            "error_rate": _pct_change(last_7d["error_rate"], prev_7d["error_rate"]),
        },
    }

    # --- LEADERS ---
    cost_leaders_sql = f"""
        SELECT selected_model, sum(total_cost_usd) AS c, count() AS n
        FROM llm_traces {where}
        GROUP BY selected_model ORDER BY c DESC LIMIT 5
    """
    r = client.query(cost_leaders_sql, parameters=params)
    top_cost = [{"model_id": row[0], "total_cost_usd": round(_safe(row[1]), 6), "request_count": int(row[2])} for row in r.result_rows]

    latency_leaders_sql = f"""
        SELECT selected_model, quantile(0.95)(latency_ms) / 1000.0 AS p, count() AS n
        FROM llm_traces {where}
        GROUP BY selected_model ORDER BY p DESC LIMIT 5
    """
    r = client.query(latency_leaders_sql, parameters=params)
    slowest = [{"model_id": row[0], "p95_latency_s": round(_safe(row[1]), 4), "count": int(row[2])} for row in r.result_rows]

    error_leaders_sql = f"""
        SELECT selected_model, sum(is_error) AS e, count() AS n,
               sum(is_error) / greatest(count(), 1) AS er
        FROM llm_traces {where}
        GROUP BY selected_model HAVING e > 0 ORDER BY e DESC LIMIT 5
    """
    r = client.query(error_leaders_sql, parameters=params)
    most_errors = [
        {"model_id": row[0], "error_count": int(row[1]), "total_requests": int(row[2]), "error_rate": round(_safe(row[3]) * 100, 2)}
        for row in r.result_rows
    ]

    # --- RAW SAMPLE (traces for the table) ---
    trace_conditions = list(conditions)
    trace_params = dict(params)
    trace_params["tlimit"] = trace_limit
    trace_params["toffset"] = trace_offset

    trace_sql = f"""
        SELECT
            if(
                request_id = '',
                concat(
                    'legacy-',
                    lower(hex(MD5(concat(
                        toString(timestamp), '|',
                        selected_model, '|',
                        provider, '|',
                        toString(tokens_in), '|',
                        toString(tokens_out), '|',
                        toString(latency_ms), '|',
                        toString(is_stream), '|',
                        request_type, '|',
                        toString(total_cost_usd)
                    ))))
                ),
                request_id
            ) AS rid,
            selected_model, provider, timestamp,
            latency_ms / 1000.0, ttft_ms / 1000.0,
            tokens_in, tokens_out, total_cost_usd,
            is_error, is_stream, error_category,
            request_type, cache_hit, cluster_id,
            expected_error, cost_adjusted_score,
            input_text, output_text, input_messages, output_message,
            if(isNull(finish_reason), '', finish_reason)            AS finish_reason,
            if(isNull(request_tools), '[]', request_tools)          AS request_tools,
            if(isNull(response_tool_calls), '[]', response_tool_calls) AS response_tool_calls,
            if(isNull(has_tool_calls), 0, has_tool_calls)           AS has_tool_calls,
            if(isNull(tool_calls_count), 0, tool_calls_count)       AS tool_calls_count,
            if(isNull(execution_timeline), '[]', execution_timeline) AS execution_timeline,
            if(isNull(tokens_per_s), 0, tokens_per_s)               AS tokens_per_s
        FROM llm_traces
        {where}
        ORDER BY timestamp DESC
        LIMIT {{tlimit:UInt32}} OFFSET {{toffset:UInt32}}
    """
    r = client.query(trace_sql, parameters=trace_params)
    def _extract_text_from_message_content(content: Any) -> str:
        if content is None:
            return ""
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict):
                    if item.get("type") == "text" and isinstance(item.get("text"), str):
                        parts.append(item["text"])
                    elif isinstance(item.get("content"), str):
                        parts.append(item["content"])
            return "\n".join(p for p in parts if p)
        if isinstance(content, dict):
            for key in ("text", "content"):
                val = content.get(key)
                if isinstance(val, str):
                    return val
        return ""

    def _fallback_input_text(input_messages: Any) -> str:
        if not isinstance(input_messages, list):
            return ""
        for msg in reversed(input_messages):
            if isinstance(msg, dict) and msg.get("role") == "user":
                return _extract_text_from_message_content(msg.get("content"))
        return ""

    def _fallback_output_text(output_message: Any) -> str:
        if not isinstance(output_message, dict):
            return ""
        return _extract_text_from_message_content(output_message.get("content"))

    def _fallback_timeline(
        created_at: Any,
        latency_s: float,
        ttft_s: float,
        is_error: bool,
        provider: str,
        model_id: str,
        tokens_in: int,
        tokens_out: int,
    ) -> list[dict[str, Any]]:
        if latency_s <= 0:
            return []
        try:
            started = datetime.fromisoformat(str(created_at).replace(" ", "T"))
        except Exception:
            started = datetime.now(timezone.utc)
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        duration_ms = max(latency_s * 1000.0, 0.0)
        completed = started + timedelta(milliseconds=duration_ms)
        ttft_ms = max(ttft_s * 1000.0, 0.0)

        return [{
            "step": 1,
            "phase": "inference",
            "started_at": started.isoformat(),
            "completed_at": completed.isoformat(),
            "duration_ms": round(duration_ms, 3),
            "status": "failed" if is_error else "completed",
            "provider": provider or None,
            "model": model_id or None,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "ttft_ms": round(ttft_ms, 3) if ttft_ms > 0 else None,
            "tool_name": None,
            "tool_call_id": None,
            "tool_input": None,
            "tool_output": None,
            "tool_error": None,
            "metadata": {"source": "fallback"},
        }]

    raw_sample = []
    for row in r.result_rows:
        input_text = row[17] or ""
        output_text = row[18] or ""
        input_messages_raw = row[19] or ""
        output_message_raw = row[20] or ""

        # Parse input_messages JSON if present
        input_messages = None
        if input_messages_raw:
            try:
                input_messages = json.loads(input_messages_raw)
            except Exception:
                input_messages = None

        # Parse output_message JSON if present
        output_message = None
        if output_message_raw:
            try:
                output_message = json.loads(output_message_raw)
            except Exception:
                output_message = None

        # Parse tool-related JSON fields (columns 21-26, migration 006)
        finish_reason = row[21] if len(row) > 21 else ""
        request_tools_raw = row[22] if len(row) > 22 else "[]"
        response_tool_calls_raw = row[23] if len(row) > 23 else "[]"
        has_tool_calls = bool(row[24]) if len(row) > 24 else False
        tool_calls_count = int(row[25]) if len(row) > 25 else 0
        execution_timeline_raw = row[26] if len(row) > 26 else "[]"
        tokens_per_s = _safe(row[27]) if len(row) > 27 else 0.0

        request_tools = []
        try:
            request_tools = json.loads(request_tools_raw) if request_tools_raw else []
        except Exception:
            request_tools = []

        response_tool_calls_str = response_tool_calls_raw or None

        execution_timeline = []
        try:
            execution_timeline = json.loads(execution_timeline_raw) if execution_timeline_raw else []
        except Exception:
            execution_timeline = []

        total_tokens = int(row[6]) + int(row[7])
        latency_s = round(_safe(row[4]), 4)
        ttft_s = round(_safe(row[5]), 4)

        if not input_text and input_messages is not None:
            input_text = _fallback_input_text(input_messages)
        if not output_text and output_message is not None:
            output_text = _fallback_output_text(output_message)

        if (not execution_timeline) and latency_s > 0:
            execution_timeline = _fallback_timeline(
                created_at=row[3],
                latency_s=latency_s,
                ttft_s=ttft_s,
                is_error=bool(row[9]),
                provider=row[2],
                model_id=row[1],
                tokens_in=int(row[6]),
                tokens_out=int(row[7]),
            )

        if tool_calls_count <= 0 and isinstance(output_message, dict):
            tc = output_message.get("tool_calls")
            if isinstance(tc, list):
                tool_calls_count = len(tc)
                has_tool_calls = tool_calls_count > 0

        if tokens_per_s <= 0 and total_tokens > 0 and latency_s > 0:
            tokens_per_s = total_tokens / latency_s

        raw_sample.append({
            "event_id": str(row[0]),
            "id": str(row[0]),
            "model_id": row[1],
            "backend": row[2],
            "provider": row[2],
            "endpoint": row[12] or "chat",
            "created_at": str(row[3]),
            "latency_s": latency_s,
            "ttft_s": ttft_s,
            "input_tokens": int(row[6]),
            "output_tokens": int(row[7]),
            "total_tokens": total_tokens,
            "tokens_per_s": round(tokens_per_s, 2),
            "total_cost_usd": round(_safe(row[8]), 8),
            "cost_usd": round(_safe(row[8]), 8),
            "is_success": not bool(row[9]),
            "status": "Error" if bool(row[9]) else "Success",
            "is_stream": bool(row[10]),
            "input_preview": input_text[:200] if input_text else "",
            "output_preview": output_text[:200] if output_text else "",
            "output_text": output_text,
            "deployment_id": None,
            "error_code": row[11] if row[9] else None,
            "history": None,
            "input_messages": input_messages,
            "output_message": output_message,
            # New fields (migration 006)
            "finish_reason": finish_reason or None,
            "request_tools": request_tools,
            "has_tool_calls": has_tool_calls,
            "tool_calls_count": tool_calls_count,
            "tool_calls": response_tool_calls_str,
            "execution_timeline": execution_timeline,
        })

    # Total trace count
    count_sql = f"SELECT count() FROM llm_traces {where}"
    r = client.query(count_sql, parameters=params)
    total_traces = int(r.result_rows[0][0]) if r.result_rows else 0

    return {
        "totals": totals,
        "series": {
            "by_time": by_time,
            "by_model": by_model,
            "by_backend": by_backend,
        },
        "distributions": distributions,
        "trends": trends,
        "leaders": {
            "top_cost_models": top_cost,
            "slowest_models_p95_latency": slowest,
            "most_errors_models": most_errors,
        },
        "insights": [],
        "raw_sample": raw_sample,
        "total_traces": total_traces,
    }


def _empty_analytics() -> dict[str, Any]:
    """Return empty analytics response when ClickHouse is disabled."""
    zero_dist = {"p50": 0, "p90": 0, "p95": 0, "p99": 0, "mean": 0, "std": 0}
    zero_trend = {"requests": 0, "cost_usd": 0, "p95_latency_s": 0, "error_rate": 0}
    return {
        "totals": {
            "request_count": 0, "total_input_tokens": 0, "total_output_tokens": 0,
            "total_cost_usd": 0, "success_rate": 0, "avg_latency_s": 0,
            "p95_latency_s": 0, "avg_cost_per_1k_tokens_usd": 0, "streaming_share": 0,
        },
        "series": {"by_time": [], "by_model": [], "by_backend": []},
        "distributions": {
            "latency_s": zero_dist, "ttft_s": zero_dist, "input_tokens": zero_dist,
            "output_tokens": zero_dist, "cost_per_request_usd": zero_dist,
        },
        "trends": {
            "last_7d": zero_trend, "prev_7d": zero_trend,
            "pct_change": {"requests": None, "cost_usd": None, "p95_latency_s": None, "error_rate": None},
        },
        "leaders": {"top_cost_models": [], "slowest_models_p95_latency": [], "most_errors_models": []},
        "insights": [],
        "raw_sample": [],
        "total_traces": 0,
    }
