"""CSRC C1 evidence acquisition only: full bytes, observed links, no observations."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from urllib.parse import quote, unquote, urljoin, urlsplit, urlunsplit

import requests

from .collectors import decode_html, extract_html
from .hashing import atomic_write_bytes

RAW = "research-data/market-regime/raw/csrc-r2c1"
ROOT = "https://www.csrc.gov.cn/csrc/c100120/common_list.shtml"


def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def dump(path, value):
    atomic_write_bytes(path, (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode())


def official(url):
    p = urlsplit(url)
    host = (p.hostname or "").lower()
    if (p.scheme not in ("http", "https") or p.username or p.password or p.port not in (None, 80, 443)
            or not (host == "csrc.gov.cn" or host.endswith(".csrc.gov.cn"))):
        raise ValueError("OFFICIAL_CSRC_URL_REQUIRED")
    return urlunsplit((p.scheme, p.netloc, quote(unquote(p.path), safe="/%:@"), p.query, ""))


class Collector:
    def __init__(self, repo, *, interval=1.05, timeout=25, budget=1200, raw_directory=RAW):
        if interval < 1 or not 1 <= timeout <= 60 or not 1 <= budget <= 3000:
            raise ValueError("BOUNDED_REQUEST_POLICY_REQUIRED")
        self.repo = Path(repo).resolve()
        self.raw_directory = raw_directory
        self.root = (self.repo / raw_directory).resolve()
        if not self.root.is_relative_to((self.repo / "research-data/market-regime/raw").resolve()):
            raise ValueError("RAW_PATH_ESCAPE")
        self.root.mkdir(parents=True, exist_ok=True)
        self.journal = self.root / "retrieval-journal.jsonl"
        self.rows = [json.loads(x) for x in self.journal.read_text(encoding="utf-8").splitlines()] if self.journal.exists() else []
        self.interval, self.timeout, self.budget = interval, timeout, budget
        self.last, self.count = 0, 0
        self.session = requests.Session()

    def append(self, row):
        with self.journal.open("a", encoding="utf-8", newline="\n") as f:
            f.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
        self.rows.append(row)

    def bytes(self, row):
        s = row.get("storedBytes")
        if not s:
            raise ValueError("NO_STORED_BYTES")
        path = (self.repo / s["localPath"]).resolve()
        if not path.is_relative_to(self.root.resolve()):
            raise ValueError("RAW_PATH_ESCAPE")
        body = path.read_bytes()
        if len(body) != s["byteSize"] or hashlib.sha256(body).hexdigest() != s["sha256"]:
            raise ValueError("RAW_BYTES_MISMATCH")
        return body

    def fetch(self, url, role, *, refresh=False, form_data=None):
        discovered = official(url)
        p = urlsplit(discovered)
        if form_data is not None and p.path != "/getSearch":
            raise ValueError("ONLY_READ_ONLY_TITLE_SEARCH_FORM_SUPPORTED")
        request_url = urlunsplit(("https", p.netloc, p.path, p.query, ""))
        if not refresh:
            for old in reversed(self.rows):
                if old["requestUrl"] == request_url and old.get("requestForm") == form_data and old["outcome"] == "SUCCESS":
                    try:
                        self.bytes(old)
                    except (OSError, ValueError):
                        break
                    ts = now()
                    self.append(dict(old, attemptId="cache-" + hashlib.sha256((old["attemptId"] + ts).encode()).hexdigest()[:24],
                                     outcome="CACHE_VERIFIED", attemptedAt=ts, verifiedAt=now(), httpStatus=None,
                                     acquisitionAttemptId=old["attemptId"]))
                    return old
        for retry in range(2):
            ts = now()
            row = dict(attemptId="get-" + hashlib.sha256((request_url + ts).encode()).hexdigest()[:24],
                       requestUrl=request_url, discoveredUrl=discovered, finalUrl=None, role=role, attemptedAt=ts,
                       httpStatus=None, contentType=None, storedBytes=None, outcome="TRANSPORT_ERROR",
                       blocker=None, redirects=[], acquisitionAttemptId=None, verifiedAt=None)
            if form_data is not None:
                row.update(requestMethod="POST", requestForm=form_data)
            if self.raw_directory != RAW:
                row["physicalRequests"] = 0
            try:
                current = request_url
                for _ in range(6):
                    if self.count >= self.budget:
                        raise ValueError("REQUEST_BUDGET_EXHAUSTED")
                    time.sleep(max(0, self.interval - (time.monotonic() - self.last)))
                    self.count += 1
                    if "physicalRequests" in row:
                        row["physicalRequests"] += 1
                    self.last = time.monotonic()
                    options = dict(headers={"User-Agent": "Mozilla/5.0 (compatible; CSRCInventoryProbe/1.0)", "Accept": "*/*"},
                                   timeout=self.timeout, allow_redirects=False)
                    response = (self.session.get(current, **options) if form_data is None else
                                self.session.post(current, data=form_data, **options))
                    # Preserve every physical response, including redirect/error bodies.
                    body = response.content
                    digest = hashlib.sha256(body).hexdigest()
                    local = f"{self.raw_directory}/sha256/{digest}.bin"
                    atomic_write_bytes(self.repo / local, body)
                    stored = dict(localPath=local, sha256=digest, byteSize=len(body))
                    row.update(finalUrl=official(response.url), httpStatus=response.status_code,
                               contentType=response.headers.get("Content-Type", "application/octet-stream"), storedBytes=stored)
                    if response.is_redirect:
                        row["redirects"].append(dict(url=current, httpStatus=response.status_code, storedBytes=stored,
                                                     location=response.headers["Location"]))
                        if form_data is not None:
                            raise ValueError("FORM_REDIRECT_REQUIRES_NEW_DISCOVERY")
                        current = official(urljoin(current, response.headers["Location"]))
                        continue
                    row["outcome"] = "SUCCESS" if 200 <= response.status_code < 300 and body else "HTTP_ERROR"
                    if row["outcome"] != "SUCCESS":
                        row["blocker"] = "HTTP_OR_EMPTY_RESPONSE"
                    if row["outcome"] == "SUCCESS" and role in ("INDEX", "LANDING"):
                        html = decode_html(body, row["contentType"])
                        if not re.search(r"中国证券监督管理委员会|证券市场|统计数据", html) or re.search(r"<title[^>]*>[^<]*(?:错误|验证|Forbidden|Error)", html, re.I):
                            row.update(outcome="CONTENT_REJECTED", blocker="UNRECOGNIZED_OR_ERROR_HTML")
                    break
                else:
                    row.update(outcome="TRANSPORT_ERROR", blocker="REDIRECT_LIMIT")
            except (requests.RequestException, OSError, ValueError) as exc:
                row.update(outcome="TRANSPORT_ERROR", blocker=type(exc).__name__)
            self.append(row)
            if row["outcome"] == "SUCCESS" or row["httpStatus"] in (400, 401, 403, 404, 410):
                break
        return row

    def html(self, row):
        return decode_html(self.bytes(row), row["contentType"]) if row["outcome"] == "SUCCESS" else ""


def periods(text):
    return sorted({f"{int(y):04d}-{int(m):02d}" for y, m in re.findall(r"((?:19|20)\d{2})\s*年\s*(\d{1,2})\s*月", text) if 1 <= int(m) <= 12})


def anchors(html, base):
    found = []
    for m in re.finditer(r'<a\b[^>]*href\s*=\s*[\"\']([^\"\']+)[\"\'][^>]*>.*?</a>', html, re.I | re.S):
        try:
            url = official(urljoin(base, unescape(m.group(1))))
        except ValueError:
            continue
        found.append(dict(url=url, title=extract_html(m.group(0))[0], anchorHtml=m.group(0), start=m.start(), end=m.end()))
    return found


def parse_index(html, url):
    entries = []
    for a in anchors(html, url):
        ps = periods(a["title"])
        if not ps or not re.search(r"统计数据|证券市场", a["title"]):
            continue
        # A publication date is scoped to this one li, never the next report.
        left = html.rfind("<li", 0, a["start"])
        right = html.find("</li>", a["end"])
        snippet = html[left:right + 5] if left >= 0 and right >= 0 and "</li>" not in html[left:a["start"]] else a["anchorHtml"]
        ds = sorted(set(re.findall(r"(?:19|20)\d{2}-\d{2}-\d{2}", snippet)))
        entries.append(dict(url=a["url"], title=a["title"], periods=ps, entryHtml=snippet,
                            publicationDate=ds[0] if len(ds) == 1 else None))
    m = re.search(r"createPageHTML\(\s*'page_div'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(\d+)\s*\)", html)
    return dict(entries=entries, pagination=dict(totalPages=int(m[1]), page=int(m[2]), prefix=m[3], suffix=m[4], totalEntries=int(m[5]), marker=m[0]) if m else None)


def parse_landing(html, url):
    title = re.search(r'<meta\s+name=["\']ArticleTitle["\']\s+content=["\']([^"\']*)', html, re.I)
    if not title:
        title = re.search(r'<h[12]\b[^>]*>(.*?)</h[12]>', html, re.S | re.I)
    label = extract_html(title[1])[0] if title else ""
    meta_dates = re.findall(r'<meta\s+name=["\']PubDate["\']\s+content=["\']([^"\']*)', html, re.I)
    # Live CSRC explicitly labels PubDate as 页面生成时间 in meta others.
    # It must not replace the report's visible 日期 or official index date.
    generated_dates = re.findall(r'页面生成时间\s+(\d{4}-\d{2}-\d{2}[^"<>]*)', html)
    visible = re.findall(r'<p\b[^>]*>\s*日期[：:]\s*(\d{4}-\d{2}-\d{2})[^<]*</p>', html, re.I)
    dates = visible or ([] if generated_dates else meta_dates)
    candidates = []
    for a in anchors(html, url):
        path = unquote(urlsplit(a["url"]).path)
        if re.search(r"\.(?:xls[xmb]?|docx?|pdf|zip|rar|csv|rtf)$", path, re.I) or "/files/" in path:
            candidates.append(dict(url=a["url"], title=a["title"], anchorHtml=a["anchorHtml"],
                                   namedPeriods=periods(a["title"] + " " + Path(path).name)))
    return dict(title=label, periods=periods(label), publicationDates=sorted(set(d[:10] for d in dates)),
                metaPubDates=meta_dates, pageGenerationDates=generated_dates, publicationBasis="VISIBLE_DATE" if visible else "META" if dates else "INDEX_FALLBACK_REQUIRED",
                attachments=candidates)


def collect(repo, *, budget=1200, index_only=False):
    c = Collector(repo, budget=budget)
    root = c.fetch(ROOT, "INDEX")
    html = c.html(root)
    navigation = [dict(url=ROOT, attemptId=root["attemptId"], basis="FROZEN_OFFICIAL_ROOT")]
    queue = [ROOT]
    # Archive root is an actual link from the current index; monthly archive is
    # discovered from that root, never taken from historical guessed ids.
    for a in anchors(html, ROOT):
        if a["title"] == "归档数据":
            archive = c.fetch(a["url"], "INDEX")
            navigation.append(dict(url=a["url"], attemptId=archive["attemptId"], parentAttemptId=root["attemptId"], anchorHtml=a["anchorHtml"]))
            for b in anchors(c.html(archive), a["url"]):
                if b["title"] == "证券市场月报":
                    queue.append(b["url"])
                    navigation.append(dict(url=b["url"], parentAttemptId=archive["attemptId"], anchorHtml=b["anchorHtml"]))
    pages, seen = [], set()
    while queue:
        url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        row = c.fetch(url, "INDEX")
        text = c.html(row)
        parsed = parse_index(text, url)
        page = dict(url=url, attemptId=row["attemptId"], **parsed, blockers=[])
        paging = parsed["pagination"]
        if paging:
            scripts = re.findall(r'<script[^>]*src=["\']([^"\']*page\.js)["\']', text, re.I)
            if scripts:
                jsurl = official(urljoin(url, scripts[0]))
                jsrow = c.fetch(jsurl, "PAGINATION_SCRIPT")
                js = c.html(jsrow)
                page["paginationScriptAttemptId"] = jsrow["attemptId"]
                # Interpret only the exact, archived official template. No JS eval.
                if "param = i == 1 ? '' : '_' + i" in js and "pagePrefix + param + '.' + pageSuffix" in js:
                    for n in range(1, paging["totalPages"] + 1):
                        nxt = official(urljoin(url, f"{paging['prefix']}{'_' + str(n) if n > 1 else ''}.{paging['suffix']}"))
                        if nxt not in seen and nxt not in queue:
                            queue.append(nxt)
                else:
                    page["blockers"].append("PAGINATION_TEMPLATE_UNSUPPORTED")
            else:
                page["blockers"].append("PAGINATION_SCRIPT_MISSING")
        else:
            page["blockers"].append("PAGINATION_MARKER_MISSING")
        pages.append(page)
        dump(c.root / "discovery.json", dict(navigation=navigation, pages=pages, pendingUrls=queue))
        print(json.dumps(dict(indexPages=len(pages), entries=len(parsed["entries"]), outcome=row["outcome"])), flush=True)
    if index_only:
        return
    candidates = {}
    for page in pages:
        for entry in page["entries"]:
            if any("2005-01" <= p <= "2026-08" for p in entry["periods"]):
                candidates.setdefault(entry["url"], []).append(dict(indexAttemptId=page["attemptId"], **entry))
    landings = []
    for url, entries in sorted(candidates.items()):
        row = c.fetch(url, "LANDING")
        landing = dict(url=url, attemptId=row["attemptId"], indexEntries=entries, **parse_landing(c.html(row), url))
        for a in landing["attachments"]:
            att = c.fetch(a["url"], "ATTACHMENT")
            a["attemptId"] = att["attemptId"]
        landings.append(landing)
        dump(c.root / "inventory-source.json", dict(navigation=navigation, pages=pages, landings=landings, complete=len(landings) == len(candidates)))
        print(json.dumps(dict(landings=len(landings), total=len(candidates), attachments=len(landing["attachments"]), periods=landing["periods"])), flush=True)


def supplement_archive(repo, *, theme=False):
    """Follow the statistical archive breadcrumb from an acquired landing."""
    from .csrc_archive import collect_archive
    c = Collector(repo)
    source = json.loads((c.root / "inventory-source.json").read_text(encoding="utf-8"))
    rows = {r["attemptId"]: r for r in c.rows}
    navigation = None
    for landing in source["landings"]:
        for a in anchors(c.html(rows[landing["attemptId"]]), landing["url"]):
            if a["title"] == ("其他" if theme else "证券市场统计") and "zfxxgk_zdgk.shtml" in a["url"]:
                archive_row = c.fetch(a["url"], "INDEX")
                navigation = dict(parentAttemptId=landing["attemptId"], anchorHtml=a["anchorHtml"], url=a["url"], attemptId=archive_row["attemptId"])
                break
        if navigation:
            break
    if not navigation:
        raise ValueError("STATISTICAL_ARCHIVE_BREADCRUMB_NOT_FOUND")
    navigation_name = "theme-archive-navigation.json" if theme else "archive-navigation.json"
    output_name = "theme-archive-discovery.json" if theme else "archive-discovery.json"
    dump(c.root / navigation_name, navigation)
    archive = collect_archive(repo, navigation_name=navigation_name, output_name=output_name)
    c = Collector(repo)  # include the archive collector's newly journaled acquisitions
    by_url = {l["url"]: l for l in source["landings"]}
    for page in archive["pages"]:
        for e in page["entries"]:
            if not any("2005-01" <= p <= "2026-08" for p in e["periods"]):
                continue
            entry = dict(e, indexAttemptId=page["attemptId"], jsonLocator=e["entryJsonLocator"])
            if e["url"] not in by_url:
                r = c.fetch(e["url"], "LANDING")
                l = dict(url=e["url"], attemptId=r["attemptId"], indexEntries=[], **parse_landing(c.html(r), e["url"]))
                for a in l["attachments"]:
                    a["attemptId"] = c.fetch(a["url"], "ATTACHMENT")["attemptId"]
                by_url[e["url"]] = l
                print(json.dumps(dict(supplementPeriod=e["periods"], totalLandings=len(by_url))), flush=True)
            # Idempotent augmentation retains the two independent index views.
            if entry not in by_url[e["url"]]["indexEntries"]:
                by_url[e["url"]]["indexEntries"].append(entry)
    source.update(landings=list(by_url.values()), complete=archive["complete"])
    source["themeArchive" if theme else "archive"] = archive
    dump(c.root / "inventory-source.json", source)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--budget", type=int, default=1200)
    parser.add_argument("--index-only", action="store_true")
    parser.add_argument("--supplement-only", action="store_true")
    args = parser.parse_args()
    if not args.supplement_only:
        collect(args.repo_root, budget=args.budget, index_only=args.index_only)
    if not args.index_only:
        supplement_archive(args.repo_root)
        supplement_archive(args.repo_root, theme=True)
