"""Bounded official PBC discovery and resumable full-response acquisition.

The append-only journal is retrieval evidence, never a release-date or first-release
claim. A cache hit retains its original acquisition and separately records verification.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit, urlunsplit, quote
from urllib.request import HTTPRedirectHandler, Request, build_opener

from .collectors import decode_html, extract_html
from .hashing import atomic_write_bytes

DEFAULT_ROOTS = [
    "https://www.pbc.gov.cn/diaochatongjisi/116219/116225/index.html",
    "https://www.pbc.gov.cn/diaochatongjisi/116219/116227/index.html",
]
RAW_DIRECTORY = "research-data/market-regime/raw/pbc-r2b"


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def official_url(url: str) -> str:
    parsed = urlsplit(url)
    host = (parsed.hostname or "").lower()
    if (parsed.scheme not in ("http", "https") or parsed.username or parsed.password
            or parsed.port not in (None, 80, 443)
            or not (host == "pbc.gov.cn" or host.endswith(".pbc.gov.cn"))):
        raise ValueError("Only public official PBC URLs are allowed")
    return urlunsplit((parsed.scheme, parsed.netloc, quote(parsed.path, safe="/%:@"),
                       quote(parsed.query, safe="=&%:@/?"), ""))


def https_request_url(url: str) -> str:
    """Upgrade an observed official HTTP link's scheme, never its host/path.

    This chooses the URL for a *new physical request*. Previously journaled HTTP
    acquisitions remain HTTP and cannot be relabeled as R2-A HTTPS evidence.
    """
    parsed = urlsplit(official_url(url))
    return urlunsplit(("https", parsed.netloc, parsed.path, parsed.query, ""))


class OfficialRedirect(HTTPRedirectHandler):
    def __init__(self, before_redirect=None):
        self.before_redirect = before_redirect

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        newurl = https_request_url(newurl)
        if self.before_redirect:
            self.before_redirect()
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def content_rejection(body: bytes, content_type: str) -> str | None:
    if not body:
        return "EMPTY_RESPONSE"
    if "html" in content_type.lower() or body.lstrip().startswith(b"<"):
        html = decode_html(body, content_type)
        if re.search(r"<title[^>]*>[^<]*(?:error|login|access denied|captcha|访问拒绝|验证|错误)", html, re.I):
            return "ERROR_OR_CHALLENGE_PAGE"
        if re.search(r"(?:安全验证|人机验证|访问过于频繁|请完成验证|captcha|acw_sc__v2)", html, re.I):
            return "ERROR_OR_CHALLENGE_PAGE"
        table_text = extract_html(html)[0]
        recognized_table = bool(re.search(r"货币供应量\s*Money\s+Supply|社会融资规模存量.*?Aggregate\s+Financing", table_text, re.I | re.S))
        if "中国人民银行" not in html and "pbc.gov.cn" not in html and not recognized_table:
            return "UNRECOGNIZED_HTML_CONTENT"
    return None


class Collector:
    def __init__(self, repo_root: Path, *, interval: float = 1.1, timeout: float = 20,
                 budget: int = 900, retries: int = 1, opener=None):
        if interval < 1 or budget < 1 or retries not in (0, 1, 2) or not 1 <= timeout <= 60:
            raise ValueError("Require interval >= 1s, bounded budget/retries and timeout <= 60s")
        self.repo = repo_root.resolve()
        self.root = self.repo / RAW_DIRECTORY
        self.root.mkdir(parents=True, exist_ok=True)
        self.journal_path = self.root / "retrieval-journal.jsonl"
        self.rows = []
        if self.journal_path.exists():
            self.rows = [json.loads(line) for line in self.journal_path.read_text(encoding="utf-8").splitlines() if line]
        self.interval, self.timeout, self.budget, self.retries = interval, timeout, budget, retries
        self.network_count, self.last_request = 0, None
        self.opener = opener or build_opener(OfficialRedirect(self._before_request))

    def _before_request(self):
        if self.network_count >= self.budget:
            raise RuntimeError("REQUEST_BUDGET_EXHAUSTED")
        if self.last_request is not None:
            time.sleep(max(0, self.interval - (time.monotonic() - self.last_request)))
        self.network_count += 1
        self.last_request = time.monotonic()

    def _append(self, row):
        with self.journal_path.open("a", encoding="utf-8", newline="\n") as stream:
            stream.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
            stream.flush()
        self.rows.append(row)

    def _verified_bytes(self, stored):
        path = (self.repo / stored["localPath"]).resolve()
        if not path.is_relative_to(self.root.resolve()):
            return False
        if not path.is_file():
            return False
        body = path.read_bytes()
        return len(body) == stored["byteSize"] and hashlib.sha256(body).hexdigest() == stored["sha256"]

    def fetch(self, source_id: str, url: str, *, refresh: bool = False):
        discovered_url = official_url(url)
        url = https_request_url(discovered_url)
        for row in ([] if refresh else reversed(self.rows)):
            a = row["attempt"]
            if a["outcome"] == "SUCCESS" and a["sourceId"] == source_id and a["requestUrl"] == url:
                if self._verified_bytes(a["storedBytes"]):
                    timestamp = now()
                    cache = dict(a, attemptId="pbc-cache-" + hashlib.sha256((a["attemptId"] + timestamp).encode()).hexdigest()[:24],
                                 attemptedAt=timestamp, httpStatus=None, outcome="CACHE_VERIFIED",
                                 reasonCode="COMPLETE_BYTES_HASH_SIZE_PATH_VERIFIED", verifiedAt=now(),
                                 acquisitionAttemptId=a["attemptId"], handlingBasis="Retain original network acquisition; reverified complete local bytes")
                    self._append({"attempt": cache, "contentType": row["contentType"]})
                    return row
                break
        result = None
        for retry in range(self.retries + 1):
            self._before_request()
            timestamp = now()
            attempt = dict(attemptId="pbc-get-" + hashlib.sha256((source_id + url + timestamp).encode()).hexdigest()[:24],
                           sourceId=source_id, requestUrl=url, finalUrl=None, attemptedAt=timestamp,
                           httpStatus=None, transportError=None, storedBytes=None, outcome="TRANSPORT_ERROR",
                           reasonCode="NETWORK_TRANSPORT_ERROR", candidateReleaseEventIds=[],
                           handlingBasis=("Bounded official-only HTTPS GET; retain complete response including failures"
                                          + ("; explicitly upgraded observed HTTP link scheme for this new physical request, same host/path/query"
                                             if discovered_url != url else "")),
                           verifiedAt=None, acquisitionAttemptId=None)
            body, content_type = None, ""
            try:
                request = Request(url, headers={"User-Agent": "investment-research-dashboard-pbc-historical/1.0", "Accept": "*/*"})
                try:
                    response = self.opener.open(request, timeout=self.timeout)
                except HTTPError as exc:
                    response = exc
                with response:
                    attempt["httpStatus"] = response.code
                    attempt["finalUrl"] = official_url(response.url)
                    content_type = response.headers.get("Content-Type", "application/octet-stream")
                    body = response.read()
                digest = hashlib.sha256(body).hexdigest()
                local_path = f"{RAW_DIRECTORY}/sha256/{digest}.bin"
                atomic_write_bytes(self.repo / local_path, body)
                attempt["storedBytes"] = dict(localPath=local_path, sha256=digest, byteSize=len(body))
                if not 200 <= attempt["httpStatus"] < 300:
                    attempt.update(outcome="HTTP_ERROR", reasonCode=f"HTTP_{attempt['httpStatus']}")
                elif reason := content_rejection(body, content_type):
                    attempt.update(outcome="CONTENT_REJECTED", reasonCode=reason)
                else:
                    attempt.update(outcome="SUCCESS", reasonCode="COMPLETE_RESPONSE_RETAINED")
            except (URLError, OSError, TimeoutError, ValueError, RuntimeError) as exc:
                # Avoid including proxy URLs, credentials or raw transport diagnostics.
                attempt.update(httpStatus=None, finalUrl=None, transportError=type(exc).__name__, storedBytes=None)
                if isinstance(exc, RuntimeError):
                    attempt["reasonCode"] = "REQUEST_BUDGET_EXHAUSTED"
            result = {"attempt": attempt, "contentType": content_type, "discoveredUrl": discovered_url}
            self._append(result)
            if attempt["outcome"] in ("SUCCESS", "CONTENT_REJECTED") or attempt["httpStatus"] in (400, 401, 403, 404, 410):
                break
        return result

    def html(self, row):
        a = row["attempt"]
        if a["outcome"] != "SUCCESS":
            return None
        return decode_html((self.repo / a["storedBytes"]["localPath"]).read_bytes(), row["contentType"])


def parse_index(html: str, page_url: str):
    """Keep individual anchor and following date bytes, and explicit paging markup."""
    entries = []
    for match in re.finditer(r'<a\b[^>]*href\s*=\s*["\']([^"\']+)["\'][^>]*>.*?</a>', html, re.I | re.S):
        href = unescape(match.group(1))
        try:
            url = official_url(urljoin(page_url, href))
        except ValueError:
            continue
        title = extract_html(match.group(0))[0]
        following = html[match.end():match.end() + 600]
        date = re.search(r"(?:19|20)\d{2}-\d{2}-\d{2}", following)
        # Do not associate a date after another link with the current item.
        if date and re.search(r"<a\b", following[:date.start()], re.I):
            date = None
        if not date and not re.search(r"金融(?:统计|运行)|货币供应|社会融资|统计数据|统计方法|统计口径", title):
            continue
        entries.append(dict(url=url, title=title, publicationDate=date.group(0) if date else None,
                            anchorHtml=match.group(0), entryHtml=match.group(0) + (following[:date.end()] if date else "")))
    pages = []
    for match in re.finditer(r'<a\b[^>]*(?:onclick|href|tagname)\s*=[^>]*>.*?</a>', html, re.I | re.S):
        paths = re.findall(r"[\"'](/[^\"']+-\d+\.html)[\"']", match.group(0))
        for path in paths:
            item = dict(url=official_url(urljoin(page_url, path)), text=extract_html(match.group(0))[0], markerHtml=match.group(0))
            if item not in pages:
                pages.append(item)
    totals = re.search(r'totalpage=["\'](\d+)["\']', html)
    return dict(entries=entries, pagination=pages, declaredTotalPages=int(totals.group(1)) if totals else None)


def discover(collector: Collector, roots: list[str]):
    pages, queue, seen = [], list(roots), set()
    while queue:
        url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        row = collector.fetch("PBC_STATISTICS_INDEX", url)
        html = collector.html(row)
        parsed = parse_index(html, row["attempt"]["finalUrl"]) if html else dict(entries=[], pagination=[], declaredTotalPages=None)
        pages.append(dict(url=url, acquisitionAttemptId=row["attempt"]["attemptId"], **parsed))
        # Follow only URLs literally present in the saved page, no generated pagination.
        for link in parsed["pagination"]:
            if link["text"] == "下一页" and link["url"] not in seen:
                queue.append(link["url"])
        # Checkpoint every enumerated page. Interruption/budget exhaustion retains
        # the incomplete inventory and pending literal URLs for an honest resume.
        checkpoint = dict(generatedAt=now(), pages=pages, pendingUrls=queue,
                          traversalFinished=not queue)
        atomic_write_bytes(collector.root / "discovery.json", (json.dumps(checkpoint, ensure_ascii=False, indent=2) + "\n").encode())
        print(json.dumps({"indexPages": len(pages), "url": url, "entries": len(parsed["entries"]), "outcome": row["attempt"]["outcome"]}), flush=True)
    return pages


def collect_statistical_tables(collector: Collector):
    """Enumerate current official tables as potential later-vintage evidence only.

    Table year, attachment filename and today's availability do not establish any
    historical release event. This inventory deliberately makes no PIT admission.
    """
    root_url = "https://www.pbc.gov.cn/diaochatongjisi/116219/116319/index.html"
    root_row = collector.fetch("PBC_STATISTICS_INDEX", root_url)
    root_html = collector.html(root_row)
    result = dict(rootUrl=root_url, rootAcquisitionAttemptId=root_row["attempt"]["attemptId"],
                  annualPages=[], categoryPages=[], completed=False, releaseIdentity="UNPROVEN_CURRENT_TABLES")
    if not root_html:
        return result
    links = extract_html(root_html)[1]
    years = {urljoin(root_url, url).rsplit("/", 1)[0] + "/": int(m.group(1))
             for url, title in links if (m := re.fullmatch(r"(\d{4})年统计数据", title))}
    categories = {}
    for url, title in links:
        if title not in ("社会融资规模", "货币统计概览"):
            continue
        url = official_url(urljoin(root_url, url))
        year = next((year for prefix, year in years.items() if url.startswith(prefix)), None)
        if year is not None and (2005 if title == "货币统计概览" else 2002) <= year <= 2026:
            categories[url] = (year, title)
    # Older navigation lists only the annual directory at the top level. Fetch
    # those literal annual links before deciding whether a table link is absent.
    for prefix, year in sorted(years.items()):
        if not 2002 <= year <= 2026:
            continue
        expected = {"社会融资规模"} | ({"货币统计概览"} if year >= 2005 else set())
        found = {title for candidate_year, title in categories.values() if candidate_year == year}
        if expected <= found:
            continue
        annual_url = prefix + "index.html"  # prefix is the exact observed index.html URL directory.
        row = collector.fetch("PBC_STATISTICS_INDEX", annual_url)
        html = collector.html(row)
        result["annualPages"].append(dict(url=annual_url, year=year, acquisitionAttemptId=row["attempt"]["attemptId"]))
        if html:
            for href, label in extract_html(html)[1]:
                if label in expected:
                    categories[official_url(urljoin(annual_url, href))] = (year, label)
            if year >= 2005 and "货币供应量" in html:
                categories[annual_url] = (year, f"{year}年统计数据")
    for url, (year, title) in sorted(categories.items()):
        row = collector.fetch("PBC_STATISTICS_INDEX", url)
        html = collector.html(row)
        page = dict(url=url, year=year, title=title, acquisitionAttemptId=row["attempt"]["attemptId"], tables=[])
        if html:
            blocks = [match.group(0) for match in re.finditer(r"<tr\b.*?</tr>", html, re.I | re.S)]
            blocks.extend(match.group(0) for match in re.finditer(r"<a\b[^>]*>.*?</a>", html, re.I | re.S)
                          if extract_html(match.group(0))[0] in ("货币供应量", "货币供应量表", "社会融资规模存量统计表"))
            seen_table_urls = set()
            for raw_row in blocks:
                text, row_links = extract_html(raw_row)
                kind = "PBC_AFRE_STOCK" if "社会融资规模存量" in text else "PBC_M2" if "货币供应量" in text else None
                if not kind:
                    continue
                for href, label in row_links:
                    target = official_url(urljoin(url, href))
                    if not re.search(r"\.(?:html?|xlsx?|pdf)(?:\?|$)", target, re.I):
                        continue
                    if target in seen_table_urls:
                        continue
                    seen_table_urls.add(target)
                    attachment = collector.fetch(kind, target)
                    page["tables"].append(dict(url=target, label=label, sourceId=kind, rowHtml=raw_row,
                                                acquisitionAttemptId=attachment["attempt"]["attemptId"]))
        result["categoryPages"].append(page)
        atomic_write_bytes(collector.root / "table-discovery.json", (json.dumps(result, ensure_ascii=False, indent=2) + "\n").encode())
        print(json.dumps({"tableYear": year, "category": title, "tables": len(page["tables"]), "outcome": row["attempt"]["outcome"]}, ensure_ascii=False), flush=True)
    result["completed"] = True
    atomic_write_bytes(collector.root / "table-discovery.json", (json.dumps(result, ensure_ascii=False, indent=2) + "\n").encode())
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--budget", type=int, default=900)
    parser.add_argument("--index-only", action="store_true")
    parser.add_argument("--root", action="append")
    parser.add_argument("--url", action="append", help="Explicit discovered official seed/attachment URL; skips index crawl")
    parser.add_argument("--source-id", choices=["PBC_M2", "PBC_AFRE_STOCK", "PBC_STATISTICS_INDEX"], default="PBC_M2")
    parser.add_argument("--tables-only", action="store_true", help="Enumerate explicitly linked current annual M2/AFRE tables without admitting their historical release identity")
    args = parser.parse_args()
    collector = Collector(args.repo_root, budget=args.budget)
    if args.tables_only:
        collect_statistical_tables(collector)
        return
    if args.url:
        for url in args.url:
            print(json.dumps(collector.fetch(args.source_id, url), ensure_ascii=False), flush=True)
        return
    pages = discover(collector, args.root or DEFAULT_ROOTS)
    discovery_path = collector.root / "discovery.json"
    atomic_write_bytes(discovery_path, (json.dumps({"generatedAt": now(), "pages": pages, "pendingUrls": [], "traversalFinished": True}, ensure_ascii=False, indent=2) + "\n").encode())
    if not args.index_only:
        candidates = {}
        for page in pages:
            for entry in page["entries"]:
                if re.search(r"金融(?:统计数据|运行|宏观调控)|社会融资规模存量|货币|信贷|人民币汇率|人民币贷款.*增加", entry["title"]):
                    candidates.setdefault(entry["url"], entry)
        boundary = re.compile(r"2011年(?:9月|10月|前三季度)|2017年金融|2018年(?:1月金融|7月.*存量|9月.*存量)|2019年(?:9月.*存量|社会融资规模存量)|2014年社会融资规模存量")
        ordered = sorted(candidates.items(), key=lambda item: (not bool(boundary.search(item[1]["title"])), item[0]))
        for i, (url, entry) in enumerate(ordered):
            row = collector.fetch("PBC_AFRE_STOCK" if "社会融资规模存量" in entry["title"] else "PBC_M2", url)
            print(json.dumps({"report": i + 1, "total": len(candidates), "title": entry["title"], "outcome": row["attempt"]["outcome"]}, ensure_ascii=False), flush=True)
    print(json.dumps({"discovery": discovery_path.relative_to(collector.repo).as_posix(), "networkRequests": collector.network_count}))


if __name__ == "__main__":
    main()
