"""CSRC C1 byte/container and field-layout probe; never produces observations.

Coordinates are one based. Numeric cells and formula caches are raw evidence,
not admitted financing values. No formula, macro or external link is executed.
"""
from __future__ import annotations

import hashlib
import io
import json
import math
import posixpath
import re
import struct
import zipfile
from pathlib import PurePosixPath
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree as ET

VERSION = "csrc-schema-probe-v1"
OLE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
S = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
MAX_EXPANDED_BYTES = 64 * 1024 * 1024


def _xml(body):
    if b"<!DOCTYPE" in body.upper() or b"<!ENTITY" in body.upper():
        raise ValueError("XML_DTD_OR_ENTITY_FORBIDDEN")
    return ET.fromstring(body)


def _text(value):
    if isinstance(value, float):
        return format(value, ".15g") if math.isfinite(value) else str(value)
    return "" if value is None else str(value)


def _cell(row, column, text, raw_type="text", **extra):
    stripped = text.strip()
    state = "BLANK" if not stripped else "DASH" if re.fullmatch(r"[-—–－]+", stripped) else "REPORTED_ZERO" if re.fullmatch(r"[+-]?0+(?:\.0+)?", stripped) else "PRESENT"
    return {"row": row, "column": column, "text": text, "rawType": raw_type,
            "valueState": state, "formula": None, "cache": None, **extra}


def _finish(out):
    # Retain the layout and textual field labels, excluding changing amounts.
    layout = []
    for item in out["sheets"] + out["tables"]:
        layout.append({"name": item.get("name"), "index": item["index"],
                       "mergedCells": item["mergedCells"],
                       "labels": [[c["row"], c["column"], c["text"]]
                                  for c in item["cells"] if re.search(r"[A-Za-z\u3400-\u9fff]", c["text"]) and c["formula"] is None]})
    out["schemaSignature"] = hashlib.sha256(json.dumps(layout, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    out["blockers"] = sorted(set(out["blockers"]))
    out["probeStatus"] = "PARTIAL" if out["blockers"] else "PROBED"
    return out


def _coordinates(address):
    m = re.fullmatch(r"([A-Z]+)([1-9][0-9]*)", address)
    if not m:
        raise ValueError("INVALID_CELL_COORDINATE")
    column = 0
    for char in m[1]:
        column = column * 26 + ord(char) - 64
    return int(m[2]), column


def _xlsx(z, out):
    workbook = _xml(z.read("xl/workbook.xml"))
    rels = _xml(z.read("xl/_rels/workbook.xml.rels"))
    targets = {r.attrib["Id"]: r for r in rels}
    strings = []
    if "xl/sharedStrings.xml" in z.namelist():
        strings = ["".join(t.text or "" for t in list(n.findall(S + "t")) + list(n.findall(S + "r/" + S + "t")))
                   for n in _xml(z.read("xl/sharedStrings.xml")).findall(S + "si")]
    formats, styles = {}, []
    if "xl/styles.xml" in z.namelist():
        style_root = _xml(z.read("xl/styles.xml"))
        formats = {n.attrib["numFmtId"]: n.attrib["formatCode"] for n in style_root.findall(S + "numFmts/" + S + "numFmt")}
        styles = [n.get("numFmtId", "0") for n in style_root.findall(S + "cellXfs/" + S + "xf")]
    out["numberFormats"] = formats
    properties = workbook.find(S + "workbookPr")
    out["dateMode"] = 1 if properties is not None and properties.get("date1904") in ("1", "true") else 0
    for index, sheet in enumerate(workbook.findall(S + "sheets/" + S + "sheet"), 1):
        relation = targets[sheet.attrib[R + "id"]]
        if relation.get("TargetMode") == "External":
            out["blockers"].append("EXTERNAL_SHEET_RELATIONSHIP")
            continue
        target = relation.attrib["Target"]
        path = posixpath.normpath(target.lstrip("/") if target.startswith("/") else "xl/" + target)
        if not path.startswith("xl/") or "/../" in path:
            raise ValueError("UNSAFE_SHEET_RELATIONSHIP")
        root = _xml(z.read(path))
        cells = []
        for c in root.findall(".//" + S + "sheetData/" + S + "row/" + S + "c"):
            row, col = _coordinates(c.attrib["r"])
            kind = c.get("t", "n")
            v, f = c.find(S + "v"), c.find(S + "f")
            raw = v.text if v is not None and v.text is not None else ""
            if kind == "s":
                value = strings[int(raw)]
            elif kind == "inlineStr":
                value = "".join(t.text or "" for t in c.findall(".//" + S + "t"))
            else:
                value = raw
            style_index = int(c.get("s", "0"))
            format_id = styles[style_index] if styles and style_index < len(styles) else None
            item = _cell(row, col, value, kind, styleIndex=c.get("s"),
                         numberFormatId=format_id, numberFormat=formats.get(format_id))
            if f is not None:
                present = bool(raw) and kind != "e"
                if kind == "n" and present:
                    try:
                        present = math.isfinite(float(raw))
                    except ValueError:
                        present = False
                item["formula"] = {"kind": "OOXML", "text": f.text, "attributes": dict(f.attrib)}
                item["cache"] = {"status": "PRESENT_NOT_RECALCULATED" if present else "MISSING_OR_ERROR", "text": raw, "rawType": kind}
                if not present:
                    out["blockers"].append("FORMULA_CACHE_MISSING_OR_ERROR")
            cells.append(item)
        merges = [m.attrib["ref"] for m in root.findall(S + "mergeCells/" + S + "mergeCell")]
        if len({(c["row"], c["column"]) for c in cells}) != len(cells):
            out["blockers"].append("DUPLICATE_CELL_COORDINATE")
        out["sheets"].append({"index": index, "name": sheet.get("name"), "part": path,
                              "cells": cells, "mergedCells": merges,
                              "rowCount": max((c["row"] for c in cells), default=0),
                              "columnCount": max((c["column"] for c in cells), default=0)})
    out["calculationProperties"] = dict(workbook.find(S + "calcPr").attrib) if workbook.find(S + "calcPr") is not None else None


def _docx(z, out):
    root = _xml(z.read("word/document.xml"))
    out["paragraphs"] = ["".join(t.text or "" for t in p.findall(".//" + W + "t")) for p in root.findall(W + "body/" + W + "p")]
    for index, table in enumerate(root.findall(".//" + W + "tbl"), 1):
        cells, merges, active = [], [], {}
        for row, tr in enumerate(table.findall(W + "tr"), 1):
            before = tr.find(W + "trPr/" + W + "gridBefore")
            col = 1 + (int(before.get(W + "val", "0")) if before is not None else 0)
            for tc in tr.findall(W + "tc"):
                span_node = tc.find(W + "tcPr/" + W + "gridSpan")
                span = int(span_node.get(W + "val", "1")) if span_node is not None else 1
                vm = tc.find(W + "tcPr/" + W + "vMerge")
                vm_value = vm.get(W + "val", "continue") if vm is not None else None
                text = "\n".join("".join(t.text or "" for t in p.findall(".//" + W + "t")) for p in tc.findall(W + "p"))
                item = _cell(row, col, text, columnSpan=span, verticalMerge=vm_value)
                instructions = [n.text or "" for n in tc.findall(".//" + W + "instrText")]
                instructions += [n.get(W + "instr", "") for n in tc.findall(".//" + W + "fldSimple")]
                if instructions:
                    item["formula"] = {"kind": "WORD_FIELD", "instructions": instructions}
                    item["cache"] = {"status": "UNVERIFIED_DISPLAY_TEXT", "text": text}
                    out["blockers"].append("WORD_FIELD_CACHE_UNVERIFIED")
                cells.append(item)
                if vm_value == "continue":
                    if col not in active or active[col]["endColumn"] != col + span - 1:
                        out["blockers"].append("ORPHAN_VERTICAL_MERGE")
                    else:
                        active[col]["endRow"] = row
                else:
                    active.pop(col, None)
                    if span > 1 or vm_value == "restart":
                        merge = {"startRow": row, "endRow": row, "startColumn": col, "endColumn": col + span - 1}
                        merges.append(merge)
                        if vm_value == "restart":
                            active[col] = merge
                col += span
        out["tables"].append({"index": index, "name": None, "part": "word/document.xml", "cells": cells,
                              "mergedCells": merges, "rowCount": len(table.findall(W + "tr")),
                              "columnCount": max((c["column"] + c["columnSpan"] - 1 for c in cells), default=0)})


def _biff_formulas(stream, start, version):
    """Record formula tokens and the actual cache bytes without evaluating BIFF."""
    formulas = {}
    pos = start
    while pos + 4 <= len(stream):
        opcode, size = struct.unpack_from("<HH", stream, pos)
        end = pos + 4 + size
        if end > len(stream):
            raise ValueError("TRUNCATED_BIFF_RECORD")
        data = stream[pos + 4:end]
        if opcode in (0x0006, 0x0206, 0x0406):
            if version < 50 or len(data) < 22:
                raise ValueError("UNSUPPORTED_BIFF_FORMULA_LAYOUT")
            row, col = struct.unpack_from("<HH", data)
            flags, token_size = struct.unpack_from("<H", data, 14)[0], struct.unpack_from("<H", data, 20)[0]
            if 22 + token_size > len(data):
                raise ValueError("TRUNCATED_BIFF_FORMULA")
            formulas[row, col] = {"kind": "BIFF", "tokensHex": data[22:22 + token_size].hex(),
                                  "flags": flags, "rawCacheHex": data[6:14].hex()}
        pos = end
        if opcode == 0x000A:
            break
    return formulas


def _xls(body, out):
    try:
        import xlrd
    except ImportError:
        out["blockers"].append("XLRD_DEPENDENCY_UNAVAILABLE")
        return
    out["parserDependency"] = {"name": "xlrd", "version": xlrd.__version__}
    # on_demand preserves the BIFF stream while formula records are inspected.
    book = xlrd.open_workbook(file_contents=body, formatting_info=True, on_demand=True, logfile=io.StringIO())
    try:
        out["biffVersion"] = book.biff_version
        out["dateMode"] = book.datemode
        if any(kind != 1 for kind in book._supbook_types):
            out["blockers"].append("EXTERNAL_RELATIONSHIP_NOT_EVALUATED")
        for index in range(book.nsheets):
            sheet = book.sheet_by_index(index)
            formulas = _biff_formulas(book.mem, book._sh_abs_posn[index], book.biff_version)
            cells = []
            for row in range(sheet.nrows):
                for col in range(sheet.ncols):
                    c = sheet.cell(row, col)
                    # Preserve explicit blanks; absent rectangular padding has no cell record.
                    if c.ctype == xlrd.XL_CELL_EMPTY and (row, col) not in formulas:
                        continue
                    xf = book.xf_list[c.xf_index] if 0 <= c.xf_index < len(book.xf_list) else None
                    format_info = book.format_map.get(xf.format_key) if xf is not None else None
                    item = _cell(row + 1, col + 1, _text(c.value), str(c.ctype), styleIndex=c.xf_index,
                                 numberFormatId=xf.format_key if xf else None,
                                 numberFormat=format_info.format_str if format_info else None)
                    if c.ctype == xlrd.XL_CELL_DATE:
                        item["dateMode"] = book.datemode
                        if book.datemode == 0 and 1 <= c.value < 61:
                            item["dateIso"] = None
                            out["blockers"].append("EXCEL_1900_DATE_AMBIGUOUS")
                        else:
                            decoded = xlrd.xldate_as_datetime(c.value, book.datemode)
                            if 0 <= c.value < 1:
                                item["timeIso"] = decoded.time().isoformat()
                            else:
                                item["dateIso"] = decoded.date().isoformat()
                                item["dateTimeIso"] = decoded.isoformat()
                    if (row, col) in formulas:
                        item["formula"] = formulas[row, col]
                        present = c.ctype not in (xlrd.XL_CELL_ERROR, xlrd.XL_CELL_EMPTY, xlrd.XL_CELL_BLANK) and _text(c.value) != "" and not (isinstance(c.value, float) and not math.isfinite(c.value))
                        item["cache"] = {"status": "PRESENT_NOT_RECALCULATED" if present else "MISSING_OR_ERROR", "text": _text(c.value), "rawType": str(c.ctype)}
                        if not present:
                            out["blockers"].append("FORMULA_CACHE_MISSING_OR_ERROR")
                        if item["formula"]["flags"] & 3:
                            out["blockers"].append("FORMULA_RECALCULATION_REQUIRED")
                    cells.append(item)
            merges = [{"startRow": a + 1, "endRow": b, "startColumn": c + 1, "endColumn": d} for a, b, c, d in sheet.merged_cells]
            out["sheets"].append({"index": index + 1, "name": sheet.name, "cells": cells,
                                  "mergedCells": merges, "rowCount": sheet.nrows, "columnCount": sheet.ncols})
    finally:
        book.release_resources()


def _ole(body, out):
    try:
        from xlrd.compdoc import CompDoc
    except ImportError:
        out["actualFormat"] = "OLE_UNRESOLVED"
        out["blockers"].append("XLRD_DEPENDENCY_UNAVAILABLE")
        return
    container = CompDoc(body, logfile=io.StringIO())
    names = [entry.name for entry in container.dirlist if entry.etype in (1, 2)]
    out["containerEntries"] = names
    if any(n.lower() in ("vba", "macros", "_vba_project") for n in names):
        out["blockers"].append("MACRO_PRESENT_NOT_EXECUTED")
    if "WordDocument" in names:
        out["actualFormat"] = "DOC_OLE"
        out["blockers"].append("UNSUPPORTED_FORMAT")
    elif "Workbook" in names or "Book" in names:
        out["actualFormat"] = "XLS"
        _xls(body, out)
    else:
        out["actualFormat"] = "OLE_UNKNOWN"
        out["blockers"].append("UNSUPPORTED_FORMAT")


def probe_bytes(body: bytes, url: str, content_type: str) -> dict:
    """Probe actual bytes; mismatched filename/MIME remains a blocker."""
    extension = PurePosixPath(unquote(urlsplit(url).path)).suffix.lower()
    mime = content_type.split(";", 1)[0].strip().lower()
    out = {"parserVersion": VERSION, "actualFormat": "UNKNOWN", "extension": extension,
           "mime": mime, "magicHex": body[:16].hex(), "blockers": [], "sheets": [], "tables": [], "paragraphs": []}
    try:
        if body.startswith(OLE_MAGIC):
            if len(body) < 512:
                out["actualFormat"] = "CORRUPT_OLE"
                out["blockers"].append("CORRUPT_OLE")
            else:
                out["actualFormat"] = "CORRUPT_OLE"
                try:
                    _ole(body, out)
                except Exception as error:
                    out["blockers"].append("PARSER_FAILED")
                    out["error"] = type(error).__name__ + ": " + str(error)[:300]
        elif body.startswith(b"PK"):
            out["actualFormat"] = "CORRUPT_ZIP"
            with zipfile.ZipFile(io.BytesIO(body)) as z:
                names = z.namelist()
                if len(names) != len(set(names)) or len(names) > 10000 or sum(i.file_size for i in z.infolist()) > MAX_EXPANDED_BYTES:
                    raise ValueError("UNSAFE_ZIP_CONTAINER")
                if z.testzip() is not None:
                    raise ValueError("ZIP_CRC_FAILED")
                if "[Content_Types].xml" not in names:
                    out["actualFormat"] = "ZIP_UNKNOWN"
                    out["blockers"].append("OOXML_CONTENT_TYPES_MISSING")
                else:
                    types = _xml(z.read("[Content_Types].xml"))
                    declarations = {n.get("PartName"): n.get("ContentType", "") for n in types}
                    has_xls, has_doc = "xl/workbook.xml" in names, "word/document.xml" in names
                    if has_xls == has_doc:
                        out["actualFormat"] = "ZIP_UNKNOWN"
                        out["blockers"].append("OOXML_PACKAGE_AMBIGUOUS")
                    elif has_xls:
                        out["actualFormat"] = "XLSX"
                        if "spreadsheetml.sheet.main+xml" not in declarations.get("/xl/workbook.xml", ""):
                            out["blockers"].append("OOXML_MAIN_CONTENT_TYPE_MISMATCH")
                        _xlsx(z, out)
                    else:
                        out["actualFormat"] = "DOCX"
                        if "wordprocessingml.document.main+xml" not in declarations.get("/word/document.xml", ""):
                            out["blockers"].append("OOXML_MAIN_CONTENT_TYPE_MISMATCH")
                        _docx(z, out)
                if any("vbaproject" in n.lower() for n in names):
                    out["blockers"].append("MACRO_PRESENT_NOT_EXECUTED")
                for name in names:
                    if name.endswith(".rels") and any(n.get("TargetMode") == "External" for n in _xml(z.read(name))):
                        out["blockers"].append("EXTERNAL_RELATIONSHIP_NOT_EVALUATED")
        elif body.lstrip().startswith(b"%PDF-"):
            out["actualFormat"] = "PDF"
            out["blockers"].append("UNSUPPORTED_FORMAT")
        elif re.search(br"<(?:!doctype\s+html|html|head|body)\b", body[:1024], re.I):
            out["actualFormat"] = "HTML"
            out["blockers"].append("HTML_ATTACHMENT_UNSUPPORTED")
        else:
            out["blockers"].append("UNSUPPORTED_FORMAT")
    except Exception as error:
        out["blockers"].append("PARSER_FAILED")
        out["error"] = type(error).__name__ + ": " + str(error)[:300]
    expected = {"XLS": ".xls", "XLSX": ".xlsx", "DOCX": ".docx", "DOC_OLE": ".doc", "PDF": ".pdf", "HTML": ".html"}.get(out["actualFormat"])
    if expected and extension != expected:
        out["blockers"].append("EXTENSION_FORMAT_MISMATCH")
    accepted_mimes = {"XLS": {"application/vnd.ms-excel", "application/x-excel"},
                      "XLSX": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
                      "DOCX": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
                      "DOC_OLE": {"application/msword"},
                      "PDF": {"application/pdf"}, "HTML": {"text/html"}}
    if expected and mime not in accepted_mimes[out["actualFormat"]] | {"application/octet-stream", ""}:
        out["blockers"].append("MIME_FORMAT_MISMATCH")
    if not out["sheets"] and not out["tables"] and out["actualFormat"] in ("XLS", "XLSX", "DOCX"):
        out["blockers"].append("NO_TABLE_SCHEMA")
    return _finish(out)


class CsrcStructuredLocatorReplayer:
    """Opt-in implementation of the unchanged R2-A replayer protocol."""

    parser_version = VERSION

    def replay(self, body: bytes, locator: dict) -> str:
        from .historical_locators import validate_structured_locator

        validate_structured_locator(locator, body)
        expected = {"XLS_OLE": ("XLS", ".xls"), "XLSX": ("XLSX", ".xlsx"), "DOCX_TABLE": ("DOCX", ".docx")}
        fmt, extension = expected[locator["format"]]
        # This protocol proves byte/coordinate text only. Actual URL/MIME mismatch
        # is retained by probe_bytes and must separately block source admission.
        result = probe_bytes(body, "https://www.csrc.gov.cn/locator" + extension, "application/octet-stream")
        if result["actualFormat"] != fmt or result["blockers"]:
            raise ValueError("CSRC_STRUCTURED_PROBE_BLOCKED: " + ",".join(result["blockers"]))
        choices = [s for s in result["sheets"] if s["name"] == locator["sheet"]] if fmt != "DOCX" else [t for t in result["tables"] if t["index"] == locator["table"]]
        if len(choices) != 1:
            raise ValueError("AMBIGUOUS_OR_MISSING_SHEET_TABLE")
        chosen = choices[0]
        if fmt != "XLS" and chosen.get("part") != locator["part"]:
            raise ValueError("SHEET_PART_MISMATCH")
        start_row, start_col = locator["row"], locator["column"]
        end_row, end_col = start_row + locator["rowSpan"] - 1, start_col + locator["columnSpan"] - 1
        if end_row > chosen["rowCount"] or end_col > chosen["columnCount"]:
            raise ValueError("RECTANGLE_OUTSIDE_PROBED_SCHEMA")
        # A rectangle cutting a merged field cannot prove its full original text.
        merges = []
        for merge in chosen["mergedCells"]:
            if isinstance(merge, str):
                first, last = merge.split(":") if ":" in merge else (merge, merge)
                r1, c1 = _coordinates(first)
                r2, c2 = _coordinates(last)
            else:
                r1, c1, r2, c2 = (merge[k] for k in ("startRow", "startColumn", "endRow", "endColumn"))
            if r1 <= end_row and r2 >= start_row and c1 <= end_col and c2 >= start_col:
                if not (start_row <= r1 <= r2 <= end_row and start_col <= c1 <= c2 <= end_col):
                    raise ValueError("RECTANGLE_CUTS_MERGED_CELL")
                merges.append((r1, c1, r2, c2))
        cells = [c for c in chosen["cells"] if start_row <= c["row"] <= end_row and start_col <= c["column"] <= end_col]
        if len({(c["row"], c["column"]) for c in cells}) != len(cells):
            raise ValueError("DUPLICATE_CELL_COORDINATE")
        output = []
        for cell in sorted(cells, key=lambda c: (c["row"], c["column"])):
            subordinate = any(r1 <= cell["row"] <= r2 and c1 <= cell["column"] <= c2 and (cell["row"], cell["column"]) != (r1, c1) for r1, c1, r2, c2 in merges)
            if subordinate:
                if cell["text"].strip():
                    raise ValueError("MERGED_SUBORDINATE_CONTAINS_TEXT")
                continue
            if cell["text"]:
                output.append(cell["text"])
        return "\n".join(output)
