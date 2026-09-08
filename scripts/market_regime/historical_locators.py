"""Structured Office addressing contract; source-specific Office parsers are external.

The core checks address semantics, format/container identity and the raw digest.
Content admission additionally requires an explicitly supplied, version-matched
replayer. A coordinate or a caller's stored text alone is never extraction proof.
"""
from __future__ import annotations

from io import BytesIO
from typing import Protocol
from zipfile import BadZipFile, ZipFile

from .hashing import sha256_bytes


class StructuredLocatorReplayer(Protocol):
    parser_version: str

    def replay(self, body: bytes, locator: dict) -> str:
        """Replay the row/column anchored rectangle, in row-major text order.

        cell is its top-left A1 address; rowSpan/columnSpan are rectangle extents,
        allowing original headers, unit and value to be located together. Resolve
        merged cells without duplication. Implementations must reject ambiguous
        coordinates, absent cached formula values and external links; they must
        not execute macros or evaluate formulas or synthesize labels/units.
        """


def validate_structured_locator(loc: dict, body: bytes) -> None:
    def check(condition, reason):
        if not condition:
            raise ValueError(reason)

    check(loc['artifactSha256'] == sha256_bytes(body), 'structured locator raw digest mismatch')
    fmt = loc['format']
    if fmt in ('XLS_OLE', 'XLSX'):
        check(loc['sheet'] is not None and loc['table'] is None and loc['cell'] is not None,
              'spreadsheet locator requires sheet/cell and no DOCX table')
        letters = loc['cell'].rstrip('0123456789')
        column = 0
        for character in letters:
            column = column * 26 + ord(character) - ord('A') + 1
        check(column == loc['column'] and int(loc['cell'][len(letters):]) == loc['row'],
              'cell A1 address conflicts with row/column')
        max_row, max_column = (65536, 256) if fmt == 'XLS_OLE' else (1048576, 16384)
        check(loc['row'] + loc['rowSpan'] - 1 <= max_row and loc['column'] + loc['columnSpan'] - 1 <= max_column,
              'spreadsheet address/span outside format bounds')
    else:
        check(loc['sheet'] is None and loc['cell'] is None and loc['table'] is not None,
              'DOCX locator requires table index and no spreadsheet sheet/cell')
    if fmt == 'XLS_OLE':
        check(body.startswith(bytes.fromhex('d0cf11e0a1b11ae1')) and loc['part'] is None,
              'XLS/OLE magic/part mismatch')
        return
    part = loc['part']
    check(isinstance(part, str) and '\\' not in part and ':' not in part
          and not part.startswith('/') and all(p not in ('', '.', '..') for p in part.split('/')),
          'unsafe OOXML part path')
    check((fmt == 'XLSX' and part.startswith('xl/worksheets/') and part.endswith('.xml'))
          or (fmt == 'DOCX_TABLE' and part == 'word/document.xml'), 'OOXML format/part mismatch')
    try:
        with ZipFile(BytesIO(body)) as archive:
            names = archive.namelist()
            check(len(names) == len(set(names)) and len(names) <= 10000, 'ambiguous/oversized OOXML directory')
            required = {'[Content_Types].xml', part, 'xl/workbook.xml' if fmt == 'XLSX' else 'word/document.xml'}
            check(required <= set(names), 'OOXML required part missing')
            check(not archive.getinfo(part).flag_bits & 1, 'encrypted OOXML part unsupported')
    except (BadZipFile, KeyError) as exc:
        raise ValueError('invalid OOXML container') from exc


def replay_structured_locator(loc: dict, body: bytes, replayers: dict[str, StructuredLocatorReplayer]) -> None:
    validate_structured_locator(loc, body)
    replayer = replayers.get(loc['parserVersion'])
    if replayer is None or replayer.parser_version != loc['parserVersion']:
        raise ValueError('STRUCTURED_LOCATOR_REPLAYER_REQUIRED: ' + loc['parserVersion'])
    if replayer.replay(body, loc) != loc['text']:
        raise ValueError('structured locator replay text mismatch')
