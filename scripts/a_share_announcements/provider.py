from __future__ import annotations

import io
import json
import random
import time
from pathlib import Path
from typing import Any

import requests

CNINFO_QUERY_URL = "https://www.cninfo.com.cn/new/hisAnnouncement/query"
CNINFO_DETAIL_BASE = "https://www.cninfo.com.cn/new/disclosure/detail?annoId="


class AnnouncementProviderError(RuntimeError):
    pass


class CNInfoClient:
    def __init__(self, cache_dir: Path, timeout: int = 20, retries: int = 2, delay: float = 0.35, session: requests.Session | None = None):
        self.cache_dir = cache_dir
        self.timeout = timeout
        self.retries = max(0, min(retries, 2))
        self.delay = max(0.2, delay)
        self.session = session or requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://www.cninfo.com.cn/new/disclosure",
            "Origin": "https://www.cninfo.com.cn",
        })
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        last: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                response = self.session.post(CNINFO_QUERY_URL, data=payload, timeout=self.timeout)
                if response.status_code >= 500 and attempt < self.retries:
                    time.sleep(0.5 * (attempt + 1)); continue
                response.raise_for_status()
                data = response.json()
                if not isinstance(data.get("announcements", []), list):
                    raise AnnouncementProviderError("CNInfo response lacks announcements list")
                return data
            except (requests.RequestException, ValueError, AnnouncementProviderError) as exc:
                last = exc
                if attempt < self.retries: time.sleep(0.5 * (attempt + 1))
        raise AnnouncementProviderError(f"CNInfo query failed: {last}")

    def fetch_company(self, stock: dict[str, str], start: str, end: str, use_cache: bool = True) -> list[dict[str, Any]]:
        cache_path = self.cache_dir / f"{stock['id']}-{start}-{end}.json"
        if use_cache and cache_path.exists():
            return json.loads(cache_path.read_text(encoding="utf-8"))
        column = "szse" if stock["exchange"] == "SZ" else "sse"
        base = {"tabName": "fulltext", "pageSize": "30", "column": column, "category": "", "plate": "", "seDate": f"{start}~{end}", "secid": "", "sortName": "", "sortType": "", "isHLtitle": "true"}
        discovery = self._post({**base, "stock": "", "pageNum": "1", "searchkey": stock["code"]})
        rows = [row for row in discovery.get("announcements", []) if str(row.get("secCode") or "") == stock["code"]]
        org_id = next((str(row.get("orgId")) for row in rows if row.get("orgId")), None)
        if not org_id:
            cache_path.write_text(json.dumps([], ensure_ascii=False), encoding="utf-8")
            return []
        all_rows: list[dict[str, Any]] = []
        page = 1
        while True:
            if page == 1:
                data = self._post({**base, "stock": f"{stock['code']},{org_id}", "pageNum": "1", "searchkey": ""})
            else:
                time.sleep(self.delay + random.uniform(0.0, 0.12))
                data = self._post({**base, "stock": f"{stock['code']},{org_id}", "pageNum": str(page), "searchkey": ""})
            page_rows = [row for row in data.get("announcements", []) if str(row.get("secCode") or "") == stock["code"]]
            all_rows.extend(page_rows)
            if not data.get("hasMore") or not page_rows:
                break
            page += 1
            if page > 100:
                raise AnnouncementProviderError(f"CNInfo pagination exceeded limit for {stock['code']}")
        unique = {str(row.get("announcementId")): row for row in all_rows if row.get("announcementId")}
        result = sorted(unique.values(), key=lambda row: (row.get("announcementTime") or 0, str(row.get("announcementId") or "")), reverse=True)
        cache_path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
        return result

    def extract_pdf_text(self, announcement_id: str, pdf_url: str) -> str | None:
        cache_path = self.cache_dir / "pdf-text" / f"{announcement_id}.txt"
        if cache_path.exists():
            return cache_path.read_text(encoding="utf-8")
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            response = self.session.get(pdf_url, headers={"Referer": "https://www.cninfo.com.cn/"}, timeout=30)
            response.raise_for_status()
            if not response.content.startswith(b"%PDF"):
                return None
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(response.content))
            text = "\n".join((page.extract_text() or "") for page in reader.pages)
            if len(text.strip()) < 40:
                return None
            cache_path.write_text(text, encoding="utf-8")
            return text
        except Exception:
            return None
