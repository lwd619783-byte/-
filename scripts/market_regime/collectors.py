from __future__ import annotations

import mimetypes
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote, urljoin, urlparse, urlsplit, urlunsplit
from urllib.request import Request, urlopen

from .hashing import sha256_bytes
from .models import ParseStatus, ReleaseConfidenceClass
from .time_semantics import date_only_safe_available_at


USER_AGENT = "investment-research-dashboard-market-regime-r1/1.0 (+offline-tests; official-source-probe)"
PUBLICATION_INSTANT_RE = re.compile(r"(?:文章来源|发布时间|发布于)[：:\s]+(20\d{2}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)")
PUBLICATION_DATE_RE = re.compile(r"(?:日期|发布日期)[：:\s]+(20\d{2}-\d{2}-\d{2})")
PERIOD_RE = re.compile(r"(20\d{2})年\s*(\d{1,2})月")


class DownloadFailure(RuntimeError):
    def __init__(self, url: str, message: str, http_status: int | None = None):
        super().__init__(message)
        self.url = url
        self.http_status = http_status


@dataclass(frozen=True)
class DownloadedResource:
    url: str
    status: int
    content_type: str
    fetched_at: str
    body: bytes


class _HtmlExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.text_parts: list[str] = []
        self.links: list[tuple[str, str]] = []
        self._active_href: str | None = None
        self._active_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "a":
            self._active_href = dict(attrs).get("href")
            self._active_text = []

    def handle_data(self, data: str) -> None:
        clean = re.sub(r"\s+", " ", unescape(data)).strip()
        if not clean:
            return
        self.text_parts.append(clean)
        if self._active_href is not None:
            self._active_text.append(clean)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._active_href is not None:
            self.links.append((self._active_href, " ".join(self._active_text).strip()))
            self._active_href = None
            self._active_text = []

    @property
    def text(self) -> str:
        return " ".join(self.text_parts)


def decode_html(body: bytes, content_type: str = "") -> str:
    charset_match = re.search(r"charset=([A-Za-z0-9_-]+)", content_type, re.I)
    candidates = [charset_match.group(1)] if charset_match else []
    candidates.extend(["utf-8", "gb18030"])
    for encoding in candidates:
        try:
            return body.decode(encoding)
        except (LookupError, UnicodeDecodeError):
            continue
    return body.decode("utf-8", errors="replace")


def extract_html(html: str) -> tuple[str, list[tuple[str, str]]]:
    parser = _HtmlExtractor()
    parser.feed(html)
    return parser.text, parser.links


def fetch_resource(url: str, *, timeout_seconds: float = 30.0) -> DownloadedResource:
    parsed_url = urlsplit(url)
    request_url = urlunsplit((
        parsed_url.scheme,
        parsed_url.netloc,
        quote(parsed_url.path, safe="/%:@"),
        quote(parsed_url.query, safe="=&%:@/?"),
        "",
    ))
    request = Request(request_url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            status = int(response.status)
            body = response.read()
            content_type = response.headers.get("Content-Type", "application/octet-stream").split(";", 1)[0].strip()
    except HTTPError as exc:
        raise DownloadFailure(url, f"HTTP {exc.code}", exc.code) from exc
    except (URLError, TimeoutError, OSError) as exc:
        raise DownloadFailure(url, f"{type(exc).__name__}: {exc}") from exc
    if not 200 <= status < 300:
        raise DownloadFailure(url, f"HTTP {status}", status)
    if not body:
        raise DownloadFailure(url, "官方响应为空", status)
    fetched_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return DownloadedResource(url, status, content_type, fetched_at, body)


def _publication(text: str) -> tuple[str | None, str, str | None]:
    exact = PUBLICATION_INSTANT_RE.search(text)
    if exact:
        time_text = exact.group(2)
        if len(time_text) == 5:
            time_text += ":00"
        value = f"{exact.group(1)}T{time_text}+08:00"
        return value, ReleaseConfidenceClass.EXACT_TIMESTAMP.value, exact.group(1)
    date_only = PUBLICATION_DATE_RE.search(text)
    if date_only:
        return None, ReleaseConfidenceClass.DATE_ONLY_SAFE.value, date_only.group(1)
    return None, "", None


def _period_from_title_or_text(title: str, text: str) -> str:
    match = PERIOD_RE.search(title) or PERIOD_RE.search(text)
    if match:
        return f"{int(match.group(1)):04d}-{int(match.group(2)):02d}"
    annual = re.search(r"(20\d{2})年(?:全年)?[^。]{0,30}(?:社会融资规模存量|金融统计)", title)
    if annual:
        return f"{int(annual.group(1)):04d}-12"
    raise ValueError("无法从官方页面识别统计期")


def _release_available_at(
    publication_datetime: str | None,
    confidence: str,
    publication_date: str | None,
) -> str:
    if confidence == ReleaseConfidenceClass.EXACT_TIMESTAMP.value and publication_datetime:
        return publication_datetime
    if confidence == ReleaseConfidenceClass.DATE_ONLY_SAFE.value and publication_date:
        return date_only_safe_available_at(publication_date)
    raise ValueError("官方页面缺少可接受的发布日期/时间")


def parse_pboc_m2_page(html: str, source_url: str) -> dict[str, Any]:
    text, _ = extract_html(html)
    title_match = re.search(r"(20\d{2}年\s*\d{1,2}月[^。]{0,40}(?:金融统计数据报告|金融运行))", text)
    title = title_match.group(1) if title_match else text[:120]
    publication_datetime, confidence, publication_date = _publication(text)
    release_available_at = _release_available_at(publication_datetime, confidence, publication_date)

    m2_pattern = re.compile(
        r"(?:广义货币(?:供应量)?\s*(?:\(\s*M2\s*\)|M2)|M2)"
        r"[^。；]{0,100}?余额(?:为)?\s*([0-9]+(?:\.[0-9]+)?)\s*(万亿元|亿元)"
        r"[^。；]{0,80}?同比(?:增长)?\s*([+-]?[0-9]+(?:\.[0-9]+)?)\s*[%％]"
    )
    match = m2_pattern.search(text)
    if not match:
        raise ValueError("未在官方页面识别到 M2 余额与同比")
    prefix = text[: match.start()]
    months = re.findall(r"(?<!\d)(\d{1,2})月末", prefix[-240:])
    title_year = re.search(r"(20\d{2})年", title)
    if months and (title_year or publication_date):
        observation_month = int(months[-1])
        if title_year:
            observation_year = int(title_year.group(1))
        else:
            release_year, release_month = map(int, str(publication_date).split("-")[:2])
            observation_year = release_year - 1 if observation_month > release_month else release_year
        value_date = f"{observation_year:04d}-{observation_month:02d}"
    else:
        value_date = _period_from_title_or_text(title, text)
    notes = [
        sentence.strip()
        for sentence in re.split(r"(?<=[。；])", text)
        if "M2" in sentence and any(token in sentence for token in ("口径", "包括", "统计"))
    ]
    return {
        "sourceId": "PBOC_M2_OFFICIAL_RELEASE",
        "sourceUrl": source_url,
        "title": title.strip(),
        "valueDate": value_date,
        "publicationDateTime": publication_datetime,
        "publicationDate": publication_date,
        "releaseAvailableAt": release_available_at,
        "releaseConfidenceClass": confidence,
        "m2Balance": float(match.group(1)),
        "m2BalanceUnit": match.group(2),
        "m2YoY": float(match.group(3)),
        "definitionNotes": notes,
    }


def parse_pboc_afre_stock_page(html: str, source_url: str) -> dict[str, Any]:
    text, _ = extract_html(html)
    title_match = re.search(r"(20\d{2}年\s*(?:\d{1,2}月|上半年|全年)?[^。]{0,30}社会融资规模存量统计数据报告)", text)
    title = title_match.group(1) if title_match else text[:160]
    publication_datetime, confidence, publication_date = _publication(text)
    release_available_at = _release_available_at(publication_datetime, confidence, publication_date)
    period = _period_from_title_or_text(title, text)
    stock_match = re.search(
        r"社会融资规模存量(?:为)?\s*([0-9]+(?:\.[0-9]+)?)\s*(万亿元|亿元)"
        r"[^。；]{0,120}?同比(?:增长)?\s*([+-]?[0-9]+(?:\.[0-9]+)?)\s*[%％]",
        text,
    )
    if not stock_match:
        raise ValueError("未在官方页面识别到社融存量与同比")
    notes = [
        sentence.strip()
        for sentence in re.split(r"(?<=[。；])", text)
        if "社会融资规模" in sentence and any(token in sentence for token in ("统计方法", "纳入", "追溯", "可比"))
    ]
    is_backcast = any(token in text for token in ("历史数据追溯", "以来各月可比口径", "历史数据"))
    return {
        "sourceId": "PBOC_AFRE_STOCK_OFFICIAL_RELEASE",
        "sourceUrl": source_url,
        "title": title.strip(),
        "valueDate": period,
        "publicationDateTime": publication_datetime,
        "publicationDate": publication_date,
        "releaseAvailableAt": release_available_at,
        "releaseConfidenceClass": (
            ReleaseConfidenceClass.BACKCAST_RELEASED_LATER.value
            if is_backcast
            else confidence
        ),
        "afreStock": float(stock_match.group(1)),
        "afreStockUnit": stock_match.group(2),
        "afreStockYoY": float(stock_match.group(3)),
        "definitionNotes": notes,
        "containsBackcast": is_backcast,
    }


def parse_csrc_report_page(
    html: str,
    page_url: str,
    *,
    publication_date_fallback: str | None = None,
    expected_period: str | None = None,
) -> dict[str, Any]:
    text, links = extract_html(html)
    title_match = re.search(r"(20\d{2}年\s*\d{1,2}月统计数据)", text)
    if not title_match:
        raise ValueError("未识别到证监会月报标题")
    title = title_match.group(1)
    report_period = _period_from_title_or_text(title, text)
    if expected_period and report_period != expected_period:
        raise ValueError(f"证监会月报期次不一致: expected={expected_period}, actual={report_period}")
    publication_datetime, confidence, publication_date = _publication(text)
    if not publication_date and publication_date_fallback:
        publication_date = publication_date_fallback
        confidence = ReleaseConfidenceClass.DATE_ONLY_SAFE.value
    release_available_at = _release_available_at(publication_datetime, confidence, publication_date)
    candidates: list[tuple[str, str]] = []
    for href, label in links:
        path = urlparse(href).path.lower()
        if path.endswith((".xls", ".xlsx", ".docx", ".csv")):
            candidates.append((urljoin(page_url, href), label))
    if not candidates:
        raise ValueError("证监会月报页面未找到可下载附件")
    attachment_url, label = candidates[0]
    raw_name = unquote(Path(urlparse(attachment_url).path).name)
    file_name = raw_name or label or f"{report_period}-attachment"
    return {
        "sourceId": "CSRC_SECURITIES_MONTHLY_REPORT",
        "reportPeriod": report_period,
        "publicationDateTime": publication_datetime,
        "publicationDate": publication_date,
        "releaseAvailableAt": release_available_at,
        "releaseConfidenceClass": confidence,
        "pageUrl": page_url,
        "attachmentUrl": attachment_url,
        "xlsUrl": attachment_url if file_name.lower().endswith((".xls", ".xlsx")) else None,
        "fileName": file_name,
        "downloadStatus": "INDEXED",
    }


def artifact_from_download(
    resource: DownloadedResource,
    *,
    source_id: str,
    local_path: str,
    publication_datetime: str | None,
    publication_date: str | None,
    release_available_at: str,
    release_confidence_class: str,
    parse_status: str = ParseStatus.INDEXED.value,
) -> dict[str, Any]:
    digest = sha256_bytes(resource.body)
    file_name = unquote(Path(urlparse(resource.url).path).name) or f"artifact-{digest[:12]}"
    content_type = resource.content_type or mimetypes.guess_type(file_name)[0] or "application/octet-stream"
    return {
        "artifactId": f"artifact-{source_id.lower().replace('_', '-')}-{digest[:16]}",
        "sourceId": source_id,
        "sourceUrl": resource.url,
        "publicationDateTime": publication_datetime,
        "publicationDate": publication_date,
        "releaseAvailableAt": release_available_at,
        "fetchedAt": resource.fetched_at,
        "contentType": content_type,
        "fileName": file_name,
        "sha256": digest,
        "byteSize": len(resource.body),
        "httpStatus": resource.status,
        "releaseConfidenceClass": release_confidence_class,
        "artifactRole": "RAW_SOURCE",
        "localPath": local_path.replace("\\", "/"),
        "parseStatus": parse_status,
        "error": None,
    }
