"""Synthetic, offline C1 format/layout evidence; no financing observations."""
from __future__ import annotations

import hashlib
import io
import json
import struct
import unittest
import zipfile

from scripts.market_regime.csrc_schema import (
    CsrcStructuredLocatorReplayer, OLE_MAGIC, VERSION, _biff_formulas, probe_bytes,
)

XLS_MIME = "application/vnd.ms-excel"
XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
NS_S = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def package(parts):
    sink = io.BytesIO()
    with zipfile.ZipFile(sink, "w", zipfile.ZIP_DEFLATED) as z:
        for name, text in parts.items():
            z.writestr(name, text)
    return sink.getvalue()


def xlsx(cells='<c r="A1" t="inlineStr"><is><t>境内A股实际筹资</t></is></c>', merges="", **extra):
    parts = {
        "[Content_Types].xml": '<Types><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
        "xl/workbook.xml": f'<workbook xmlns="{NS_S}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="发行" sheetId="1" r:id="r1"/></sheets><calcPr calcMode="manual"/></workbook>',
        "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>',
        "xl/worksheets/sheet1.xml": f'<worksheet xmlns="{NS_S}"><sheetData><row r="1">{cells}</row></sheetData>{merges}</worksheet>',
        **extra,
    }
    return package(parts)


def docx(rows=None, **extra):
    if rows is None:
        rows = '<w:tr><w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p><w:r><w:t>当月 / 单位：亿元</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>IPO实际筹资</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>0</w:t></w:r></w:p></w:tc></w:tr>'
    return package({
        "[Content_Types].xml": '<Types><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
        "word/document.xml": f'<w:document xmlns:w="{NS_W}"><w:body><w:p><w:r><w:t>合成测试，不是官方数据</w:t></w:r></w:p><w:tbl>{rows}</w:tbl></w:body></w:document>',
        **extra,
    })


def biff_record(code, body=b""):
    return struct.pack("<HH", code, len(body)) + body


def synthetic_ole(stream_name="Workbook", stream=None, date_serial=None, date_mode=0):
    """Small deterministic CFB with a regular 4096-byte stream; never official."""
    if stream is None:
        bof = lambda kind: biff_record(0x0809, struct.pack("<HHHHII", 0x0600, kind, 0x0DBB, 1997, 0x41, 6))
        eof = biff_record(0x000A)
        bounds = lambda offset: biff_record(0x0085, struct.pack("<IBBBB", offset, 0, 0, 5, 0) + b"Probe")
        globals_prefix = bof(5) + biff_record(0x0022, struct.pack("<H", date_mode))
        globals_prefix += biff_record(0x00E0, b"\0" * 20) + biff_record(0x00E0, struct.pack("<HH", 0, 14) + b"\0" * 16)
        globals_size = len(globals_prefix + bounds(0) + eof)
        formula = struct.pack("<HHH", 1, 1, 0) + struct.pack("<d", 0) + struct.pack("<HIH", 0, 0, 3) + b"\x1e\x00\x00"
        stream = globals_prefix + bounds(globals_size) + eof + bof(0x10)
        stream += biff_record(0x0200, struct.pack("<IIHHH", 0, 3, 0, 2, 0))
        label = "当月实际筹资 单位亿元".encode("utf-16le")
        stream += biff_record(0x0204, struct.pack("<HHHHB", 0, 0, 0, len(label) // 2, 1) + label)
        stream += biff_record(0x0203, struct.pack("<HHHd", 1, 0, 0, 0))
        stream += biff_record(0x0006, formula)
        if date_serial is not None:
            stream += biff_record(0x0203, struct.pack("<HHHd", 2, 0, 1, date_serial))
        stream += biff_record(0x00E5, struct.pack("<HHHHH", 1, 0, 0, 0, 1)) + eof
    free, end = 0xFFFFFFFF, 0xFFFFFFFE
    header = bytearray(512)
    header[:8] = OLE_MAGIC
    struct.pack_into("<HHHH", header, 24, 0x003E, 3, 0xFFFE, 9)
    struct.pack_into("<H", header, 32, 6)
    struct.pack_into("<IIIIIIIII", header, 40, 0, 1, 1, 0, 4096, end, 0, end, 0)
    struct.pack_into("<109I", header, 76, 0, *([free] * 108))
    fat = struct.pack("<128I", 0xFFFFFFFD, end, 3, 4, 5, 6, 7, 8, 9, end, *([free] * 118))
    def directory(name, kind, start, size, child=free):
        entry = bytearray(128)
        encoded = (name + "\0").encode("utf-16le")
        entry[:len(encoded)] = encoded
        struct.pack_into("<HBBIII", entry, 64, len(encoded), kind, 1, free, free, child)
        struct.pack_into("<IQ", entry, 116, start, size)
        return entry
    directory_bytes = directory("Root Entry", 5, end, 0, child=1) + directory(stream_name, 2, 2, 4096) + bytearray(256)
    return bytes(header) + fat + directory_bytes + stream.ljust(4096, b"\0")


def locator(body, **changes):
    return {"format": "XLSX", "artifactSha256": hashlib.sha256(body).hexdigest(), "parserVersion": VERSION,
            "part": "xl/worksheets/sheet1.xml", "sheet": "发行", "table": None,
            "cell": "A1", "row": 1, "column": 1, "rowSpan": 1, "columnSpan": 1, **changes}


class CsrcSchemaTests(unittest.TestCase):
    def test_xls_date_serial_retains_original_and_date_mode(self):
        result = probe_bytes(synthetic_ole(date_serial=38353), "https://www.csrc.gov.cn/test.xls", XLS_MIME)
        cell = next(c for c in result["sheets"][0]["cells"] if c["row"] == 3)
        self.assertEqual(cell["text"], "38353")
        self.assertEqual(cell["dateIso"], "2005-01-01")
        self.assertEqual(cell["dateMode"], 0)
        self.assertEqual(cell["numberFormatId"], 14)

    def test_xls_1900_phantom_date_is_not_silently_resolved(self):
        result = probe_bytes(synthetic_ole(date_serial=60), "https://www.csrc.gov.cn/test.xls", XLS_MIME)
        self.assertIn("EXCEL_1900_DATE_AMBIGUOUS", result["blockers"])

    def test_xls_actual_container_and_cached_formula_zero_are_not_constants(self):
        result = probe_bytes(synthetic_ole(), "https://www.csrc.gov.cn/test.xls", XLS_MIME)
        self.assertEqual(result["actualFormat"], "XLS")
        self.assertEqual(result["blockers"], [])
        sheet = result["sheets"][0]
        self.assertEqual(sheet["name"], "Probe")
        self.assertEqual(sheet["mergedCells"], [{"startRow": 1, "endRow": 1, "startColumn": 1, "endColumn": 2}])
        cells = {(c["row"], c["column"]): c for c in sheet["cells"]}
        self.assertEqual(cells[2, 1]["valueState"], "REPORTED_ZERO")
        self.assertIsNone(cells[2, 1]["formula"])
        self.assertEqual(cells[2, 2]["formula"]["tokensHex"], "1e0000")
        self.assertEqual(cells[2, 2]["cache"]["text"], "0")

    def test_word_ole_with_docx_extension_is_not_ooxml(self):
        result = probe_bytes(synthetic_ole("WordDocument", b"synthetic unsupported word stream"), "https://www.csrc.gov.cn/a.docx", DOCX_MIME)
        self.assertEqual(result["actualFormat"], "DOC_OLE")
        self.assertIn("EXTENSION_FORMAT_MISMATCH", result["blockers"])
        self.assertIn("MIME_FORMAT_MISMATCH", result["blockers"])
        self.assertIn("UNSUPPORTED_FORMAT", result["blockers"])

    def test_xlsx_schema_and_literal_units(self):
        result = probe_bytes(xlsx(), "https://www.csrc.gov.cn/a.xlsx", XLSX_MIME)
        self.assertEqual(result["blockers"], [])
        self.assertEqual(result["sheets"][0]["cells"][0]["text"], "境内A股实际筹资")
        self.assertEqual(result["calculationProperties"]["calcMode"], "manual")

    def test_real_docx_merged_header_and_zero_locator(self):
        result = probe_bytes(docx(), "https://www.csrc.gov.cn/a.docx", DOCX_MIME)
        self.assertEqual(result["actualFormat"], "DOCX")
        self.assertEqual(result["blockers"], [])
        table = result["tables"][0]
        self.assertEqual(table["columnCount"], 2)
        self.assertEqual(table["cells"][-1]["valueState"], "REPORTED_ZERO")
        self.assertEqual((table["cells"][-1]["row"], table["cells"][-1]["column"]), (2, 2))

    def test_blank_dash_and_zero_are_distinct_no_observations(self):
        cells = '<c r="A1" t="inlineStr"><is><t> </t></is></c><c r="B1" t="inlineStr"><is><t>—</t></is></c><c r="C1"><v>0</v></c>'
        result = probe_bytes(xlsx(cells), "https://www.csrc.gov.cn/a.xlsx", XLSX_MIME)
        self.assertEqual([c["valueState"] for c in result["sheets"][0]["cells"]], ["BLANK", "DASH", "REPORTED_ZERO"])
        self.assertNotIn("observations", result)

    def test_month_ytd_scope_text_preserved_without_mapping_or_subtraction(self):
        cells = ''.join(f'<c r="{c}1" t="inlineStr"><is><t>{t}</t></is></c>' for c, t in zip("ABCDE", ["本月", "本年累计", "境外H股", "债券", "再融资"]))
        result = probe_bytes(xlsx(cells), "https://www.csrc.gov.cn/a.xlsx", XLSX_MIME)
        self.assertEqual([c["text"] for c in result["sheets"][0]["cells"]], ["本月", "本年累计", "境外H股", "债券", "再融资"])
        self.assertNotIn("SUPPLY_REFINANCING", json.dumps(result))

    def test_wrong_extension_does_not_prevent_actual_structure_probe(self):
        result = probe_bytes(xlsx(), "https://www.csrc.gov.cn/a.docx", DOCX_MIME)
        self.assertEqual(result["actualFormat"], "XLSX")
        self.assertIn("EXTENSION_FORMAT_MISMATCH", result["blockers"])
        self.assertIn("MIME_FORMAT_MISMATCH", result["blockers"])
        self.assertEqual(len(result["sheets"]), 1)

    def test_corrupt_zip_and_ole_retain_failure(self):
        for body, fmt in [(b"PK\x03\x04broken", "CORRUPT_ZIP"), (OLE_MAGIC + b"broken", "CORRUPT_OLE"), (OLE_MAGIC + b"\0" * 1024, "CORRUPT_OLE")]:
            with self.subTest(fmt=fmt):
                result = probe_bytes(body, "https://www.csrc.gov.cn/a.xls", XLS_MIME)
                self.assertEqual(result["actualFormat"], fmt)
                self.assertTrue(result["blockers"])

    def test_html_renamed_xls_and_pdf_remain_unsupported(self):
        for body, fmt in [(b"<html>Access denied</html>", "HTML"), (b"%PDF-1.7\n", "PDF")]:
            result = probe_bytes(body, "https://www.csrc.gov.cn/a.xls", XLS_MIME)
            self.assertEqual(result["actualFormat"], fmt)
            self.assertIn("EXTENSION_FORMAT_MISMATCH", result["blockers"])

    def test_formula_without_cache_never_evaluates_or_fills_zero(self):
        result = probe_bytes(xlsx('<c r="A1"><f>1-1</f></c>'), "https://www.csrc.gov.cn/a.xlsx", XLSX_MIME)
        self.assertIn("FORMULA_CACHE_MISSING_OR_ERROR", result["blockers"])
        self.assertEqual(result["sheets"][0]["cells"][0]["text"], "")

    def test_formula_zero_cache_is_explicit_evidence(self):
        result = probe_bytes(xlsx('<c r="A1"><f>1-1</f><v>0</v></c>'), "https://www.csrc.gov.cn/a.xlsx", XLSX_MIME)
        cell = result["sheets"][0]["cells"][0]
        self.assertEqual(cell["cache"]["status"], "PRESENT_NOT_RECALCULATED")
        self.assertEqual(cell["formula"]["text"], "1-1")

    def test_nonfinite_or_nonnumeric_formula_cache_fails_closed(self):
        for raw in ("NaN", "Infinity", "bad"):
            result = probe_bytes(xlsx(f'<c r="A1"><f>1-1</f><v>{raw}</v></c>'), "https://www.csrc.gov.cn/a.xlsx", XLSX_MIME)
            self.assertIn("FORMULA_CACHE_MISSING_OR_ERROR", result["blockers"])

    def test_xlsx_duplicate_coordinate_is_ambiguous(self):
        result = probe_bytes(xlsx('<c r="A1"><v>1</v></c><c r="A1"><v>2</v></c>'), "https://www.csrc.gov.cn/a.xlsx", XLSX_MIME)
        self.assertIn("DUPLICATE_CELL_COORDINATE", result["blockers"])

    def test_xlsx_custom_number_format_is_preserved(self):
        body = xlsx('<c r="A1" s="0"><v>123</v></c>', **{"xl/styles.xml": f'<styleSheet xmlns="{NS_S}"><numFmts><numFmt numFmtId="165" formatCode="0.00&quot;亿元&quot;"/></numFmts><cellXfs><xf numFmtId="165"/></cellXfs></styleSheet>'})
        result = probe_bytes(body, "https://www.csrc.gov.cn/a.xlsx", XLSX_MIME)
        self.assertEqual(result["sheets"][0]["cells"][0]["numberFormat"], '0.00"亿元"')

    def test_external_links_and_macros_are_blocked_not_executed(self):
        result = probe_bytes(xlsx(**{"xl/vbaProject.bin": b"not executed", "_rels/.rels": '<Relationships><Relationship Id="rX" Target="https://example.invalid" TargetMode="External"/></Relationships>'}), "https://www.csrc.gov.cn/a.xlsx", XLSX_MIME)
        self.assertIn("MACRO_PRESENT_NOT_EXECUTED", result["blockers"])
        self.assertIn("EXTERNAL_RELATIONSHIP_NOT_EVALUATED", result["blockers"])

    def test_word_field_cache_is_not_assumed_valid(self):
        rows = '<w:tr><w:tc><w:fldSimple w:instr="=SUM(ABOVE)"><w:r><w:t>1</w:t></w:r></w:fldSimple></w:tc></w:tr>'
        result = probe_bytes(docx(rows), "https://www.csrc.gov.cn/a.docx", DOCX_MIME)
        self.assertIn("WORD_FIELD_CACHE_UNVERIFIED", result["blockers"])

    def test_xml_entities_are_rejected(self):
        result = probe_bytes(xlsx(**{"xl/workbook.xml": '<!DOCTYPE x [<!ENTITY e "bad">]><workbook/>'}), "https://www.csrc.gov.cn/a.xlsx", XLSX_MIME)
        self.assertIn("PARSER_FAILED", result["blockers"])

    def test_biff_formula_truncation_and_unsupported_version_fail_closed(self):
        for stream, version in [(biff_record(6, b"\0" * 21), 80), (biff_record(6, b"\0" * 22), 40), (struct.pack("<HH", 6, 20), 80)]:
            with self.assertRaises(ValueError):
                _biff_formulas(stream, 0, version)

    def test_signature_is_deterministic_for_same_bytes(self):
        body = xlsx()
        first = probe_bytes(body, "https://www.csrc.gov.cn/a.xlsx", XLSX_MIME)
        self.assertEqual(first, probe_bytes(body, "https://www.csrc.gov.cn/a.xlsx", XLSX_MIME))
        json.dumps(first, allow_nan=False)

    def test_replayer_anchors_raw_text_and_rejects_bad_digest(self):
        body = xlsx()
        replayer = CsrcStructuredLocatorReplayer()
        self.assertEqual(replayer.replay(body, locator(body)), "境内A股实际筹资")
        with self.assertRaises(ValueError):
            replayer.replay(body, locator(body, artifactSha256="0" * 64))

    def test_replayer_rejects_missing_cache_and_external_links(self):
        body = xlsx('<c r="A1"><f>1+1</f></c>')
        with self.assertRaises(ValueError):
            CsrcStructuredLocatorReplayer().replay(body, locator(body))

    def test_replayer_does_not_duplicate_merged_header(self):
        body = xlsx('<c r="A1" t="inlineStr"><is><t>单位亿元</t></is></c><c r="B1"/>', '<mergeCells><mergeCell ref="A1:B1"/></mergeCells>')
        replayer = CsrcStructuredLocatorReplayer()
        self.assertEqual(replayer.replay(body, locator(body, columnSpan=2)), "单位亿元")
        with self.assertRaises(ValueError):
            replayer.replay(body, locator(body))


if __name__ == "__main__":
    unittest.main()
