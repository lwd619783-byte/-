"""Conservative C1 field mappability; no financial calculations or observations."""
from __future__ import annotations

import hashlib
import json
import re


def clean(s):
    return re.sub(r"\s+", "", s).replace("（", "(").replace("）", ")")


def row_period(cell):
    """Only explicit native row labels. Numeric YYYY.MM requires two-place format."""
    text = clean(cell["text"])
    if "累计" in text or "年初至" in text or re.fullmatch(r"(?:19|20)\d{2}年1[-—－～](?:[1-9]|1[0-2])月", text):
        return None, "YTD"
    if cell.get("dateIso"):
        return cell["dateIso"][:7], "MONTH"
    compact = re.fullmatch(r"((?:19|20)\d{2})(0[1-9]|1[0-2])", text)
    if compact:
        return f"{compact[1]}-{compact[2]}", "MONTH"
    m = re.fullmatch(r"((?:19|20)\d{2})[年./-](\d{2}|[1-9])月?", text)
    if m:
        # A numeric 2015.1 is October only when the source number format says
        # YYYY.MM. A string 2015.1 is ambiguous and is not silently padded.
        month = m[2]
        if "." in text and len(month) == 1:
            fmt = cell.get("numberFormat", "") or ""
            if cell["rawType"] in ("2", "n") and re.fullmatch(r"0\.00(?:_.)?", fmt):
                month += "0"
            else:
                return None, "UNRESOLVED"
        if 1 <= int(month) <= 12:
            return f"{m[1]}-{int(month):02d}", "MONTH"
    return None, "UNRESOLVED"


def rectangle(merge):
    if isinstance(merge, dict):
        return merge["startRow"], merge["endRow"], merge["startColumn"], merge["endColumn"]
    def coord(a):
        m = re.fullmatch(r"([A-Z]+)([1-9]\d*)", a)
        col = 0
        for ch in m[1]:
            col = col * 26 + ord(ch) - 64
        return int(m[2]), col
    a, b = merge.split(":")
    r1, c1 = coord(a)
    r2, c2 = coord(b)
    return r1, r2, c1, c2


def locator(table, cell):
    return {"sheet": table.get("name"), "tableIndex": table["index"], "part": table.get("part"),
            "row": cell["row"], "column": cell["column"], "text": cell["text"]}


def field_map(probe, period):
    tables = []
    for table in probe["sheets"] + probe["tables"]:
        cells = table["cells"]
        starts = [c for c in cells if clean(c["text"]) in ("时间", "月份", "日期")]
        financing_headers = [c for c in cells if re.search(r"首发筹资|首次发行金额|首次公开发行|再筹资", c["text"])]
        if not financing_headers:
            continue
        if len(starts) > 1:
            continue
        axis_present = bool(starts)
        # A missing axis label is a blocker, not evidence that IPO itself is
        # absent. Use structural coordinates to inventory the real headers.
        start = starts[0] if starts else dict(row=min(c["row"] for c in financing_headers), column=1)
        labels = [c for c in cells if c["column"] == start["column"] and c["row"] > start["row"]]
        monthly = [(c, row_period(c)[0]) for c in labels if row_period(c)[1] == "MONTH"]
        cumulative = [c for c in labels if row_period(c)[1] == "YTD"]
        data_start = min((c["row"] for c, _ in monthly), default=table["rowCount"] + 1)
        headers = [c for c in cells if start["row"] <= c["row"] < data_start and c["text"].strip()
                   and re.search(r"[A-Za-z\u3400-\u9fff]", c["text"]) and not re.search(r"\d{4}年|累计", c["text"])]
        merges = [rectangle(m) for m in table["mergedCells"]]
        columns = []
        for col in range(start["column"] + 1, table["columnCount"] + 1):
            path = []
            for h in headers:
                rect = next((m for m in merges if m[0] == h["row"] and m[2] == h["column"]), None)
                if h["column"] == col or rect and rect[2] <= col <= rect[3]:
                    path.append(locator(table, h))
            if path:
                columns.append(dict(column=col, headerPath=path))
        rows = [c for c, p in monthly if p == period]
        notes = [locator(table, c) for c in cells if re.search(r"注[:：]|说明|统计范围|不含|包括|含北|现金|认购|批准|计划|非实际|境外|含B股", c["text"])]
        titles = [locator(table, c) for c in cells if c["row"] < start["row"] and c["text"].strip()]
        tables.append(dict(table=table, columns=columns, rows=rows, titles=titles, notes=notes, axisPresent=axis_present,
                           periodSemantics=sorted(({"MONTH"} if monthly else set()) | ({"YTD"} if cumulative else set())),
                           monthlyRows=[dict(locator=locator(table, c), period=p) for c, p in monthly],
                           ytdRows=[locator(table, c) for c in cumulative]))
    results = {}
    for metric in ("SUPPLY_IPO_FINANCING", "SUPPLY_REFINANCING"):
        candidates = []
        for item in tables:
            table = item["table"]
            for col in item["columns"]:
                text = " / ".join(clean(h["text"]) for h in col["headerPath"])
                if not re.search(r"首发筹资|首次发行金额|首次公开发行" if metric.endswith("IPO_FINANCING") else r"再筹资|再融资", text):
                    continue
                blockers = []
                if not item["axisPresent"]:
                    blockers.append("TIME_AXIS_HEADER_MISSING")
                if metric.endswith("IPO_FINANCING"):
                    if not re.search(r"(?:^|/)A股\(亿元\)", text.replace(" ", "")):
                        blockers.append("A_SHARE_RMB_SCOPE_NOT_PROVEN")
                    if re.search(r"B股|H股|境外|境内外|债|计划|批准|家数|数量", text):
                        blockers.append("MIXED_OR_NON_ACTUAL_FINANCING_SCOPE")
                    # Notes can override a superficially matching header. Never
                    # infer inclusion from other columns; only explicit clauses.
                    contextual = " ".join(clean(h["text"]) for h in item["notes"] + item["titles"])
                    if re.search(r"批准额度|计划金额|非实际筹资|(?:包括|含|包含)(?:B股|H股|境外|债券)|境内外混合", contextual):
                        blockers.append("NOTE_SCOPE_CONFLICT")
                else:
                    blockers.append("DEFINITION_UNRESOLVED_ACCOUNTING_MAP_REQUIRED")
                    if re.search(r"可转债|债|B股|H股|境外", text):
                        blockers.append("BOND_OR_OVERSEAS_SCOPE")
                if len(item["rows"]) != 1:
                    blockers.append("MONTH_ROW_MISSING_OR_AMBIGUOUS")
                cell = next((c for c in table["cells"] if len(item["rows"]) == 1 and c["row"] == item["rows"][0]["row"] and c["column"] == col["column"]), None)
                if cell is None or cell["valueState"] in ("BLANK", "DASH"):
                    blockers.append("FIELD_MISSING")
                elif not re.fullmatch(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)", cell["text"].strip()):
                    blockers.append("NON_NUMERIC_AMOUNT_TOKEN")
                elif cell.get("formula") and (not cell.get("cache") or cell["cache"]["status"] != "PRESENT_NOT_RECALCULATED"):
                    blockers.append("FORMULA_CACHE_UNVERIFIED")
                # C1 locates the cell but keeps bulk numeric text in ignored raw/probe.
                value_location = {k: v for k, v in locator(table, cell).items() if k != "text"} if cell else None
                candidates.append(dict(headerPath=col["headerPath"], rawUnit="亿元" if "亿元" in text and "美元" not in text else None,
                                       periodSemantics="MONTH" if len(item["rows"]) == 1 else "YTD" if item["periodSemantics"] == ["YTD"] else "UNRESOLVED",
                                       periodLocator=locator(table, item["rows"][0]) if len(item["rows"]) == 1 else None,
                                       valueLocator=value_location, valueState=cell["valueState"] if cell else "ABSENT",
                                       formulaPresent=bool(cell and cell.get("formula")), blockers=blockers))
        eligible = [c for c in candidates if not c["blockers"]]
        blockers = list(probe["blockers"])
        if not candidates:
            blockers.append("FIELD_MISSING" if probe["sheets"] or probe["tables"] else "SCHEMA_UNAVAILABLE")
        elif metric == "SUPPLY_REFINANCING":
            blockers.append("DEFINITION_UNRESOLVED_ACCOUNTING_MAP_REQUIRED")
        elif len(eligible) != 1:
            blockers.append("DEFINITION_UNRESOLVED" if len(eligible) > 1 else "NO_UNIQUE_MONTH_A_SHARE_AMOUNT")
        results[metric] = dict(status="FIELD_CONDITIONS_READY" if not blockers else "PARTIAL", blockers=sorted(set(blockers)),
                               candidates=candidates, definitionId=None, formalObservations=[])
    schema_tables = [dict(sheet=t["table"].get("name"), tableIndex=t["table"]["index"], titles=t["titles"],
                          headerColumns=t["columns"], notes=t["notes"], periodSemantics=t["periodSemantics"],
                          monthlyRows=t["monthlyRows"], ytdRows=t["ytdRows"], mergedCells=t["table"]["mergedCells"]) for t in tables]
    # Field era identity excludes report-specific dates/amounts but includes every
    # header coordinate, hierarchy and note. Never smooth away a scope break.
    shape = [{k: t[k] for k in ("sheet", "tableIndex", "headerColumns", "notes")} for t in schema_tables]
    signature = hashlib.sha256(json.dumps(shape, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return dict(fieldSchemaSignature=signature, tables=schema_tables, fields=results)


def disambiguate(attachments, period):
    candidates, rejected = [], []
    for a in attachments:
        named = a.get("namedPeriods", [])
        contents = a.get("contentReportPeriods", [])
        if named and named != [period] or contents and contents != [period]:
            rejected.append(dict(attemptId=a["attemptId"], reason="ATTACHMENT_PERIOD_CONFLICT", namedPeriods=named, contentReportPeriods=contents))
        else:
            candidates.append(a)
    # Equal bytes may be equivalent candidates, but all URL/acquisition identities
    # remain retained. Missing/failed bytes cannot establish equivalence.
    hashes = {a.get("sha256") for a in candidates}
    selected = len(candidates) > 0 and None not in hashes and len(hashes) == 1
    return dict(status="UNIQUE_BYTES_CANDIDATE" if selected else "DEFINITION_UNRESOLVED",
                candidateAttemptIds=[a["attemptId"] for a in candidates], rejected=rejected,
                selectedAttemptIds=[a["attemptId"] for a in candidates] if selected else [],
                basis="All candidates inspected; byte-equivalent URLs retained" if selected else "Missing or competing candidate bytes")
