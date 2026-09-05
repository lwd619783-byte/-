from __future__ import annotations

import math
import re
from calendar import monthrange
from datetime import date, datetime
from pathlib import Path, PurePosixPath
from typing import Any

from .catalog import derive_manifest
from .hashing import file_sha256
from .models import ParseStatus, QualityStatus, ReleaseConfidenceClass, SourceStatus
from .time_semantics import date_only_safe_available_at, parse_aware_datetime


SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
SAFE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]*$")
WINDOWS_ABSOLUTE_RE = re.compile(r"^[A-Za-z]:[\\/]")
RELEASE_CLASSES = {item.value for item in ReleaseConfidenceClass}
PARSE_STATUSES = {item.value for item in ParseStatus}
QUALITY_STATUSES = {item.value for item in QualityStatus}
SOURCE_STATUSES = {item.value for item in SourceStatus}
MISSING_QUALITY_STATUSES = {
    QualityStatus.MISSING.value,
    QualityStatus.STRUCTURALLY_UNAVAILABLE.value,
    QualityStatus.REJECTED.value,
}


def _required(record: dict[str, Any], fields: set[str], label: str, errors: list[str]) -> None:
    missing = sorted(field for field in fields if field not in record)
    if missing:
        errors.append(f"{label} 缺少字段: {', '.join(missing)}")


def _valid_id(value: Any) -> bool:
    return isinstance(value, str) and bool(SAFE_ID_RE.fullmatch(value))


def _parse_date(value: Any, field: str, errors: list[str]) -> date | None:
    if not isinstance(value, str):
        errors.append(f"{field} 必须是日期字符串")
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        errors.append(f"{field} 不是合法日期: {value}")
        return None


def _value_date_bounds(
    value: Any,
    field: str,
    errors: list[str],
) -> tuple[date, date] | None:
    if not isinstance(value, str):
        errors.append(f"{field} 必须是 YYYY-MM 或 YYYY-MM-DD")
        return None
    if re.fullmatch(r"\d{4}-\d{2}", value):
        year, month = map(int, value.split("-"))
        try:
            return date(year, month, 1), date(year, month, monthrange(year, month)[1])
        except ValueError:
            errors.append(f"{field} 不是合法月份: {value}")
            return None
    parsed = _parse_date(value, field, errors)
    return (parsed, parsed) if parsed is not None else None


def _aware(value: Any, field: str, errors: list[str]) -> datetime | None:
    try:
        return parse_aware_datetime(value, field)
    except ValueError as exc:
        errors.append(str(exc))
        return None


def _safe_relative_path(value: Any) -> bool:
    if not isinstance(value, str) or not value or WINDOWS_ABSOLUTE_RE.match(value):
        return False
    path = PurePosixPath(value.replace("\\", "/"))
    return not path.is_absolute() and ".." not in path.parts


def _duplicates(records: list[dict[str, Any]], field: str, label: str, errors: list[str]) -> None:
    seen: set[str] = set()
    for item in records:
        value = item.get(field)
        if not isinstance(value, str):
            continue
        if value in seen:
            errors.append(f"{label} 重复: {value}")
        seen.add(value)


def _record_collections(catalog: dict[str, Any], errors: list[str]) -> dict[str, list[dict[str, Any]]]:
    """返回只读校验视图；坏输入只记录错误，绝不改写调用方对象。"""
    collections: dict[str, list[dict[str, Any]]] = {}
    for name in (
        "sourceDefinitions", "artifacts", "observations", "marketScopeVersions",
        "exchangeMarketObservations", "providerSlots",
    ):
        value = catalog.get(name)
        if not isinstance(value, list):
            errors.append(f"catalog.{name} 必须是 array")
            collections[name] = []
            continue
        records: list[dict[str, Any]] = []
        for offset, item in enumerate(value):
            if not isinstance(item, dict):
                errors.append(f"catalog.{name}[{offset}] 必须是 object")
                continue
            records.append(item)
        collections[name] = records
    return collections


def _validate_source_definitions(
    definitions: list[dict[str, Any]], errors: list[str]
) -> dict[str, dict[str, Any]]:
    required = {
        "sourceDefinitionId", "sourceId", "metricId", "version", "effectiveFrom",
        "effectiveTo", "definitionSummary", "unit", "nativeFrequency",
        "releaseSemantics", "revisionPolicy", "sourceUrlPattern", "createdAt",
    }
    _duplicates(definitions, "sourceDefinitionId", "sourceDefinitionId", errors)
    index: dict[str, dict[str, Any]] = {}
    for offset, item in enumerate(definitions):
        label = f"sourceDefinitions[{offset}]"
        _required(item, required, label, errors)
        identity = item.get("sourceDefinitionId")
        if not _valid_id(identity):
            errors.append(f"{label}.sourceDefinitionId 非法")
        elif identity not in index:
            index[identity] = item
        for field in ("sourceId", "metricId", "version", "definitionSummary", "unit", "nativeFrequency", "releaseSemantics", "revisionPolicy", "sourceUrlPattern"):
            if not isinstance(item.get(field), str) or not item[field].strip():
                errors.append(f"{label}.{field} 不能为空")
        start = _parse_date(item.get("effectiveFrom"), f"{label}.effectiveFrom", errors)
        end_raw = item.get("effectiveTo")
        end = _parse_date(end_raw, f"{label}.effectiveTo", errors) if end_raw is not None else None
        if start and end and end < start:
            errors.append(f"{label}.effectiveTo 早于 effectiveFrom")
        _aware(item.get("createdAt"), f"{label}.createdAt", errors)
    return index


def _validate_artifacts(
    artifacts: list[dict[str, Any]],
    errors: list[str],
    *,
    artifact_root: Path | None,
    verify_artifacts: bool,
) -> dict[str, dict[str, Any]]:
    required = {
        "artifactId", "sourceId", "sourceUrl", "publicationDateTime", "publicationDate",
        "releaseAvailableAt", "fetchedAt", "contentType", "fileName", "sha256", "byteSize", "httpStatus",
        "releaseConfidenceClass", "artifactRole", "localPath", "parseStatus", "error",
    }
    _duplicates(artifacts, "artifactId", "artifactId", errors)
    index: dict[str, dict[str, Any]] = {}
    for offset, item in enumerate(artifacts):
        label = f"artifacts[{offset}]"
        _required(item, required, label, errors)
        identity = item.get("artifactId")
        if not _valid_id(identity):
            errors.append(f"{label}.artifactId 非法")
        elif identity not in index:
            index[identity] = item
        for field in ("sourceId", "sourceUrl", "contentType", "fileName"):
            if not isinstance(item.get(field), str) or not item[field].strip():
                errors.append(f"{label}.{field} 不能为空")
        publication_raw = item.get("publicationDateTime")
        publication = (
            _aware(publication_raw, f"{label}.publicationDateTime", errors)
            if publication_raw is not None
            else None
        )
        publication_date_raw = item.get("publicationDate")
        publication_date = (
            _parse_date(publication_date_raw, f"{label}.publicationDate", errors)
            if publication_date_raw is not None
            else None
        )
        available_raw = item.get("releaseAvailableAt")
        available = _aware(available_raw, f"{label}.releaseAvailableAt", errors)
        fetched = _aware(item.get("fetchedAt"), f"{label}.fetchedAt", errors)
        if not isinstance(item.get("sha256"), str) or not SHA256_RE.fullmatch(item["sha256"]):
            errors.append(f"{label}.sha256 必须是小写 SHA-256")
        if not isinstance(item.get("byteSize"), int) or isinstance(item.get("byteSize"), bool) or item.get("byteSize", -1) < 0:
            errors.append(f"{label}.byteSize 必须是非负整数")
        status = item.get("httpStatus")
        if not isinstance(status, int) or isinstance(status, bool):
            errors.append(f"{label}.httpStatus 必须是整数")
        elif not 200 <= status < 300:
            errors.append(f"{label} 不是成功下载；失败抓取不得进入 artifact catalog")
        confidence = item.get("releaseConfidenceClass")
        if confidence not in RELEASE_CLASSES:
            errors.append(f"{label}.releaseConfidenceClass 非法")
        if publication and publication_date and publication.date() != publication_date:
            errors.append(f"{label}.publicationDate 与 publicationDateTime 日期不一致")
        if confidence == ReleaseConfidenceClass.EXACT_TIMESTAMP.value:
            if publication is None:
                errors.append(f"{label} EXACT_TIMESTAMP 必须提供 publicationDateTime")
            elif available_raw != publication_raw:
                errors.append(f"{label} EXACT_TIMESTAMP 的 releaseAvailableAt 必须等于 publicationDateTime")
        elif confidence == ReleaseConfidenceClass.DATE_ONLY_SAFE.value:
            if publication is not None:
                errors.append(f"{label} DATE_ONLY_SAFE 的 publicationDateTime 必须为 null")
            if publication_date is None:
                errors.append(f"{label} DATE_ONLY_SAFE 必须提供 publicationDate")
            else:
                expected = date_only_safe_available_at(str(publication_date_raw))
                if available_raw != expected:
                    errors.append(f"{label} DATE_ONLY_SAFE 必须使用发布日次日 00:00 Asia/Shanghai")
        elif confidence == ReleaseConfidenceClass.BACKCAST_RELEASED_LATER.value:
            if publication is not None:
                if available_raw != publication_raw:
                    errors.append(f"{label} BACKCAST_RELEASED_LATER 必须使用实际 backcast publication timestamp")
            elif publication_date is not None:
                expected = date_only_safe_available_at(str(publication_date_raw))
                if available_raw != expected:
                    errors.append(f"{label} BACKCAST_RELEASED_LATER 日期级发布必须使用次日安全时间")
            else:
                errors.append(f"{label} BACKCAST_RELEASED_LATER 缺少实际发布日期证据")
        if fetched and available and fetched < available:
            errors.append(f"{label}.fetchedAt 早于 releaseAvailableAt")
        if item.get("artifactRole") not in {"RAW_SOURCE", "TEST_FIXTURE_EXCERPT"}:
            errors.append(f"{label}.artifactRole 非法")
        if item.get("parseStatus") not in PARSE_STATUSES:
            errors.append(f"{label}.parseStatus 非法")
        if item.get("parseStatus") == ParseStatus.FAILED.value and not item.get("error"):
            errors.append(f"{label} FAILED 必须提供 error")
        if item.get("parseStatus") != ParseStatus.FAILED.value and item.get("error") is not None:
            errors.append(f"{label} 非 FAILED artifact 不得携带 error")
        local_path = item.get("localPath")
        if not _safe_relative_path(local_path):
            errors.append(f"{label}.localPath 必须是安全相对路径")
        elif verify_artifacts:
            if artifact_root is None:
                errors.append("verify_artifacts=true 时必须提供 artifact_root")
            else:
                target = artifact_root / PurePosixPath(local_path)
                if not target.is_file():
                    errors.append(f"{label}.localPath 文件不存在: {local_path}")
                else:
                    if target.stat().st_size != item.get("byteSize"):
                        errors.append(f"{label}.byteSize 与本地文件不一致")
                    if file_sha256(target) != item.get("sha256"):
                        errors.append(f"{label}.sha256 与本地文件不一致")
    return index


def _validate_observations(
    observations: list[dict[str, Any]],
    definitions: dict[str, dict[str, Any]],
    artifacts: dict[str, dict[str, Any]],
    errors: list[str],
) -> dict[str, dict[str, Any]]:
    required = {
        "observationId", "metricId", "valueDate", "releaseDateTime",
        "releaseAvailableAt", "fetchedAt", "value", "unit", "sourceId",
        "sourceDefinitionId", "revisionSequence", "supersedesObservationId",
        "releaseConfidenceClass", "qualityStatus", "rawArtifactId",
        "transformVersion", "metadata",
    }
    _duplicates(observations, "observationId", "observationId", errors)
    index: dict[str, dict[str, Any]] = {}
    for offset, item in enumerate(observations):
        label = f"observations[{offset}]"
        _required(item, required, label, errors)
        identity = item.get("observationId")
        if not _valid_id(identity):
            errors.append(f"{label}.observationId 非法")
        elif identity not in index:
            index[identity] = item
        for field in ("metricId", "unit", "sourceId", "sourceDefinitionId", "rawArtifactId", "transformVersion"):
            if not isinstance(item.get(field), str) or not item[field].strip():
                errors.append(f"{label}.{field} 不能为空")
        value = item.get("value")
        if isinstance(value, bool) or (value is not None and not isinstance(value, (int, float))):
            errors.append(f"{label}.value 必须是数值或 null")
        if isinstance(value, float) and not math.isfinite(value):
            errors.append(f"{label}.value 不允许 NaN/Infinity")
        quality = item.get("qualityStatus")
        if quality not in QUALITY_STATUSES:
            errors.append(f"{label}.qualityStatus 非法")
        if quality in MISSING_QUALITY_STATUSES:
            errors.append(f"{label} 缺失/结构性不可用状态不得伪装成 observation；尤其不得用 0 代替 missing")
        elif value is None:
            errors.append(f"{label}.value 缺失；缺失数据不得生成数值 observation")
        confidence = item.get("releaseConfidenceClass")
        if confidence not in RELEASE_CLASSES:
            errors.append(f"{label}.releaseConfidenceClass 非法")
        value_period = _value_date_bounds(item.get("valueDate"), f"{label}.valueDate", errors)
        available = _aware(item.get("releaseAvailableAt"), f"{label}.releaseAvailableAt", errors)
        fetched = _aware(item.get("fetchedAt"), f"{label}.fetchedAt", errors)
        publication = item.get("releaseDateTime")
        release = _aware(publication, f"{label}.releaseDateTime", errors) if publication is not None else None
        metadata = item.get("metadata")
        if not isinstance(metadata, dict):
            errors.append(f"{label}.metadata 必须是 object")
            metadata = {}
        if confidence == ReleaseConfidenceClass.EXACT_TIMESTAMP.value and release is None:
            errors.append(f"{label} EXACT_TIMESTAMP 必须提供 releaseDateTime")
        if confidence == ReleaseConfidenceClass.DATE_ONLY_SAFE.value:
            publication_date = metadata.get("publicationDate")
            if publication is not None:
                errors.append(f"{label} DATE_ONLY_SAFE 的 releaseDateTime 应为 null，原始日期放 metadata.publicationDate")
            try:
                expected = date_only_safe_available_at(publication_date)
                if item.get("releaseAvailableAt") != expected:
                    errors.append(f"{label} DATE_ONLY_SAFE 必须使用发布日次日 00:00 Asia/Shanghai")
            except ValueError as exc:
                errors.append(f"{label}.{exc}")
        if release and available and available < release:
            errors.append(f"{label}.releaseAvailableAt 早于 releaseDateTime")
        if fetched and available and fetched < available:
            errors.append(f"{label}.fetchedAt 早于 releaseAvailableAt")
        if value_period and available and value_period[1] > available.date():
            errors.append(f"{label}.valueDate 晚于 releaseAvailableAt，时间语义倒置")
        sequence = item.get("revisionSequence")
        if not isinstance(sequence, int) or isinstance(sequence, bool) or sequence < 0:
            errors.append(f"{label}.revisionSequence 必须是非负整数")
        supersedes = item.get("supersedesObservationId")
        if supersedes is not None and (not isinstance(supersedes, str) or not supersedes):
            errors.append(f"{label}.supersedesObservationId 必须为 null 或非空字符串")
        if supersedes == identity:
            errors.append(f"{label}.supersedesObservationId 不得自引用")
        definition = definitions.get(str(item.get("sourceDefinitionId")))
        if definition is None:
            errors.append(f"{label}.sourceDefinitionId 不存在")
        else:
            if definition.get("sourceId") != item.get("sourceId"):
                errors.append(f"{label} sourceId 与 source definition 不一致")
            if definition.get("metricId") != item.get("metricId"):
                errors.append(f"{label} metricId 与 source definition 不一致")
            if definition.get("unit") != item.get("unit"):
                errors.append(f"{label} unit 与 source definition 不一致")
            if value_period is not None:
                try:
                    definition_start = date.fromisoformat(str(definition.get("effectiveFrom")))
                    definition_end = (
                        date.fromisoformat(str(definition["effectiveTo"]))
                        if definition.get("effectiveTo") is not None
                        else None
                    )
                except ValueError:
                    # definition 自身的格式错误已由 _validate_source_definitions 报告。
                    pass
                else:
                    period_start, period_end = value_period
                    if period_start < definition_start or (
                        definition_end is not None and period_end > definition_end
                    ):
                        errors.append(
                            f"{label}.valueDate 不在 source definition 的统计期有效范围内"
                        )
        artifact = artifacts.get(str(item.get("rawArtifactId")))
        if artifact is None:
            errors.append(f"{label}.rawArtifactId 不存在")
        else:
            if artifact.get("sourceId") != item.get("sourceId"):
                errors.append(f"{label} sourceId 与 raw artifact 不一致")
            if artifact.get("releaseConfidenceClass") != confidence:
                errors.append(f"{label}.releaseConfidenceClass 与 raw artifact 不一致")
            if artifact.get("publicationDateTime") != publication:
                errors.append(f"{label}.releaseDateTime 与 raw artifact publicationDateTime 不一致")
            if artifact.get("releaseAvailableAt") != item.get("releaseAvailableAt"):
                errors.append(f"{label}.releaseAvailableAt 与 raw artifact 不一致")
            if confidence == ReleaseConfidenceClass.DATE_ONLY_SAFE.value:
                if artifact.get("publicationDate") != metadata.get("publicationDate"):
                    errors.append(f"{label}.metadata.publicationDate 与 raw artifact 不一致")
            try:
                artifact_fetched = parse_aware_datetime(
                    artifact["fetchedAt"], "artifact.fetchedAt"
                )
                if fetched and fetched < artifact_fetched:
                    errors.append(f"{label}.fetchedAt 早于 raw artifact fetchedAt")
            except (KeyError, ValueError):
                # artifact 自身的时间错误已由 _validate_artifacts 报告。
                pass

    for identity, item in index.items():
        supersedes = item.get("supersedesObservationId")
        if supersedes is None:
            continue
        previous = index.get(supersedes)
        if previous is None:
            errors.append(f"observation {identity} 的 supersedesObservationId 不存在")
            continue
        if item.get("metricId") != previous.get("metricId") or item.get("valueDate") != previous.get("valueDate"):
            errors.append(f"observation {identity} 的 revision 链跨越 metricId/valueDate")
        if isinstance(item.get("revisionSequence"), int) and isinstance(previous.get("revisionSequence"), int) and item["revisionSequence"] <= previous["revisionSequence"]:
            errors.append(f"observation {identity} 的 revisionSequence 未递增")
        try:
            current_release = parse_aware_datetime(item["releaseAvailableAt"], "releaseAvailableAt")
            previous_release = parse_aware_datetime(previous["releaseAvailableAt"], "releaseAvailableAt")
            if current_release < previous_release:
                errors.append(f"observation {identity} 的修订发布时间早于被替代版本")
        except (KeyError, ValueError):
            pass

    _validate_revision_cycles(index, errors)
    return index


def _validate_revision_cycles(index: dict[str, dict[str, Any]], errors: list[str]) -> None:
    for start in index:
        seen: set[str] = set()
        current: str | None = start
        while current is not None and current in index:
            if current in seen:
                errors.append(f"revision 链存在环: {start}")
                break
            seen.add(current)
            parent = index[current].get("supersedesObservationId")
            current = parent if isinstance(parent, str) else None


def _validate_market_models(
    catalog: dict[str, Any],
    definitions: dict[str, dict[str, Any]],
    errors: list[str],
) -> None:
    scopes = catalog.get("marketScopeVersions", [])
    _duplicates(scopes, "marketScopeVersionId", "marketScopeVersionId", errors)
    for offset, item in enumerate(scopes):
        label = f"marketScopeVersions[{offset}]"
        _required(item, {"marketScopeVersionId", "effectiveFrom", "effectiveTo", "exchanges", "definitionSummary", "createdAt"}, label, errors)
        if not _valid_id(item.get("marketScopeVersionId")):
            errors.append(f"{label}.marketScopeVersionId 非法")
        if not isinstance(item.get("exchanges"), list) or not item["exchanges"] or any(exchange not in {"SSE", "SZSE", "BSE"} for exchange in item["exchanges"]):
            errors.append(f"{label}.exchanges 非法")
        elif len(set(item["exchanges"])) != len(item["exchanges"]):
            errors.append(f"{label}.exchanges 不得重复")
        start = _parse_date(item.get("effectiveFrom"), f"{label}.effectiveFrom", errors)
        end = _parse_date(item["effectiveTo"], f"{label}.effectiveTo", errors) if item.get("effectiveTo") is not None else None
        if start and end and end < start:
            errors.append(f"{label}.effectiveTo 早于 effectiveFrom")
        if not isinstance(item.get("definitionSummary"), str) or not item["definitionSummary"].strip():
            errors.append(f"{label}.definitionSummary 不能为空")
        _aware(item.get("createdAt"), f"{label}.createdAt", errors)

    exchange_observations = catalog.get("exchangeMarketObservations", [])
    _duplicates(exchange_observations, "observationId", "exchange market observationId", errors)
    for offset, item in enumerate(exchange_observations):
        label = f"exchangeMarketObservations[{offset}]"
        _required(item, {"observationId", "exchange", "tradeDate", "totalMarketCap", "negotiableMarketCap", "turnoverValue", "currency", "sourceDefinitionId", "releaseAvailableAt", "qualityStatus"}, label, errors)
        if not _valid_id(item.get("observationId")):
            errors.append(f"{label}.observationId 非法")
        exchange = item.get("exchange")
        if exchange not in {"SSE", "SZSE", "BSE"}:
            errors.append(f"{label}.exchange 非法")
        if item.get("currency") != "CNY":
            errors.append(f"{label}.currency 必须是 CNY")
        trade_date = _parse_date(item.get("tradeDate"), f"{label}.tradeDate", errors)
        quality = item.get("qualityStatus")
        if quality not in {QualityStatus.VERIFIED.value, QualityStatus.PROVISIONAL.value, QualityStatus.STRUCTURALLY_UNAVAILABLE.value}:
            errors.append(f"{label}.qualityStatus 非法")
        values = [item.get("totalMarketCap"), item.get("negotiableMarketCap"), item.get("turnoverValue")]
        is_pre_bse = exchange == "BSE" and trade_date and trade_date < date(2021, 11, 15)
        if is_pre_bse:
            if quality != QualityStatus.STRUCTURALLY_UNAVAILABLE.value or any(value is not None for value in values):
                errors.append(f"{label} 北交所成立前必须是 STRUCTURALLY_UNAVAILABLE 且不得伪造 BSE=0")
        elif quality == QualityStatus.STRUCTURALLY_UNAVAILABLE.value:
            errors.append(f"{label} STRUCTURALLY_UNAVAILABLE 当前仅适用于北交所成立前")
        if quality == QualityStatus.STRUCTURALLY_UNAVAILABLE.value and any(value is not None for value in values):
            errors.append(f"{label} STRUCTURALLY_UNAVAILABLE 的市场数值必须为 null")
        available = item.get("releaseAvailableAt")
        if quality == QualityStatus.STRUCTURALLY_UNAVAILABLE.value:
            if available is not None:
                errors.append(f"{label} STRUCTURALLY_UNAVAILABLE 的 releaseAvailableAt 必须为 null")
        else:
            _aware(available, f"{label}.releaseAvailableAt", errors)
        definition = definitions.get(str(item.get("sourceDefinitionId")))
        if definition is None:
            errors.append(f"{label}.sourceDefinitionId 不存在")
        elif definition.get("metricId") != "EXCHANGE_MARKET_STATS":
            errors.append(f"{label}.sourceDefinitionId 不是市场统计定义")
        for value in values:
            if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(float(value)) or value < 0):
                errors.append(f"{label} 市场数值必须是非负有限数或 null")

    providers = catalog.get("providerSlots", [])
    _duplicates(providers, "providerId", "providerId", errors)
    for offset, item in enumerate(providers):
        label = f"providerSlots[{offset}]"
        _required(item, {"providerId", "metricId", "status", "sourceId", "evidenceSummary", "admissionRule", "updatedAt"}, label, errors)
        if not _valid_id(item.get("providerId")):
            errors.append(f"{label}.providerId 非法")
        if not _valid_id(item.get("metricId")):
            errors.append(f"{label}.metricId 非法")
        if item.get("status") not in SOURCE_STATUSES:
            errors.append(f"{label}.status 非法")
        for field in ("evidenceSummary", "admissionRule"):
            if not isinstance(item.get(field), str) or not item[field].strip():
                errors.append(f"{label}.{field} 不能为空")
        _aware(item.get("updatedAt"), f"{label}.updatedAt", errors)
        if item.get("metricId") == "VAL_CSI300_TTM_PE" and item.get("status") != SourceStatus.NO_GO.value:
            errors.append(f"{label} 沪深300历史 TTM PE 当前必须保持 NO_GO")


def _validate_manifest(catalog: dict[str, Any], errors: list[str]) -> None:
    manifest = catalog.get("manifest")
    if not isinstance(manifest, dict):
        errors.append("catalog.manifest 缺失或不是 object")
        return
    expected = derive_manifest(catalog)
    for field in (
        "catalogVersion", "generatedAt", "metricIds", "sourceDefinitionIds",
        "observationCount", "artifactCount", "minValueDate", "maxValueDate",
        "minReleaseAvailableAt", "maxReleaseAvailableAt", "contentHashes",
    ):
        if manifest.get(field) != expected.get(field):
            errors.append(f"manifest.{field} 与 catalog 实际内容不一致")
    if manifest.get("validationStatus") != "PASS" or manifest.get("validationErrors") != []:
        errors.append("manifest 必须记录 validationStatus=PASS 且 validationErrors=[]")


def validate_catalog(
    catalog: dict[str, Any],
    *,
    artifact_root: Path | None = None,
    verify_artifacts: bool = False,
    check_manifest: bool = True,
) -> list[str]:
    errors: list[str] = []
    required_top = {
        "schemaVersion", "catalogVersion", "generatedAt", "sourceDefinitions", "artifacts",
        "observations", "marketScopeVersions", "exchangeMarketObservations", "providerSlots",
    }
    _required(catalog, required_top, "catalog", errors)
    if catalog.get("schemaVersion") != "1.0.0":
        errors.append("catalog.schemaVersion 必须是 1.0.0")
    if not isinstance(catalog.get("catalogVersion"), str) or not catalog.get("catalogVersion"):
        errors.append("catalog.catalogVersion 不能为空")
    _aware(catalog.get("generatedAt"), "catalog.generatedAt", errors)
    collections = _record_collections(catalog, errors)
    validation_view = dict(catalog)
    validation_view.update(collections)

    definitions = _validate_source_definitions(collections["sourceDefinitions"], errors)
    artifacts = _validate_artifacts(
        collections["artifacts"], errors, artifact_root=artifact_root, verify_artifacts=verify_artifacts
    )
    _validate_observations(collections["observations"], definitions, artifacts, errors)
    _validate_market_models(validation_view, definitions, errors)
    if check_manifest:
        _validate_manifest(validation_view, errors)
    return errors
