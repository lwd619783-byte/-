from __future__ import annotations

from enum import StrEnum
from typing import Any, NotRequired, TypedDict


class ReleaseConfidenceClass(StrEnum):
    EXACT_TIMESTAMP = "EXACT_TIMESTAMP"
    DATE_ONLY_SAFE = "DATE_ONLY_SAFE"
    SCHEDULE_INFERRED = "SCHEDULE_INFERRED"
    LATEST_REVISED_PROXY = "LATEST_REVISED_PROXY"
    BACKCAST_RELEASED_LATER = "BACKCAST_RELEASED_LATER"
    STRUCTURALLY_UNAVAILABLE = "STRUCTURALLY_UNAVAILABLE"


class ParseStatus(StrEnum):
    INDEXED = "INDEXED"
    PARSED = "PARSED"
    FIELD_SCHEMA_PROBE_REQUIRED = "FIELD_SCHEMA_PROBE_REQUIRED"
    FAILED = "FAILED"


class QualityStatus(StrEnum):
    VERIFIED = "VERIFIED"
    PROVISIONAL = "PROVISIONAL"
    REVISED = "REVISED"
    BACKCAST = "BACKCAST"
    MISSING = "MISSING"
    STRUCTURALLY_UNAVAILABLE = "STRUCTURALLY_UNAVAILABLE"
    REJECTED = "REJECTED"


class SourceStatus(StrEnum):
    PASS = "PASS"
    PARTIAL = "PARTIAL"
    NO_GO = "NO_GO"
    NOT_ATTEMPTED = "NOT_ATTEMPTED"


class SourceDefinitionVersion(TypedDict):
    """effectiveFrom/effectiveTo 是统计期适用范围，不是发布或建档时间。"""

    sourceDefinitionId: str
    sourceId: str
    metricId: str
    version: str
    effectiveFrom: str
    effectiveTo: str | None
    definitionSummary: str
    unit: str
    nativeFrequency: str
    releaseSemantics: str
    revisionPolicy: str
    sourceUrlPattern: str
    createdAt: str


class RawSourceArtifact(TypedDict):
    artifactId: str
    sourceId: str
    sourceUrl: str
    publicationDateTime: str | None
    publicationDate: str | None
    releaseAvailableAt: str
    fetchedAt: str
    contentType: str
    fileName: str
    sha256: str
    byteSize: int
    httpStatus: int
    releaseConfidenceClass: str
    artifactRole: str
    localPath: str
    parseStatus: str
    error: str | None


class MetricObservationVintage(TypedDict):
    observationId: str
    metricId: str
    valueDate: str
    releaseDateTime: str | None
    releaseAvailableAt: str
    fetchedAt: str
    value: float | int | None
    unit: str
    sourceId: str
    sourceDefinitionId: str
    revisionSequence: int
    supersedesObservationId: str | None
    releaseConfidenceClass: str
    qualityStatus: str
    rawArtifactId: str
    transformVersion: str
    metadata: dict[str, Any]


class MarketScopeVersion(TypedDict):
    marketScopeVersionId: str
    effectiveFrom: str
    effectiveTo: str | None
    exchanges: list[str]
    definitionSummary: str
    createdAt: str


class ExchangeMarketObservation(TypedDict):
    observationId: str
    exchange: str
    tradeDate: str
    totalMarketCap: float | int | None
    negotiableMarketCap: float | int | None
    turnoverValue: float | int | None
    currency: str
    sourceDefinitionId: str
    releaseAvailableAt: str | None
    qualityStatus: str


class WeeklyBacktestClock(TypedDict):
    weekId: str
    timezone: str
    weekday: str
    cutoff: str
    runCutoff: str
    latestEligibleTradingDate: NotRequired[str | None]
    calendarVersion: str


class BacktestInputManifest(TypedDict):
    manifestId: str
    weekId: str
    runCutoff: str
    formulaVersion: str
    metricObservationIds: list[str]
    moduleAvailability: dict[str, str]
    baseWeightCoverage: float | None
    metricCoverage: float | None
    qualityTierCounts: dict[str, int]
    createdAt: str


class ProviderSlot(TypedDict):
    providerId: str
    metricId: str
    status: str
    sourceId: str | None
    evidenceSummary: str
    admissionRule: str
    updatedAt: str
