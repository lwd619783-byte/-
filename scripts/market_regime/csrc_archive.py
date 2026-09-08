"""Enumerate the observed CSRC statistical archive API, retaining source lineage."""
from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path
from urllib.parse import urljoin

from .csrc_retrieval import Collector, dump, official, periods


def archive_template(html, script, base):
    """Interpret only the actual archived template; never execute remote JavaScript."""
    channel = re.search(r'<meta\s+name="channelid"\s+content="([a-f0-9]+)"', html)
    references = re.findall(r'<script[^>]*src=["\']([^"\']+)["\']', html)
    render = next((x for x in references if x.endswith("/render.js")), None)
    marker = "'/searchList/' + _id + '?_isAgg=true&_isJson=true&_pageSize=' + pageSize + '&_template=index&_rangeTimeGte=&_channelName=&page=' + curPage"
    if not channel or not render or marker not in script or 'page_size: 10' not in script:
        raise ValueError("ARCHIVE_TEMPLATE_UNSUPPORTED")
    if "$('meta[name=\"channelid\"]').attr('content')" not in script:
        raise ValueError("ARCHIVE_CHANNEL_BINDING_UNPROVEN")
    return dict(channelId=channel[1], pageSize=10, scriptUrl=official(urljoin(base, render)), templateEvidence=marker,
                channelEvidence=channel[0])


def parse_api(body, base, channel, page):
    payload = json.loads(body)
    data = payload["data"]
    if data["channelId"] != channel or data["page"] != page or data["rows"] != 10:
        raise ValueError("ARCHIVE_RESPONSE_BINDING_MISMATCH")
    if not isinstance(data["total"], int) or not 0 <= data["total"] <= 3000 or not isinstance(data["results"], list):
        raise ValueError("ARCHIVE_RESPONSE_SHAPE_UNSUPPORTED")
    expected = max(0, min(10, data["total"] - (page - 1) * 10))
    if len(data["results"]) != expected:
        raise ValueError("ARCHIVE_RESPONSE_COUNT_MISMATCH")
    entries = []
    for index, row in enumerate(data["results"]):
        title = row["title"]
        ps = periods(title)
        if not ps or not re.search(r"统计数据|证券市场月报", title) or re.search(r"\d{1,2}日|日报|周报", title):
            continue
        url = official(urljoin(base, row["url"]))
        date = row.get("publishedTimeStr", "")
        entries.append(dict(url=url, title=title, periods=ps, publicationDate=date[:10] if re.fullmatch(r"\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?", date) else None,
                            entryJsonLocator=f"$.data.results[{index}]", entryJson={k: row.get(k) for k in ("title", "url", "publishedTimeStr", "manuscriptId", "channelId", "channelCodeName")},
                            resourceCandidates=[{k: r.get(k) for k in ("fileName", "title", "filePath", "url", "type", "ispublished", "seqNum")} for r in row.get("resList", [])]))
    return dict(totalEntries=data["total"], responseEntries=len(data["results"]), entries=entries)


def validate_archive(c, archive):
    """Replay full raw navigation, official template, and every enumerated API page."""
    by_id = {row["attemptId"]: row for row in c.rows}

    def acquired(attempt_id):
        row = by_id[attempt_id]
        if row["outcome"] != "SUCCESS":
            raise ValueError("ARCHIVE_ACQUISITION_NOT_SUCCESS")
        official(row["requestUrl"])
        official(row["finalUrl"])
        return row, c.bytes(row)

    navigation = archive["navigation"]
    parent, parent_body = acquired(navigation["parentAttemptId"])
    root, root_body = acquired(navigation["attemptId"])
    if navigation["anchorHtml"] not in parent_body.decode("utf-8"):
        raise ValueError("ARCHIVE_NAVIGATION_ANCHOR_MISMATCH")
    anchor = re.search(r'href=["\']([^"\']+)["\']', navigation["anchorHtml"])
    if not anchor or official(urljoin(parent["finalUrl"], anchor[1])) != official(navigation["url"]) or root["requestUrl"] != official(navigation["url"]):
        raise ValueError("ARCHIVE_NAVIGATION_URL_MISMATCH")
    script, script_body = acquired(archive["scriptAttemptId"])
    template = archive_template(root_body.decode("utf-8"), script_body.decode("utf-8"), navigation["url"])
    if script["requestUrl"] != template["scriptUrl"] or any(archive.get(key) != value for key, value in template.items()):
        raise ValueError("ARCHIVE_TEMPLATE_EVIDENCE_MISMATCH")
    if archive["blockers"] or not archive["complete"] or not archive["pages"]:
        raise ValueError("ARCHIVE_ENUMERATION_INCOMPLETE")
    expected_total = archive["pages"][0]["totalEntries"]
    total_rows = 0
    for number, page in enumerate(archive["pages"], 1):
        row, body = acquired(page["attemptId"])
        request_url = official(urljoin(navigation["url"], f"/searchList/{template['channelId']}?_isAgg=true&_isJson=true&_pageSize=10&_template=index&_rangeTimeGte=&_channelName=&page={number}"))
        if page["page"] != number or page["url"] != request_url or row["requestUrl"] != request_url:
            raise ValueError("ARCHIVE_PAGE_REQUEST_MISMATCH")
        parsed = parse_api(body, navigation["url"], template["channelId"], number)
        if any(page.get(key) != value for key, value in parsed.items()) or parsed["totalEntries"] != expected_total:
            raise ValueError("ARCHIVE_PAGE_REPLAY_MISMATCH")
        total_rows += parsed["responseEntries"]
    if total_rows != expected_total or len(archive["pages"]) != math.ceil(expected_total / 10):
        raise ValueError("ARCHIVE_ENUMERATION_COUNT_MISMATCH")


def collect_archive(repo, *, navigation_name="archive-navigation.json", output_name="archive-discovery.json"):
    c = Collector(repo, budget=350)
    if Path(navigation_name).name != navigation_name or Path(output_name).name != output_name:
        raise ValueError("ARCHIVE_LOCAL_FILENAME_REQUIRED")
    navigation = json.loads((c.root / navigation_name).read_text(encoding="utf-8"))
    root = next(x for x in c.rows if x["attemptId"] == navigation["attemptId"])
    html = c.bytes(root).decode("utf-8")
    script_ref = next(x for x in re.findall(r'<script[^>]*src=["\']([^"\']+)["\']', html) if x.endswith("/render.js"))
    script_row = c.fetch(urljoin(navigation["url"], script_ref), "PAGINATION_SCRIPT")
    template = archive_template(html, c.bytes(script_row).decode("utf-8"), navigation["url"])
    result = dict(navigation=navigation, scriptAttemptId=script_row["attemptId"], **template, pages=[], complete=False, blockers=[])
    total_pages = 1
    page = 1
    while page <= total_pages:
        request_url = official(urljoin(navigation["url"], f"/searchList/{template['channelId']}?_isAgg=true&_isJson=true&_pageSize=10&_template=index&_rangeTimeGte=&_channelName=&page={page}"))
        response = c.fetch(request_url, "INDEX_API")
        try:
            if response["outcome"] != "SUCCESS":
                raise ValueError("ARCHIVE_API_ACQUISITION_FAILED")
            parsed = parse_api(c.bytes(response), navigation["url"], template["channelId"], page)
            if result["pages"] and parsed["totalEntries"] != result["pages"][0]["totalEntries"]:
                raise ValueError("ARCHIVE_TOTAL_CHANGED_DURING_ENUMERATION")
            total_pages = math.ceil(parsed["totalEntries"] / 10)
            result["pages"].append(dict(page=page, url=request_url, attemptId=response["attemptId"], **parsed))
        except (ValueError, KeyError, TypeError) as exc:
            result["blockers"].append(dict(page=page, attemptId=response["attemptId"], reason=str(exc)))
            break
        result["complete"] = page == total_pages
        dump(c.root / output_name, result)
        print(json.dumps(dict(archivePage=page, totalPages=total_pages, monthlyEntries=len(parsed["entries"]))), flush=True)
        page += 1
    dump(c.root / output_name, result)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])
    collect_archive(parser.parse_args().repo_root)
