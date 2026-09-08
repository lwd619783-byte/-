"""PBC prose extraction only; release identity/admission belongs to the dataset builder.

Offsets address the UTF-8 encoding of the supplied, unmodified HTML. Unsupported
tables, images and ambiguous prose stay blockers, never inferred numeric rows.
"""
from __future__ import annotations

import re
from datetime import date
from decimal import Decimal
from html import unescape
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urlsplit

from .time_semantics import date_only_safe_available_at

PARSER_VERSION = "pbc-prose-r2b-v1.0.0"
M2_SOURCE = "PBOC_M2_OFFICIAL_RELEASE"
AFRE_SOURCE = "PBOC_AFRE_STOCK_OFFICIAL_RELEASE"
NUMBER = r"[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?"
M2_BALANCE = re.compile(rf"(?:广义货币(?:供应量)?\s*[（(]?\s*M2\s*[）)]?|M2)\s*(?:供应量)?\s*余额(?:为)?\s*(?P<value>{NUMBER})\s*(?P<unit>万亿元|亿元)")
AFRE_BALANCE = re.compile(rf"社会融资规模存量(?:余额)?(?:为|是)?\s*(?P<value>{NUMBER})\s*(?P<unit>万亿元|亿元)")
YOY = re.compile(rf"同比(?:增长|增速(?:为)?|上升|下降|减少)?\s*(?P<value>{NUMBER})\s*(?P<unit>[%％])")
M2_HISTORICAL_YOY = re.compile(rf"(?P<year>20\d{{2}})年(?:(?P<month>\d{{1,2}})月|(?P<annual>末))末?\s*M2(?:余额)?(?:同比增长|增速(?:为)?)\s*(?P<value>{NUMBER})\s*(?P<unit>[%％])")


class _MappedText(HTMLParser):
    """Keep an exact raw HTML span for every decoded visible character."""
    def __init__(self, html: str):
        super().__init__(convert_charrefs=False)
        self.html = html
        self.starts = [0]
        self.starts.extend(m.end() for m in re.finditer("\n", html))
        self.chars: list[str] = []
        self.spans: list[tuple[int, int]] = []
        self.hidden = 0
        self.feed(html)
        self.text = "".join(self.chars)

    def _offset(self) -> int:
        line, col = self.getpos()
        return self.starts[line - 1] + col

    def handle_starttag(self, tag: str, attrs: Any) -> None:
        if tag in ("script", "style"):
            self.hidden += 1
        if tag in ("p", "br", "div", "h1", "h2", "tr", "td", "li") and self.chars:
            self.chars.append("\u2029")
            self.spans.append((self._offset(), self._offset()))

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style"):
            self.hidden = max(0, self.hidden - 1)

    def handle_data(self, data: str) -> None:
        if not self.hidden:
            start = self._offset()
            for i, char in enumerate(data):
                self.chars.append(" " if char in "\r\n\t" else char)
                self.spans.append((start + i, start + i + 1))

    def handle_entityref(self, name: str) -> None:
        self._entity(f"&{name};")

    def handle_charref(self, name: str) -> None:
        self._entity(f"&#{name};")

    def _entity(self, raw: str) -> None:
        if not self.hidden:
            start = self._offset()
            for char in unescape(raw):
                self.chars.append(char)
                self.spans.append((start, start + len(raw)))

    def locator(self, start: int, end: int) -> dict[str, Any]:
        lo, hi = self.spans[start][0], self.spans[end - 1][1]
        raw = self.html[lo:hi]
        return {"byteOffset": len(self.html[:lo].encode("utf-8")),
                "byteLength": len(raw.encode("utf-8")), "text": raw}


def _publication(mapped: _MappedText) -> dict[str, Any]:
    text = mapped.text
    pattern = re.compile(r"(?:文章来源|发布时间|发布于|发布日期|日期)\s*[：:]\s*(20\d{2}[-/]\d{2}[-/]\d{2})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?")
    matches = list(pattern.finditer(text))
    signatures = {(m.group(1).replace("/", "-"), m.group(2)) for m in matches}
    if not signatures:
        raise ValueError("PUBLICATION_EVIDENCE_MISSING")
    if len(signatures) != 1:
        raise ValueError("PUBLICATION_EVIDENCE_CONFLICT")
    match = matches[0]
    day, instant = next(iter(signatures))
    date.fromisoformat(day)
    if instant:
        if len(instant) == 5:
            instant += ":00"
        from datetime import datetime
        stamp = f"{day}T{instant}+08:00"
        datetime.fromisoformat(stamp)
    else:
        stamp = None
    return {"publicationDateTime": stamp, "publicationDate": day,
            "releaseAvailableAt": stamp or date_only_safe_available_at(day),
            "releaseConfidenceClass": "EXACT_TIMESTAMP" if stamp else "DATE_ONLY_SAFE",
            "publicationEvidenceLocator": mapped.locator(match.start(), match.end())}


def _title(html: str, text: str, source: str) -> str:
    targets = ("社会融资规模存量", "金融统计") if source == AFRE_SOURCE else ("金融",)
    heading_candidates = []
    for tag in ("h1", "h2", "title"):
        for match in re.finditer(rf"<{tag}\b[^>]*>(.*?)</{tag}>", html, re.I | re.S):
            clean = re.sub(r"\s+", "", _MappedText(match.group(1)).text)
            if clean and len(clean) < 140:
                heading_candidates.append(clean)
            if any(target in clean for target in targets):
                return clean
    # Older official monetary releases have narrative headings without dates or 金融.
    if heading_candidates and (M2_BALANCE.search(text) if source == M2_SOURCE else AFRE_BALANCE.search(text)):
        return heading_candidates[0]
    # PBC's legacy layouts sometimes place the heading in an ordinary table cell.
    for line in text.splitlines():
        clean = re.sub(r"\s+", "", line)
        if any(target in clean for target in targets) and ("报告" in clean or "金融运行" in clean) and len(clean) < 140:
            return clean
    raise ValueError("REPORT_TITLE_MISSING")


def _title_period(title: str) -> str | None:
    explicit = re.search(r"(20\d{2})年(\d{1,2})月", title)
    if explicit:
        year, month = map(int, explicit.groups())
        if not 1 <= month <= 12:
            raise ValueError("INVALID_REPORT_MONTH")
        return f"{year}-{month:02d}"
    year = re.search(r"(20\d{2})年", title)
    if not year:
        return None
    for label, month in (("前三季度", 9), ("三季度", 9), ("上半年", 6), ("一季度", 3), ("第一季度", 3)):
        if label in title:
            return f"{year.group(1)}-{month:02d}"
    if re.search(r"20\d{2}年(?:全年)?(?:金融统计|社会融资规模存量)", title):
        return f"{year.group(1)}-12"
    return None


def _period_before(text: str, start: int, report_period: str | None, publication_date: str) -> str:
    # Read only the current sentence/paragraph, never a date in distant notes.
    boundary = max(text.rfind("。", 0, start), text.rfind("\u2029", 0, start), text.rfind("；", 0, start))
    prefix = text[boundary + 1:start]
    dates = list(re.finditer(r"(?:(20\d{2})年)?(\d{1,2})月末|(?:(20\d{2})年末)", prefix))
    if dates:
        found = dates[-1]
        if found.group(3):
            return found.group(3) + "-12"
        month = int(found.group(2))
        if not 1 <= month <= 12:
            raise ValueError("INVALID_FIELD_MONTH")
        if found.group(1):
            year = int(found.group(1))
        elif report_period:
            year = int(report_period[:4])
        else:
            pub_year, pub_month = map(int, publication_date.split("-")[:2])
            year = pub_year - (month > pub_month)
        return f"{year:04d}-{month:02d}"
    if re.search(r"上月|上年|去年|历史|回溯|追溯", prefix):
        raise ValueError("FIELD_PERIOD_AMBIGUOUS")
    annual = re.search(r"(20\d{2})年\s*$", prefix)
    if annual and report_period == annual.group(1) + "-12":
        return report_period
    if report_period and ("本期" in prefix or "月末" in prefix or "年末" in prefix):
        return report_period
    raise ValueError("FIELD_PERIOD_MISSING")


def definition_era(source_id: str, period: str) -> str:
    if source_id == M2_SOURCE:
        return ("M2_PRE_2011" if period < "2011-10" else "M2_2011" if period < "2018-01"
                else "M2_2018" if period < "2022-12" else "M2_2022_12")
    if source_id != AFRE_SOURCE:
        raise ValueError("UNSUPPORTED_SOURCE")
    for boundary, era in (("2018-07", "AFRE_2015"), ("2018-09", "AFRE_2018_07"),
                          ("2019-09", "AFRE_2018_09"), ("2019-12", "AFRE_2019_09"),
                          ("2023-01", "AFRE_2019_12")):
        if period < boundary:
            return era
    return "AFRE_2023_01"


def parse_pbc_release(html: str, source_url: str, *, source_id: str,
                      expected_period: str | None = None) -> dict[str, Any]:
    host = urlsplit(source_url).hostname or ""
    if not (host == "pbc.gov.cn" or host.endswith(".pbc.gov.cn")):
        raise ValueError("NON_PBC_SOURCE")
    if source_id not in (M2_SOURCE, AFRE_SOURCE):
        raise ValueError("UNSUPPORTED_SOURCE")
    mapped = _MappedText(html)
    text = mapped.text
    publication = _publication(mapped)
    title = _title(html, text, source_id)
    report_period = _title_period(title)
    if expected_period and report_period and report_period != expected_period:
        raise ValueError("TITLE_PERIOD_CONFLICT")
    rows: list[dict[str, Any]] = []
    alternatives: list[dict[str, Any]] = []
    blockers: list[str] = []
    notes = []
    for match in re.finditer(r"[^。\u2029]+[。]?", text):
        sentence = match.group().strip()
        if any(word in sentence for word in ("可比", "统计方法", "纳入", "口径", "完善", "初步", "追溯")):
            notes.append({"text": sentence, "locator": mapped.locator(match.start(), match.end())})
    # Scope changes can span several sentences: retaining only the sentence
    # containing 'statistics' would drop e-CNY's effective date or AFRE components.
    for match in re.finditer(r"<p\b[^>]*>.*?</p>", html, re.I | re.S):
        paragraph = re.sub(r"\s+", "", _MappedText(match.group()).text)
        if re.match(r"注\d*[:：]", paragraph) and any(token in paragraph for token in
                ("数字人民币", "纳入", "统计", "修订", "口径", "初步", "可比")):
            raw = match.group()
            notes.append({"text": paragraph, "locator": {
                "byteOffset": len(html[:match.start()].encode("utf-8")),
                "byteLength": len(raw.encode("utf-8")), "text": raw}})
    comparable_notes = [note for note in notes if ("同比" in note["text"] and "可比" in note["text"])
                        or ("M2" in note["text"] and "数据可比" in note["text"])
                        or (source_id == AFRE_SOURCE and "社会融资规模存量" in title
                            and "文中数据均按可比口径" in note["text"])]
    # A note about loans/deposits or AFRE flow cannot establish the stock/M2 basis.
    dedicated_stock_report = source_id == AFRE_SOURCE and "社会融资规模存量" in title
    comparable_notes = [note for note in comparable_notes if
                        ("M2" in note["text"] or "货币供应量" in note["text"] or
                         (source_id == AFRE_SOURCE and ("文内同比" in note["text"] or "存量" in note["text"]
                                                      or dedicated_stock_report))) ]
    provisional = bool(re.search(r"(?:当期|当月)数据为初步(?:统计)?数|初步统计", text))
    pattern = M2_BALANCE if source_id == M2_SOURCE else AFRE_BALANCE
    matches = list(pattern.finditer(text))
    if not matches:
        blockers.append("STOCK_FIELD_MISSING" if source_id == AFRE_SOURCE else "M2_FIELD_MISSING")

    def add_row(match: re.Match[str], period: str, start: int, end: int, *, yoy: bool,
                era: str, temporal_role: str, method: str) -> None:
        unit = match.group("unit")
        raw_value = match.group("value")
        if "," in raw_value:
            blockers.append(f"NUMERIC_LEXEME_UNSUPPORTED:{period}")
            return
        value = Decimal(raw_value.replace(",", ""))
        multiplier = Decimal("0.0001") if unit == "亿元" else Decimal(1)
        if yoy and re.search(r"同比(?:下降|减少)", match.group()) and value > 0:
            multiplier = Decimal(-1)
        locator = mapped.locator(start, end)
        field = "M2" if source_id == M2_SOURCE else "社会融资规模存量"
        if source_id == M2_SOURCE and field not in locator["text"] and "广义货币" in locator["text"]:
            # M<sub>2</sub> is explicit M2 in the parsed prose; retain the other
            # literal official field label without inventing bytes for its tag.
            field = "广义货币"
        if any(token not in locator["text"] for token in (field, unit, raw_value)):
            blockers.append(f"RAW_FIELD_LOCATOR_UNSUPPORTED:{period}")
            return
        metric = ("MACRO_M2" if source_id == M2_SOURCE else "MACRO_AFRE_STOCK") + ("_YOY" if yoy else "_BALANCE")
        comparable = bool(comparable_notes)
        rows.append({"valueDate": period, "metricId": metric, "value": float(value * multiplier),
                     "originalValue": float(value), "originalUnit": unit, "rawUnit": unit,
                     "rawFieldName": field, "rawValueText": raw_value,
                     "unit": "%" if yoy else "万亿元",
                     "conversionRule": "SIGNED_DECREASE" if multiplier == -1 else "YI_YUAN_TO_WAN_YI_YUAN" if multiplier != 1 else "IDENTITY",
                     "conversionMultiplier": float(multiplier),
                     "locator": locator, "originalText": text[start:end],
                     "reportedComparableBasis": comparable,
                     "comparabilityEvidence": comparable_notes[0]["locator"] if comparable else locator,
                     "definitionEra": era, "method": method, "temporalRole": temporal_role,
                     "periodSemantics": "YEAR_END" if period.endswith("-12") and "年末" in text[max(0, start - 30):end] else "MONTH",
                     "qualityStatus": "BACKCAST" if temporal_role == "BACKCAST" else "PROVISIONAL" if provisional else "VERIFIED"})

    consumed: list[tuple[int, int]] = []
    for match in matches:
        try:
            period = _period_before(text, match.start(), report_period, publication["publicationDate"])
        except ValueError as exc:
            blockers.append(str(exc))
            continue
        if report_period is None:
            report_period = period
        if expected_period and report_period != expected_period:
            raise ValueError("FIELD_PERIOD_CONFLICT")
        if period > report_period:
            blockers.append(f"FIELD_AFTER_REPORT_PERIOD:{period}")
            continue
        method_start = max(text.rfind("。", 0, match.start()), text.rfind("\u2029", 0, match.start()),
                           text.rfind("；", 0, match.start()))
        method_context = text[method_start + 1:match.start()]
        if source_id == M2_SOURCE and re.search(r"完善前|原方法", method_context):
            alternatives.append({"valueDate": period, "metricId": "MACRO_M2_BALANCE",
                                 "rawValueText": match.group("value"), "method": "M2_2011",
                                 "locator": mapped.locator(match.start(), match.end())})
            continue
        era = definition_era(source_id, period)
        role = "CURRENT"
        if period < report_period:
            role = "BACKCAST" if any(token in text[max(0, match.start() - 200):match.end()] for token in ("回溯", "追溯", "完善后", "可比口径")) else "UNRESOLVED"
            era = definition_era(source_id, report_period) + "_BACKCAST" if role == "BACKCAST" else era
        if source_id == AFRE_SOURCE and period < "2015-01":
            role = "BACKCAST"
        if role == "UNRESOLVED":
            blockers.append(f"HISTORICAL_METHOD_UNRESOLVED:{period}")
            continue
        add_row(match, period, match.start(), match.end(), yoy=False, era=era, temporal_role=role, method=era)
        # Stop at the next field, sentence, or paragraph; never borrow M1/component YoY.
        tail = text[match.end():]
        stop = re.search(r"[。；;\u2029]|狭义货币|社会融资规模|其中|M1|M0|对实体经济", tail)
        tail_end = match.end() + (stop.start() if stop else len(tail))
        yoy_matches = list(YOY.finditer(text, match.end(), tail_end))
        if len(yoy_matches) == 1:
            yoy_match = yoy_matches[0]
            add_row(yoy_match, period, match.start(), yoy_match.end(), yoy=True, era=era, temporal_role=role, method=era)
            consumed.append((match.start(), yoy_match.end()))
        elif len(yoy_matches) > 1:
            blockers.append(f"YOY_AMBIGUOUS:{period}")
        else:
            blockers.append(f"YOY_FIELD_MISSING:{period}")

    if source_id == M2_SOURCE:
        for match in M2_HISTORICAL_YOY.finditer(text):
            if any(start <= match.start() < end for start, end in consumed):
                continue
            period = f"{match.group('year')}-{int(match.group('month') or 12):02d}"
            context = text[max(0, match.start() - 300):match.start()]
            if re.search(r"(?:完善前|原方法)[^。]*$", context):
                alternatives.append({"valueDate": period, "metricId": "MACRO_M2_YOY",
                                     "rawValueText": match.group("value"), "method": "M2_2011",
                                     "locator": mapped.locator(match.start(), match.end())})
            elif report_period and period < report_period and "完善后" in context and "货币市场基金" in text:
                add_row(match, period, match.start(), match.end(), yoy=True, era="M2_2018_BACKCAST",
                        temporal_role="BACKCAST", method="M2_2018")
            elif report_period and period != report_period:
                blockers.append(f"HISTORICAL_METHOD_UNRESOLVED:{period}")
        # A method note may restate the current YoY without another balance.
        # Disagreement with the main field is unresolved, never first-match wins.
        for match in re.finditer(rf"本期M2(?:余额)?同比增长\s*(?P<value>{NUMBER})\s*[%％]", text):
            claimed = Decimal(match.group("value").replace(",", ""))
            current_yoy = [row for row in rows if row["metricId"] == "MACRO_M2_YOY"
                           and row["valueDate"] == report_period]
            if any(Decimal(str(row["value"])) != claimed for row in current_yoy):
                rows = [row for row in rows if row not in current_yoy]
                blockers.append(f"CURRENT_METHOD_YOY_CONFLICT:{report_period}")
    # Multiple prose claims for one cell are evidence of ambiguity, even if encountered later.
    groups: dict[tuple[str, str, str], list[dict[str, Any]]] = {}
    for row in rows:
        groups.setdefault((row["valueDate"], row["metricId"], row["method"]), []).append(row)
    accepted = []
    for key, group in groups.items():
        if len({row["value"] for row in group}) > 1:
            blockers.append(f"FIELD_VALUE_CONFLICT:{key[0]}:{key[1]}")
        else:
            accepted.append(group[0])
    return {"sourceId": source_id, "sourceUrl": source_url, "parserVersion": PARSER_VERSION,
            "title": title, "valueDate": report_period, **publication,
            "rows": sorted(accepted, key=lambda row: (row["valueDate"], row["metricId"])),
            "alternativeMethodRows": alternatives, "definitionNotes": notes,
            "blockers": sorted(set(blockers))}
