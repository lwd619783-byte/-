from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any, Mapping
from zoneinfo import ZoneInfo

from .models import ReleaseConfidenceClass


SHANGHAI = ZoneInfo("Asia/Shanghai")
STRICTLY_INELIGIBLE_CLASSES = {
    ReleaseConfidenceClass.SCHEDULE_INFERRED.value,
    ReleaseConfidenceClass.LATEST_REVISED_PROXY.value,
    ReleaseConfidenceClass.STRUCTURALLY_UNAVAILABLE.value,
}


def parse_aware_datetime(value: str, field: str = "dateTime") -> datetime:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} 必须是非空 RFC 3339 时间")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"{field} 不是合法 RFC 3339 时间: {value}") from exc
    if parsed.utcoffset() is None:
        raise ValueError(f"{field} 必须包含时区: {value}")
    return parsed


def date_only_safe_available_at(publication_date: str) -> str:
    """日期级官方发布按次日 00:00 上海时间保守可见。"""
    try:
        published = date.fromisoformat(publication_date)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"publicationDate 不是合法日期: {publication_date}") from exc
    available = datetime.combine(published + timedelta(days=1), time.min, SHANGHAI)
    return available.isoformat()


def weekly_backtest_cutoff(monday: date | str) -> str:
    if isinstance(monday, str):
        monday = date.fromisoformat(monday)
    if monday.weekday() != 0:
        raise ValueError("weekly backtest clock 必须锚定星期一")
    return datetime.combine(monday, time(hour=8), SHANGHAI).isoformat()


def build_weekly_backtest_clock(
    monday: date | str,
    *,
    latest_eligible_trading_date: str | None = None,
) -> dict[str, Any]:
    cutoff = weekly_backtest_cutoff(monday)
    week_date = monday if isinstance(monday, date) else date.fromisoformat(monday)
    return {
        "weekId": week_date.isoformat(),
        "timezone": "Asia/Shanghai",
        "weekday": "Monday",
        "cutoff": "08:00",
        "runCutoff": cutoff,
        "latestEligibleTradingDate": latest_eligible_trading_date,
        "calendarVersion": "weekly-monday-0800-asia-shanghai-v1",
    }


def is_observation_eligible(
    observation: Mapping[str, Any],
    weekly_cutoff: str | datetime,
    *,
    strict: bool = True,
) -> bool:
    confidence = observation.get("releaseConfidenceClass")
    if strict and confidence in STRICTLY_INELIGIBLE_CLASSES:
        return False
    available_raw = observation.get("releaseAvailableAt")
    if not isinstance(available_raw, str):
        return False
    try:
        available = parse_aware_datetime(available_raw, "releaseAvailableAt")
        cutoff = (
            parse_aware_datetime(weekly_cutoff, "weeklyCutoff")
            if isinstance(weekly_cutoff, str)
            else weekly_cutoff
        )
    except ValueError:
        return False
    if cutoff.utcoffset() is None:
        raise ValueError("weeklyCutoff 必须包含时区")
    return available <= cutoff
