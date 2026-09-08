"""R2 envelope contracts; R1 models and serialized records remain unchanged."""
from __future__ import annotations

from typing import Literal, TypedDict


class Locator(TypedDict):
    artifactId: str
    byteOffset: int
    byteLength: int
    text: str


class StoredBytes(TypedDict):
    localPath: str
    sha256: str
    byteSize: int


class Calendar(TypedDict):
    calendarVersion: str
    dates: list[str]
    evidence: list[Locator]


class TargetWindow(TypedDict):
    windowId: str
    sourceId: str
    metricId: str
    field: Literal['value', 'turnoverValue', 'totalMarketCap', 'negotiableMarketCap']
    frequency: Literal['MONTHLY', 'TRADING_DAY']
    start: str
    end: str
    scopeVersion: str
    nativeFrequencyEra: str
    sourceDefinitionIds: list[str]
    calendar: Calendar | None


class Pagination(TypedDict):
    startPage: int
    endPage: int
    stopCondition: str
    requestLimit: int
    timeoutSeconds: float | int
    enumerationRule: Literal['OFFICIAL_LINKS_ONLY']


class SourcePlan(TypedDict):
    sourceId: str
    officialRoots: list[str]
    indexUrls: list[str]
    pagination: Pagination
    firstReleaseRule: str


class Plan(TypedDict):
    schemaVersion: Literal['1.0.0']
    planName: str
    planVersion: str
    planId: str
    purpose: Literal['SYNTHETIC_OFFLINE', 'HISTORICAL']
    datasetAsOf: str
    timezone: Literal['Asia/Shanghai']
    decisionClock: Literal['MONDAY_0800']
    sources: list[SourcePlan]
    targetWindows: list[TargetWindow]


class ReleaseEventAttachmentEvidenceItem(TypedDict):
    artifactId: str
    url: str
    locator: Locator


class ReleaseEvent(TypedDict):
    releaseEventId: str
    sourceId: str
    landingUrl: str
    eventSection: str
    publicationDateTime: str | None
    publicationDate: str | None
    releaseAvailableAt: str
    releaseConfidenceClass: Literal['EXACT_TIMESTAMP', 'DATE_ONLY_SAFE', 'SCHEDULE_INFERRED', 'LATEST_REVISED_PROXY', 'BACKCAST_RELEASED_LATER']
    landingArtifactId: str
    attachmentArtifactIds: list[str]
    publicationEvidence: Locator
    attachmentEvidence: list[ReleaseEventAttachmentEvidenceItem]
    releaseKind: Literal['FIRST_RELEASE', 'REVISION', 'BACKCAST', 'UNRESOLVED']
    coveredPeriods: list[str]
    firstReleaseEvidenceArtifactIds: list[str]
    firstReleaseEvidence: list[Locator]
    revisionEvidence: list[Locator]


class ArtifactBinding(TypedDict):
    artifactId: str
    releaseEventId: str
    completeResponse: bool
    contentValidation: Literal['VALIDATED', 'ERROR_PAGE', 'UNSUPPORTED']
    contentEvidence: Locator


class FieldExtractionUnitConversion(TypedDict):
    rule: Literal['IDENTITY', 'SCALE']
    factor: float | int
    outputUnit: str


class FieldExtraction(TypedDict):
    extractionId: str
    observationId: str | None
    exchangeObservationId: str | None
    field: Literal['value', 'turnoverValue', 'totalMarketCap', 'negotiableMarketCap']
    releaseEventId: str
    rawArtifactId: str
    sourceDefinitionId: str
    parserVersion: str
    rawFieldName: str
    rawUnit: str
    rawValue: float | int
    rawValueText: str
    locator: Locator
    period: str
    periodSemantics: Literal['MONTH', 'DAY', 'YEAR_END', 'QUARTER_END', 'YTD']
    unitConversion: FieldExtractionUnitConversion
    basisEvidence: Locator
    reportedComparableBasis: bool
    predecessorExtractionIds: list[str]


class CoverageCell(TypedDict):
    cellId: str
    windowId: str
    sourceId: str
    metricId: str
    field: Literal['value', 'turnoverValue', 'totalMarketCap', 'negotiableMarketCap']
    period: str
    scopeVersion: str
    sourceDefinitionIds: list[str]
    status: Literal['AVAILABLE', 'NOT_YET_RELEASED', 'STRUCTURALLY_UNAVAILABLE', 'MISSING', 'SOURCE_UNREACHABLE', 'SOURCE_ABSENT_CONFIRMED', 'AUTOMATION_UNPROVEN', 'FIRST_RELEASE_UNPROVEN', 'PIT_VINTAGE_UNPROVEN', 'FIELD_MISSING', 'UNSUPPORTED_FORMAT', 'PARSER_FAILED', 'DEFINITION_UNRESOLVED', 'UNRESOLVED_RELEASE_CONFLICT']
    reasonCode: str
    evidenceArtifactIds: list[str]
    statusEvidence: list[Locator]
    candidateReleaseEventIds: list[str]
    admittedObservationIds: list[str]


class RetrievalAttempt(TypedDict):
    attemptId: str
    sourceId: str
    requestUrl: str
    finalUrl: str | None
    attemptedAt: str
    httpStatus: int | None
    transportError: str | None
    storedBytes: StoredBytes | None
    outcome: Literal['SUCCESS', 'CACHE_VERIFIED', 'HTTP_ERROR', 'TRANSPORT_ERROR', 'CONTENT_REJECTED']
    reasonCode: str
    candidateReleaseEventIds: list[str]
    handlingBasis: str


class Conflict(TypedDict):
    conflictId: str
    cellIds: list[str]
    candidateReleaseEventIds: list[str]
    status: Literal['UNRESOLVED', 'RESOLVED_BY_OFFICIAL_REVISION']
    evidence: list[Locator]
    resolutionReleaseEventId: str | None
    reasonCode: str
    handlingBasis: str


class InventoryEvidence(TypedDict):
    windowId: str
    scannedIndexUrls: list[str]
    paginationComplete: bool
    candidatesReconciled: bool
    revisionScanComplete: bool
    evidence: list[Locator]


class CoverageSummaryCounts(TypedDict):
    targetCount: int
    availableCount: int
    provenFirstReleaseCount: int
    backcastCount: int
    notYetReleasedCount: int
    structuralCount: int
    unresolvedCount: int
    vintageCount: int


class CoverageSummary(TypedDict):
    windowId: str
    counts: CoverageSummaryCounts
    inventoryStatus: Literal['PASS', 'PARTIAL']
    datasetCoverageStatus: Literal['PASS', 'PARTIAL']
    revisionCoverageStatus: Literal['PASS', 'PARTIAL']


class ManifestSidecarContentHashes(TypedDict):
    releaseEvents: str
    artifactBindings: str
    fieldExtractions: str
    coverageLedger: str
    retrievalAttempts: str
    conflicts: str
    inventoryEvidence: str


class Manifest(TypedDict):
    schemaVersion: Literal['1.0.0']
    datasetVersion: str
    planId: str
    planContentSha256: str
    datasetAsOf: str
    targetWindows: list[TargetWindow]
    catalogContentSha256: str
    sidecarContentHashes: ManifestSidecarContentHashes
    datasetContentSha256: str
    generatedAt: str
    validationStatus: Literal['PASS']
    admissionStatus: Literal['SYNTHETIC_ONLY', 'PARTIAL', 'ADMITTED']
    coverageSummary: list[CoverageSummary]


class HistoricalDataset(TypedDict):
    manifest: Manifest
    releaseEvents: list[ReleaseEvent]
    artifactBindings: list[ArtifactBinding]
    fieldExtractions: list[FieldExtraction]
    coverageLedger: list[CoverageCell]
    retrievalAttempts: list[RetrievalAttempt]
    conflicts: list[Conflict]
    inventoryEvidence: list[InventoryEvidence]
