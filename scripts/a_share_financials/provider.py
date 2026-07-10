from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

from .core import PROVIDER_VERSION


class ProviderError(RuntimeError):
    pass


class SinaFinancialProvider:
    endpoint = "https://quotes.sina.cn/cn/api/openapi.php/CompanyFinanceService.getFinanceReport2022"
    sources = ("lrb", "fzb", "llb", "gjzb")
    version = PROVIDER_VERSION

    def __init__(self, cache_dir: Path, timeout: float = 15, retries: int = 2, delay: float = 0.12, session: requests.Session | None = None):
        self.cache_dir = cache_dir
        self.timeout = timeout
        self.retries = retries
        self.delay = delay
        self.session = session or requests.Session()
        self.last_fetched_at: str | None = None
        self.session.headers.update({"User-Agent": "investment-research-dashboard/financial-provider-v1"})

    @staticmethod
    def paper_code(stock: dict[str, Any]) -> str:
        exchange = str(stock.get("exchange", "")).upper()
        if exchange not in {"SH", "SZ", "BJ"}:
            raise ProviderError(f"unsupported exchange: {exchange}")
        prefix = "sh" if exchange == "SH" else "sz" if exchange == "SZ" else "bj"
        return f"{prefix}{stock['code']}"

    def fetch(self, stock: dict[str, Any], max_reports: int = 12, use_cache: bool = True) -> dict[str, dict[str, Any]]:
        result: dict[str, dict[str, Any]] = {}
        fetched_times: list[str] = []
        for source in self.sources:
            payload, fetched_at = self._fetch_source(stock, source, max_reports, use_cache)
            fetched_times.append(fetched_at)
            report_list = payload.get("result", {}).get("data", {}).get("report_list")
            if not isinstance(report_list, dict):
                raise ProviderError(f"{stock['code']}:{source}: missing result.data.report_list")
            result[source] = report_list
        # A company snapshot is only as fresh as its oldest component statement.
        self.last_fetched_at = min(fetched_times) if fetched_times else None
        return result

    def _fetch_source(self, stock: dict[str, Any], source: str, max_reports: int, use_cache: bool) -> tuple[dict[str, Any], str]:
        cache_file = self.cache_dir / stock["code"] / f"{source}.json"
        if use_cache and cache_file.exists():
            fetched_at = datetime.fromtimestamp(cache_file.stat().st_mtime, timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
            return json.loads(cache_file.read_text(encoding="utf-8")), fetched_at
        params = {"paperCode": self.paper_code(stock), "source": source, "type": "0", "page": "1", "num": str(max_reports)}
        last_error: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                response = self.session.get(self.endpoint, params=params, timeout=self.timeout)
                response.raise_for_status()
                payload = response.json()
                if payload.get("result", {}).get("data", {}).get("report_list") is None:
                    raise ProviderError("empty or changed response schema")
                cache_file.parent.mkdir(parents=True, exist_ok=True)
                cache_file.write_text(json.dumps(payload, ensure_ascii=False, sort_keys=True), encoding="utf-8")
                fetched_at = datetime.fromtimestamp(cache_file.stat().st_mtime, timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
                time.sleep(self.delay)
                return payload, fetched_at
            except (requests.RequestException, ValueError, ProviderError) as exc:
                last_error = exc
                if attempt < self.retries:
                    time.sleep(0.5 * (attempt + 1))
        raise ProviderError(f"{stock['code']}:{source}: {last_error}")
