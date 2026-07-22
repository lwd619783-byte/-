import type {
  EarningsExpectationBusinessRevisionDelta,
  EarningsExpectationBusinessOrderCandidate,
  EarningsExpectationComparison,
  EarningsExpectationCorrectionDelta,
  EarningsExpectationEventPayload,
  EarningsExpectationSnapshot,
  EarningsExpectationWarningCode,
  ResearchEvent,
  Stock,
} from "../types";
import { comparisonResultLabel, expectationGroupKey, sourceCategoryLabel } from "./earningsExpectationComparisonProvider";
import {
  deriveExpectationBusinessRevisionDelta,
  deriveExpectationCorrectionDelta,
  getExpectationBusinessTime,
  getExpectationAvailability,
  getExpectationFormationTemporal,
  resolveEarningsExpectationCorrectionChain,
  resolveEffectiveBusinessHistory,
  resolveUniquePreviousBusinessNode,
  sortExpectationsByBusinessTime,
  type EffectiveEarningsExpectationBusinessNode,
  type PreviousBusinessNodeResolution,
} from "./earningsExpectationIntegrity";
import {
  compareCanonicalBusinessTemporal,
  getCalendarDateInTimeZone,
  isPreciseInstant,
  resolveSafeWorkflowTimeZone,
  toCanonicalBusinessTemporal,
} from "../utils/dateTime";

export function buildEarningsExpectationResearchEvents(
  snapshots: EarningsExpectationSnapshot[],
  comparisons: EarningsExpectationComparison[],
  stocks: Stock[],
  revisionReminderThreshold = 0.1,
  timeZone = resolveSafeWorkflowTimeZone(),
): ResearchEvent[] {
  const events: ResearchEvent[] = [];
  const snapshotsById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const businessNodes = resolveEffectiveBusinessHistory(snapshots, timeZone);
  const nodesByGroup = new Map<string, typeof businessNodes>();
  for (const node of businessNodes) {
    const key = expectationGroupKey(node.businessRootSnapshot);
    nodesByGroup.set(key, [...(nodesByGroup.get(key) ?? []), node]);
  }
  for (const group of nodesByGroup.values()) {
    const currentWarningNode = group[group.length - 1];
    const groupSnapshots = snapshots.filter((snapshot) => expectationGroupKey(snapshot) === expectationGroupKey(currentWarningNode.businessRootSnapshot));
    group.forEach((node) => {
      const stock = stocks.find((item) => item.id === node.businessRootSnapshot.stockId);
      if (!stock) return;
      const previousResolution = resolveUniquePreviousBusinessNode(node, group);
      const previous = previousResolution.previousNode ?? undefined;
      const businessOrderStatus = previousResolution.status === "equal_time" ? "equal" : ["ambiguous", "unresolved"].includes(previousResolution.status) ? "uncertain" : "confirmed";
      const businessRevisionDelta = deriveExpectationBusinessRevisionDelta(
        node.effectiveSnapshot,
        previous?.effectiveSnapshot,
        businessOrderStatus,
        {
          previousBusinessRootSnapshotId: previous?.businessRootSnapshot.id,
          currentBusinessRootSnapshotId: node.businessRootSnapshot.id,
        },
      );
      events.push(snapshotEvent(stock, node.businessRootSnapshot, node.effectiveSnapshot, previousResolution.status === "unique", businessRevisionDelta, revisionReminderThreshold, timeZone, businessOrderStatus, node.correctionChain, previousResolution));
      if (["ambiguous", "equal_time", "unresolved"].includes(previousResolution.status) && currentWarningNode.businessRootSnapshot.id === node.businessRootSnapshot.id) {
        const reason = businessOrderStatus === "equal"
          ? "两条独立预测形成于同一精确时刻，稳定 ID 仅用于显示排序；不生成方向性业务修订。"
          : previousResolution.status === "unresolved"
            ? "历史时间缺少可恢复的原解释时区，无法证明唯一业务前序。"
            : "存在多个互相无法排序的最大前序，不生成方向性业务修订。";
        const currentComparison = comparisons.find((comparison) => comparison.snapshotId === node.effectiveSnapshot.id) ?? null;
        events.push(businessOrderWarningEvent(stock, node, groupSnapshots, previousResolution, currentComparison, timeZone, businessOrderStatus, reason));
      }
    });
  }

  for (const correction of sortExpectationsByBusinessTime(snapshots.filter((snapshot) => Boolean(snapshot.correctsSnapshotId)), timeZone)) {
    const stock = stocks.find((item) => item.id === correction.stockId);
    if (!stock) continue;
    const resolved = resolveEarningsExpectationCorrectionChain(snapshots, correction.id);
    const root = resolved.chain[0] ?? correction;
    const terminal = resolved.terminal ?? correction;
    const correctionDelta = deriveExpectationCorrectionDelta(correction, correction.correctsSnapshotId ? snapshotsById.get(correction.correctsSnapshotId) : undefined);
    events.push(correctionEvent(stock, correction, correctionDelta, timeZone, root, terminal, resolved.chain));
  }
  for (const correction of sortExpectationsByBusinessTime(snapshots.filter((snapshot) => Boolean(snapshot.providerCorrectsVersionId)), timeZone)) {
    const stock = stocks.find((item) => item.id === correction.stockId);
    if (stock) events.push(providerCorrectionEvent(stock, correction, timeZone));
  }

  const nodeByEffectiveId = new Map(businessNodes.map((node) => [node.effectiveSnapshot.id, node]));
  for (const comparison of comparisons) {
    const snapshot = snapshotsById.get(comparison.snapshotId);
    if (!snapshot) continue;
    const stock = stocks.find((item) => item.id === snapshot.stockId);
    if (!stock) continue;
    const node = nodeByEffectiveId.get(snapshot.id);
    const root = node?.businessRootSnapshot ?? snapshot;
    const chain = node?.correctionChain ?? [snapshot];
    if (comparison.comparabilityStatus === "comparable") events.push(comparisonEvent(stock, snapshot, comparison, timeZone, comparison.businessOrderStatus ?? "confirmed", root, chain));
    else events.push(warningEvent(stock, snapshot, comparison, timeZone, comparison.businessOrderStatus ?? "confirmed", root, chain));
  }
  for (const node of businessNodes) {
    if (comparisons.some((comparison) => comparison.snapshotId === node.effectiveSnapshot.id) || node.effectiveSnapshot.sourceVerificationStatus === "verified") continue;
    const stock = stocks.find((item) => item.id === node.effectiveSnapshot.stockId);
    if (stock) events.push(warningEvent(stock, node.effectiveSnapshot, null, timeZone, "confirmed", node.businessRootSnapshot, node.correctionChain));
  }
  return dedupe(events).sort((left, right) => {
    if (left.expectation?.snapshotId && left.expectation.snapshotId === right.expectation?.snapshotId) {
      const presentationOrder = expectationEventPresentationRank(left) - expectationEventPresentationRank(right);
      if (presentationOrder) return presentationOrder;
    }
    return compareResearchEventTime(right, left, timeZone) || left.id.localeCompare(right.id);
  });
}

function expectationEventPresentationRank(event: ResearchEvent) {
  if (event.eventType === "earnings_expectation_added" || event.eventType === "earnings_expectation_revision") return 0;
  if (event.eventType === "earnings_expectation_correction") return 1;
  if (event.eventType === "earnings_expectation_comparison_available") return 2;
  if (event.eventType === "earnings_expectation_data_warning") return 3;
  return 4;
}

function snapshotEvent(
  stock: Stock,
  businessRootSnapshot: EarningsExpectationSnapshot,
  snapshot: EarningsExpectationSnapshot,
  isRevision: boolean,
  revision: EarningsExpectationBusinessRevisionDelta | null,
  revisionReminderThreshold: number,
  timeZone: string,
  businessOrderStatus: "confirmed" | "equal" | "uncertain",
  correctionChain: EarningsExpectationSnapshot[],
  previousResolution: ReturnType<typeof resolveUniquePreviousBusinessNode>,
): ResearchEvent {
  const type = isRevision ? "earnings_expectation_revision" : "earnings_expectation_added";
  const category = sourceCategoryLabel(snapshot.sourceCategory);
  const reasons = snapshot.sourceVerificationStatus === "verified" ? [] : ["预期来源待核验"];
  return {
    ...base(stock, snapshot, timeZone, businessRootSnapshot),
    id: `expectation-event:${businessRootSnapshot.id}:business`,
    eventType: type,
    title: `${category}${isRevision ? snapshot.correctionScope === "basis" ? "口径纠正" : "修订" : "新增"} · ${metricLabel(snapshot.metric)}`,
    summary: `${snapshot.reportPeriod} ${periodScopeLabel(snapshot.periodScope)}；${formatExpectation(snapshot)}。${snapshot.sourceCategory === "user_estimate" ? "该记录为用户个人预测，不代表机构观点。" : ""}`,
    verificationStatus: snapshot.sourceVerificationStatus === "verified" ? "verified" : snapshot.sourceVerificationStatus === "invalid" ? "error" : "partial",
    reviewStatus: reasons.length ? "pending" : "not_required",
    reviewReasons: reasons,
    materiality: isRevision && revision && Math.abs(revision.relativeDelta) >= revisionReminderThreshold ? "high" : "medium",
    expectation: payload(snapshot, null, null, revision, businessOrderStatus, timeZone, businessRootSnapshot, correctionChain, null, snapshot.id, previousResolution),
  };
}

function correctionEvent(
  stock: Stock,
  snapshot: EarningsExpectationSnapshot,
  correctionDelta: EarningsExpectationCorrectionDelta | null,
  timeZone: string,
  businessRootSnapshot: EarningsExpectationSnapshot,
  effectiveSnapshot: EarningsExpectationSnapshot,
  correctionChain: EarningsExpectationSnapshot[],
): ResearchEvent {
  const reasons = correctionDelta ? [] : ["无法匹配被更正快照，未计算更正差异"];
  const correctionRecordedAt = snapshot.createdAt;
  const correctionDisplayDate = getCalendarDateInTimeZone(correctionRecordedAt, timeZone);
  return {
    ...base(stock, snapshot, timeZone, businessRootSnapshot),
    id: `expectation-event:${snapshot.id}:earnings_expectation_correction`,
    eventType: "earnings_expectation_correction",
    eventDate: correctionDisplayDate,
    publishedAt: correctionRecordedAt,
    eventOccurredAt: correctionRecordedAt,
    eventBusinessDate: correctionDisplayDate,
    recordedAt: snapshot.createdAt,
    title: `${sourceCategoryLabel(snapshot.sourceCategory)}数据更正 · ${metricLabel(snapshot.metric)}`,
    summary: correctionDelta
      ? `历史数据更正：${correctionDelta.previousValue ?? "缺失"} → ${correctionDelta.correctedValue ?? "缺失"}。该差异仅描述数据修正，不代表业务预测上调或下调。${correctionDelta.calculationNote ?? ""}`
      : `${snapshot.reportPeriod} ${periodScopeLabel(snapshot.periodScope)}的数据更正；无法匹配被更正快照。`,
    verificationStatus: snapshot.sourceVerificationStatus === "verified" ? "verified" : snapshot.sourceVerificationStatus === "invalid" ? "error" : "partial",
    reviewStatus: "pending",
    reviewReasons: reasons,
    materiality: "medium",
    expectation: payload(snapshot, null, correctionDelta, null, "confirmed", timeZone, businessRootSnapshot, correctionChain, correctionRecordedAt, effectiveSnapshot.id),
  };
}

function providerCorrectionEvent(stock: Stock, snapshot: EarningsExpectationSnapshot, timeZone: string): ResearchEvent {
  const correctionRecordedAt = snapshot.providerCorrectedAt ?? snapshot.createdAt;
  const correctionDisplayDate = getCalendarDateInTimeZone(correctionRecordedAt, timeZone);
  const changedFields = snapshot.providerCorrectionChangedFields ?? [];
  return {
    ...base(stock, snapshot, timeZone, snapshot),
    id: `expectation-event:${snapshot.providerEvidenceIdentity}:${snapshot.providerSnapshotVersionId}:provider-correction`,
    eventType: "earnings_expectation_correction",
    eventDate: correctionDisplayDate,
    publishedAt: correctionRecordedAt,
    eventOccurredAt: correctionRecordedAt,
    eventBusinessDate: correctionDisplayDate,
    recordedAt: snapshot.createdAt,
    title: `公司指引 Provider 抽取纠错 · ${metricLabel(snapshot.metric)}`,
    summary: `Provider 内容版本已追加纠正；变更字段：${changedFields.length ? changedFields.join("、") : "未记录"}。该事件只表示证据抽取或来源数据修复，不表示公司业务预测上调或下调。`,
    verificationStatus: "verified",
    reviewStatus: "pending",
    reviewReasons: changedFields.length ? [`复核 Provider 纠错字段：${changedFields.join("、")}`] : ["复核 Provider 内容版本纠错"],
    materiality: "medium",
    expectation: payload(snapshot, null, null, null, "confirmed", timeZone, snapshot, [snapshot], correctionRecordedAt),
  };
}

function comparisonEvent(stock: Stock, snapshot: EarningsExpectationSnapshot, comparison: EarningsExpectationComparison, timeZone: string, businessOrderStatus: "confirmed" | "equal" | "uncertain", businessRootSnapshot: EarningsExpectationSnapshot, correctionChain: EarningsExpectationSnapshot[]): ResearchEvent {
  const availableAt = comparison.comparisonAvailableAt ?? null;
  const eventBusinessDate = comparison.comparisonAvailableBusinessCalendarDate ?? null;
  return {
    ...base(stock, snapshot, timeZone, businessRootSnapshot),
    id: `expectation-event:${businessRootSnapshot.id}:comparison:${comparison.actualEventId ?? "missing"}`,
    eventType: "earnings_expectation_comparison_available",
    eventDate: eventBusinessDate,
    publishedAt: availableAt,
    eventOccurredAt: availableAt,
    eventBusinessDate,
    recordedAt: snapshot.createdAt,
    title: `${sourceCategoryLabel(snapshot.sourceCategory)}比较结果可用 · ${metricLabel(snapshot.metric)}`,
    summary: `${comparisonResultLabel(comparison, snapshot)}；${comparison.comparisonMethod}。${comparison.isExAnte ? "形成于任何同指标业绩信息披露前。" : "仅作事后参考或口径核验。"}`,
    verificationStatus: comparison.comparabilityStatus === "comparable" ? "verified" : "partial",
    reviewStatus: "pending",
    reviewReasons: comparison.nonComparableReasons,
    materiality: comparison.comparisonResult === "above" || comparison.comparisonResult === "below" ? "high" : "medium",
    expectation: payload(snapshot, comparison, null, null, businessOrderStatus, timeZone, businessRootSnapshot, correctionChain, null),
  };
}

function warningEvent(stock: Stock, snapshot: EarningsExpectationSnapshot, comparison: EarningsExpectationComparison | null, timeZone: string, businessOrderStatus: "confirmed" | "equal" | "uncertain", businessRootSnapshot: EarningsExpectationSnapshot, correctionChain: EarningsExpectationSnapshot[], explicitReasons?: string[], explicitCodes?: EarningsExpectationWarningCode[]): ResearchEvent {
  const reasons = explicitReasons?.length ? explicitReasons : comparison?.nonComparableReasons.length ? comparison.nonComparableReasons : ["预期来源待核验"];
  const warningCodes = explicitCodes?.length ? explicitCodes : warningCodesFor(snapshot, comparison);
  const episode = resolveWarningEpisode(businessRootSnapshot, correctionChain, warningCodes, comparison);
  const availability = getExpectationAvailability(snapshot);
  const warningBusinessDate = availability.status === "resolved"
    ? availability.value.businessCalendarDate
    : availability.bounds.businessDateMax ?? getExpectationFormationTemporal(snapshot).businessCalendarDate;
  return {
    ...base(stock, snapshot, timeZone, businessRootSnapshot),
    id: `expectation-event:${businessRootSnapshot.id}:warning:${stableHash(episode.key)}`,
    eventType: "earnings_expectation_data_warning",
    eventDate: warningBusinessDate,
    publishedAt: null,
    eventOccurredAt: null,
    eventBusinessDate: warningBusinessDate,
    detectedAt: episode.stateActivatedAt,
    stateActivatedAt: episode.stateActivatedAt,
    recordedAt: snapshot.createdAt,
    warningEpisodeKey: episode.key,
    title: `业绩预期数据需要核验 · ${metricLabel(snapshot.metric)}`,
    summary: reasons.join("；"),
    verificationStatus: snapshot.sourceVerificationStatus === "invalid" ? "error" : "partial",
    parseStatus: snapshot.sourceVerificationStatus === "invalid" ? "error" : "not_applicable",
    reviewStatus: "pending",
    reviewReasons: reasons,
    materiality: "medium",
    expectation: {
      ...payload(snapshot, comparison, null, null, businessOrderStatus, timeZone, businessRootSnapshot, correctionChain, null),
      structuredWarningCodes: warningCodes,
      warningEpisodeKey: episode.key,
      warningActivationEntityIds: episode.activationEntityIds,
      eventOccurredAt: null,
      eventBusinessDate: warningBusinessDate,
      detectedAt: episode.stateActivatedAt,
      stateActivatedAt: episode.stateActivatedAt,
      recordedAt: snapshot.createdAt,
    },
  };
}

function businessOrderWarningEvent(
  stock: Stock,
  node: EffectiveEarningsExpectationBusinessNode,
  groupSnapshots: EarningsExpectationSnapshot[],
  previousResolution: PreviousBusinessNodeResolution,
  comparison: EarningsExpectationComparison | null,
  timeZone: string,
  businessOrderStatus: "confirmed" | "equal" | "uncertain",
  reason: string,
): ResearchEvent {
  const warningCode = previousResolution.reasonCode ?? "business_order_ambiguous";
  const episode = resolveBusinessOrderWarningEpisode(node, previousResolution, groupSnapshots, timeZone, warningCode);
  const availability = node.availableAt;
  const warningBusinessDate = availability.status === "resolved"
    ? availability.value.businessCalendarDate
    : availability.bounds.businessDateMax ?? getExpectationFormationTemporal(node.effectiveSnapshot).businessCalendarDate;
  const candidates = businessOrderCandidates(previousResolution);
  const reasons = [reason, `候选前序 ${candidates.length} 条；请补充精确形成时间或通过追加纠正快照人工确认前序。`];
  return {
    ...base(stock, node.effectiveSnapshot, timeZone, node.businessRootSnapshot),
    id: `expectation-event:${node.businessRootSnapshot.id}:warning:business_order:${stableHash(episode.key)}`,
    eventType: "earnings_expectation_data_warning",
    eventDate: warningBusinessDate,
    publishedAt: null,
    eventOccurredAt: null,
    eventBusinessDate: warningBusinessDate,
    detectedAt: episode.stateActivatedAt,
    stateActivatedAt: episode.stateActivatedAt,
    recordedAt: node.effectiveSnapshot.createdAt,
    warningEpisodeKey: episode.key,
    title: `上一业务预测需要核验 · ${metricLabel(node.effectiveSnapshot.metric)}`,
    summary: reasons.join("；"),
    verificationStatus: "partial",
    parseStatus: "not_applicable",
    reviewStatus: "pending",
    reviewReasons: reasons,
    materiality: "medium",
    expectation: {
      ...payload(node.effectiveSnapshot, comparison, null, null, businessOrderStatus, timeZone, node.businessRootSnapshot, node.correctionChain, null, node.effectiveSnapshot.id, previousResolution),
      warningFamily: "business_order",
      businessOrderCandidates: candidates,
      structuredWarningCodes: [warningCode],
      nonComparableReasonCodes: [warningCode],
      warningEpisodeKey: episode.key,
      warningActivationEntityIds: episode.activationEntityIds,
      eventOccurredAt: null,
      eventBusinessDate: warningBusinessDate,
      detectedAt: episode.stateActivatedAt,
      stateActivatedAt: episode.stateActivatedAt,
      recordedAt: node.effectiveSnapshot.createdAt,
    },
  };
}

function base(stock: Stock, snapshot: EarningsExpectationSnapshot, timeZone: string, _businessRootSnapshot: EarningsExpectationSnapshot = snapshot): ResearchEvent {
  const availability = getExpectationAvailability(snapshot);
  const formation = getExpectationFormationTemporal(snapshot);
  const eventDate = availability.status === "resolved" ? availability.value.businessCalendarDate : availability.bounds.businessDateMax ?? formation.businessCalendarDate;
  const occurredAt = availability.status === "resolved" ? availability.value.value : null;
  return {
    id: "",
    stockId: stock.id,
    stockName: stock.name,
    stockCode: stock.code,
    industryId: stock.industryId,
    market: stock.market,
    eventType: "earnings_expectation_added",
    eventDate,
    publishedAt: occurredAt,
    eventOccurredAt: occurredAt,
    eventBusinessDate: eventDate,
    detectedAt: null,
    stateActivatedAt: null,
    recordedAt: snapshot.createdAt,
    warningEpisodeKey: null,
    reportPeriod: snapshot.reportPeriod,
    title: "",
    summary: "",
    sourceType: "earnings_expectation",
    sourceName: snapshot.sourceName || sourceCategoryLabel(snapshot.sourceCategory),
    sourceUrl: snapshot.sourceUrl,
    pdfUrl: snapshot.officialPdfUrl ?? null,
    verificationStatus: "partial",
    parseStatus: snapshot.ingestionMethod === "provider" ? "parse_success" : "not_applicable",
    materiality: "medium",
    metrics: [],
    relatedAnnouncementIds: snapshot.sourceAnnouncementId ? [snapshot.sourceAnnouncementId] : [],
    relatedFinancialPeriod: snapshot.reportPeriod,
    reviewStatus: "not_required",
    reviewReasons: [],
    isRestated: Boolean(snapshot.correctsSnapshotId),
    updatedAt: snapshot.createdAt,
  };
}

function payload(
  snapshot: EarningsExpectationSnapshot,
  comparison: EarningsExpectationComparison | null,
  correctionDelta: EarningsExpectationCorrectionDelta | null,
  businessRevisionDelta: EarningsExpectationBusinessRevisionDelta | null,
  businessOrderStatus: "confirmed" | "equal" | "uncertain",
  timeZone: string,
  businessRootSnapshot: EarningsExpectationSnapshot,
  correctionChain: EarningsExpectationSnapshot[],
  correctionRecordedAt: string | null,
  effectiveSnapshotId = snapshot.id,
  previousResolution?: ReturnType<typeof resolveUniquePreviousBusinessNode>,
): EarningsExpectationEventPayload {
  const temporalNode = resolveEffectiveBusinessHistory(correctionChain, timeZone).find((node) => node.businessRootSnapshot.id === businessRootSnapshot.id);
  const originalBusinessTime = temporalNode?.originalBusinessTime ?? getExpectationBusinessTime(businessRootSnapshot, timeZone);
  const effectiveBusinessTime = temporalNode?.effectiveBusinessTime ?? getExpectationBusinessTime(snapshot, timeZone);
  const availableAt = temporalNode?.availableAt ?? getExpectationAvailability(snapshot);
  const originalFormation = getExpectationFormationTemporal(businessRootSnapshot);
  const effectiveFormation = temporalNode?.effectiveFormationTime ?? getExpectationFormationTemporal(snapshot);
  const eventOccurredAt = correctionRecordedAt
    ?? comparison?.comparisonAvailableAt
    ?? (availableAt.status === "resolved" ? availableAt.value.value : null);
  const eventBusinessDate = correctionRecordedAt
    ? getCalendarDateInTimeZone(correctionRecordedAt, timeZone)
    : comparison?.comparisonAvailableBusinessCalendarDate
      ?? (availableAt.status === "resolved" ? availableAt.value.businessCalendarDate : availableAt.bounds.businessDateMax);
  return {
    snapshotId: snapshot.id,
    businessEventKey: `expectation-business:${businessRootSnapshot.id}`,
    businessRootSnapshotId: businessRootSnapshot.id,
    effectiveSnapshotId,
    correctionChainSnapshotIds: correctionChain.map((item) => item.id),
    originalBusinessTime: originalBusinessTime?.value ?? null,
    effectiveBusinessTime: effectiveBusinessTime?.value ?? null,
    originalFormationTime: originalFormation.value ?? originalFormation.businessCalendarDate,
    effectiveFormationTime: effectiveFormation.value ?? effectiveFormation.businessCalendarDate,
    originalSourcePublishedAt: businessRootSnapshot.sourcePublishedAt ?? null,
    effectiveSourcePublishedAt: snapshot.sourcePublishedAt ?? null,
    temporalCorrectionApplied: temporalNode?.temporalCorrectionApplied ?? false,
    correctedTemporalFields: temporalNode?.correctedTemporalFields ?? [],
    actualSourceInterpretationTimeZone: temporalNode?.actualSourceInterpretationTimeZone ?? null,
    correctionRecordedAt,
    sourceCategory: snapshot.sourceCategory,
    sourceName: snapshot.sourceName,
    ingestionMethod: snapshot.ingestionMethod,
    providerId: snapshot.providerId,
    providerVersion: snapshot.providerVersion,
    providerGeneratedAt: snapshot.providerGeneratedAt,
    providerEvidenceIdentity: snapshot.providerEvidenceIdentity,
    providerSnapshotVersionId: snapshot.providerSnapshotVersionId,
    providerContentChecksum: snapshot.providerContentChecksum,
    providerCorrectsVersionId: snapshot.providerCorrectsVersionId,
    providerCorrectionType: snapshot.providerCorrectionType,
    providerCorrectionChangedFields: snapshot.providerCorrectionChangedFields,
    providerBusinessRevisionPredecessorSnapshotId: snapshot.providerBusinessRevisionPredecessorSnapshotId,
    sourceAnnouncementId: snapshot.sourceAnnouncementId,
    sourceAnnouncementType: snapshot.sourceAnnouncementType,
    officialPdfUrl: snapshot.officialPdfUrl,
    reportPeriod: snapshot.reportPeriod,
    metric: snapshot.metric,
    expectedValue: snapshot.value,
    expectedLowerBound: snapshot.lowerBound,
    expectedUpperBound: snapshot.upperBound,
    isExAnte: comparison?.isExAnte ?? null,
    beforeActualDisclosure: comparison?.beforeActualDisclosure ?? null,
    beforeAnyPerformanceDisclosure: comparison?.beforeAnyPerformanceDisclosure ?? null,
    performanceInformationCutoff: comparison?.performanceInformationCutoff ?? null,
    comparisonResult: comparison?.comparisonResult ?? null,
    sourceVerificationStatus: snapshot.sourceVerificationStatus,
    sourcePublishedAt: snapshot.sourcePublishedAt,
    sourcePublishedAtPrecision: snapshot.sourcePublishedAtPrecision ?? null,
    sourcePublishedAtResolution: snapshot.sourcePublishedAtResolution ?? null,
    sourcePublishedAtTimeZone: snapshot.sourcePublishedAtTimeZone ?? null,
    correctsSnapshotId: snapshot.correctsSnapshotId,
    businessOrderStatus,
    correctionDelta,
    businessRevisionDelta,
    actualDisclosureTimingStatus: comparison?.actualDisclosureTimingStatus ?? "unknown",
    performanceDisclosureTimingStatus: comparison?.performanceDisclosureTimingStatus ?? "unknown",
    performanceDisclosureUncertain: comparison?.performanceDisclosureUncertain ?? false,
    earliestConfirmedDisclosure: comparison?.earliestConfirmedDisclosure ?? null,
    earliestPossibleDisclosure: comparison?.earliestPossibleDisclosure ?? null,
    decisiveDisclosureEvent: comparison?.decisiveDisclosureEvent ?? null,
    disclosureUncertaintyReasonCode: comparison?.disclosureUncertaintyReasonCode ?? null,
    availableAt,
    availabilityBounds: availableAt.bounds,
    businessCalendarDate: availableAt.status === "resolved" ? availableAt.value.businessCalendarDate : availableAt.bounds.businessDateMax,
    interpretationTimeZone: availableAt.status === "resolved" ? availableAt.value.interpretationTimeZone : null,
    availabilityStatus: availableAt.status,
    availabilityUncertaintyReason: availableAt.status === "uncertain" ? availableAt.reason : null,
    previousResolutionStatus: previousResolution?.status ?? comparison?.previousResolutionStatus ?? "none",
    previousCandidateIds: previousResolution?.candidateNodes.map((node) => node.businessRootSnapshot.id) ?? comparison?.previousCandidateIds ?? [],
    previousCandidateEffectiveSnapshotIds: previousResolution?.candidateNodes.map((node) => node.effectiveSnapshot.id) ?? comparison?.previousCandidateEffectiveSnapshotIds ?? [],
    auditTimeStatus: temporalNode?.auditTimeStatus ?? comparison?.auditTimeStatus ?? (isPreciseInstant(snapshot.createdAt) ? "valid" : "invalid"),
    structuredWarningCodes: comparison?.structuredWarningCodes ?? [],
    nonComparableReasonCodes: comparison?.nonComparableReasonCodes ?? [],
    eventOccurredAt,
    eventBusinessDate,
    detectedAt: null,
    stateActivatedAt: null,
    recordedAt: snapshot.createdAt,
    revisionDirection: businessRevisionDelta?.direction ?? null,
    revisionMagnitude: businessRevisionDelta?.relativeDelta ?? null,
    businessTimePrecision: originalBusinessTime?.precision ?? null,
    effectiveBusinessTimePrecision: effectiveBusinessTime?.precision ?? null,
    businessOrderUncertain: businessOrderStatus === "uncertain",
  };
}

interface WarningEpisodeResolution {
  key: string;
  activationEntityIds: string[];
  stateActivatedAt: string | null;
}

interface BusinessOrderWarningEpisodeResolution extends WarningEpisodeResolution {
  status: "active" | "resolved";
  warningCode: EarningsExpectationWarningCode;
  currentBusinessRootSnapshotId: string;
  currentEffectiveSnapshotId: string;
  candidateBusinessRootSnapshotIds: string[];
  candidateEffectiveSnapshotIds: string[];
}

function resolveBusinessOrderWarningEpisode(
  currentNode: EffectiveEarningsExpectationBusinessNode,
  currentResolution: PreviousBusinessNodeResolution,
  groupSnapshots: EarningsExpectationSnapshot[],
  timeZone: string,
  warningCode: EarningsExpectationWarningCode,
): BusinessOrderWarningEpisodeResolution {
  const orderedAuditChanges = [...groupSnapshots].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt) || left.id.localeCompare(right.id));
  let wasActive = false;
  let activationSnapshot: EarningsExpectationSnapshot | null = null;
  let activationCandidateRootIds: string[] = [];
  for (let index = 0; index < orderedAuditChanges.length; index += 1) {
    const replaySnapshots = orderedAuditChanges.slice(0, index + 1);
    const replayNodes = resolveEffectiveBusinessHistory(replaySnapshots, timeZone);
    const replayCurrent = replayNodes.find((node) => node.businessRootSnapshot.id === currentNode.businessRootSnapshot.id);
    const replayResolution = replayCurrent ? resolveUniquePreviousBusinessNode(replayCurrent, replayNodes) : null;
    const isActive = replayResolution?.reasonCode === warningCode;
    if (isActive && !wasActive) {
      activationSnapshot = orderedAuditChanges[index];
      activationCandidateRootIds = [...new Set(replayResolution.candidateNodes.map((node) => node.businessRootSnapshot.id))].sort();
    }
    wasActive = isActive;
  }
  const candidateBusinessRootSnapshotIds = [...new Set(currentResolution.candidateNodes.map((node) => node.businessRootSnapshot.id))].sort();
  const candidateEffectiveSnapshotIds = [...new Set(currentResolution.candidateNodes.map((node) => node.effectiveSnapshot.id))].sort();
  const fallbackActivation = currentNode.businessRootSnapshot;
  const activation = activationSnapshot ?? fallbackActivation;
  const activationEntityIds = [activation.id];
  const key = [
    "business_order",
    warningCode,
    currentNode.businessRootSnapshot.id,
    activation.id,
    ...(activationCandidateRootIds.length ? activationCandidateRootIds : candidateBusinessRootSnapshotIds),
  ].join("|");
  return {
    key,
    status: wasActive ? "active" : "resolved",
    warningCode,
    stateActivatedAt: isPreciseInstant(activation.createdAt) ? new Date(Date.parse(activation.createdAt)).toISOString() : null,
    activationEntityIds,
    currentBusinessRootSnapshotId: currentNode.businessRootSnapshot.id,
    currentEffectiveSnapshotId: currentNode.effectiveSnapshot.id,
    candidateBusinessRootSnapshotIds,
    candidateEffectiveSnapshotIds,
  };
}

function businessOrderCandidates(previousResolution: PreviousBusinessNodeResolution): EarningsExpectationBusinessOrderCandidate[] {
  return [...previousResolution.candidateNodes]
    .sort((left, right) => left.businessRootSnapshot.id.localeCompare(right.businessRootSnapshot.id))
    .map((candidate) => ({
      businessRootSnapshotId: candidate.businessRootSnapshot.id,
      effectiveSnapshotId: candidate.effectiveSnapshot.id,
      sourceName: candidate.effectiveSnapshot.sourceName,
      formationTime: candidate.effectiveFormationTime,
      availableAt: candidate.availableAt,
    }));
}

function resolveWarningEpisode(
  businessRootSnapshot: EarningsExpectationSnapshot,
  correctionChain: EarningsExpectationSnapshot[],
  warningCodes: EarningsExpectationWarningCode[],
  comparison: EarningsExpectationComparison | null,
): WarningEpisodeResolution {
  const chain = correctionChain.length ? correctionChain : [businessRootSnapshot];
  const components = [...new Set(warningCodes)].sort().map((code) => {
    if (code === "actual_value_unavailable" || code === "disclosure_scope_uncertain") {
      const decisive = comparison?.decisiveDisclosureEvent ?? comparison?.earliestConfirmedDisclosure ?? comparison?.earliestPossibleDisclosure ?? null;
      const entityId = decisive?.eventId ?? comparison?.actualEventId ?? businessRootSnapshot.id;
      const activatedAt = decisive && isPreciseInstant(decisive.occurredAt)
        ? new Date(Date.parse(decisive.occurredAt)).toISOString()
        : entityId === businessRootSnapshot.id && isPreciseInstant(businessRootSnapshot.createdAt)
          ? new Date(Date.parse(businessRootSnapshot.createdAt)).toISOString()
          : null;
      return { code, entityId, activatedAt };
    }
    const states = chain.map((candidate) => snapshotWarningCodeActive(code, candidate));
    if (states[states.length - 1]) {
      let activationIndex = states.length - 1;
      while (activationIndex > 0 && states[activationIndex - 1]) activationIndex -= 1;
      const activation = chain[activationIndex];
      return { code, entityId: activation.id, activatedAt: isPreciseInstant(activation.createdAt) ? new Date(Date.parse(activation.createdAt)).toISOString() : null };
    }
    return {
      code,
      entityId: businessRootSnapshot.id,
      activatedAt: isPreciseInstant(businessRootSnapshot.createdAt) ? new Date(Date.parse(businessRootSnapshot.createdAt)).toISOString() : null,
    };
  });
  const activationEntityIds = components.map((component) => component.entityId);
  const stateActivatedAt = latestPreciseInstant(components.map((component) => component.activatedAt));
  const key = [businessRootSnapshot.id, ...components.map((component) => `${component.code}:${component.entityId}`)].join("|");
  return { key, activationEntityIds, stateActivatedAt };
}

function snapshotWarningCodeActive(code: EarningsExpectationWarningCode, snapshot: EarningsExpectationSnapshot) {
  const availability = getExpectationAvailability(snapshot);
  if (code === "availability_uncertain") return availability.status === "uncertain";
  if (code === "source_verification_pending") return snapshot.sourceVerificationStatus !== "verified";
  if (code === "source_time_unresolved") return snapshot.sourcePublishedAtResolution === "unresolved_legacy";
  if (code === "audit_time_invalid") return !isPreciseInstant(snapshot.createdAt);
  return false;
}

function latestPreciseInstant(values: Array<string | null>) {
  const precise = values.filter((value): value is string => isPreciseInstant(value));
  return precise.sort((left, right) => Date.parse(left) - Date.parse(right))[precise.length - 1] ?? null;
}

function dedupe(events: ResearchEvent[]) { return [...new Map(events.map((event) => [event.id, event])).values()]; }
function warningCodesFor(snapshot: EarningsExpectationSnapshot, comparison: EarningsExpectationComparison | null): EarningsExpectationWarningCode[] {
  const codes = new Set<EarningsExpectationWarningCode>(comparison?.structuredWarningCodes ?? []);
  for (const code of comparison?.nonComparableReasonCodes ?? []) codes.add(code);
  codes.delete("business_order_ambiguous");
  codes.delete("business_order_equal");
  codes.delete("business_order_unresolved");
  if (getExpectationAvailability(snapshot).status === "uncertain") codes.add("availability_uncertain");
  if (snapshot.sourceVerificationStatus !== "verified") codes.add("source_verification_pending");
  if (snapshot.sourcePublishedAtResolution === "unresolved_legacy") codes.add("source_time_unresolved");
  if (comparison?.performanceDisclosureUncertain) codes.add("disclosure_scope_uncertain");
  if (!comparison?.actualEventId) codes.add("actual_value_unavailable");
  if (!codes.size) codes.add("source_verification_pending");
  return [...codes].sort();
}
function compareResearchEventTime(left: ResearchEvent, right: ResearchEvent, timeZone: string) {
  void timeZone;
  const leftOccurredAt = expectationEventOccurredAt(left);
  const rightOccurredAt = expectationEventOccurredAt(right);
  if (leftOccurredAt && rightOccurredAt) {
    const canonical = compareCanonicalBusinessTemporal(leftOccurredAt, rightOccurredAt);
    if (!canonical.uncertain) return canonical.order;
  }
  const calendarOrder = (left.eventBusinessDate ?? left.eventDate ?? "").localeCompare(right.eventBusinessDate ?? right.eventDate ?? "");
  if (calendarOrder) return calendarOrder;
  const leftValue = left.stateActivatedAt ?? left.detectedAt ?? left.eventOccurredAt ?? left.publishedAt ?? left.recordedAt ?? left.updatedAt ?? "";
  const rightValue = right.stateActivatedAt ?? right.detectedAt ?? right.eventOccurredAt ?? right.publishedAt ?? right.recordedAt ?? right.updatedAt ?? "";
  if (isPreciseInstant(leftValue) && isPreciseInstant(rightValue)) return Date.parse(leftValue) - Date.parse(rightValue);
  return leftValue.localeCompare(rightValue);
}
function expectationEventOccurredAt(event: ResearchEvent) {
  if (!event.expectation) return null;
  if (event.eventType === "earnings_expectation_data_warning") {
    const detectedAt = event.stateActivatedAt ?? event.detectedAt;
    if (!detectedAt) return null;
    return toCanonicalBusinessTemporal({ value: detectedAt, precision: "datetime", resolution: "absolute", interpretationTimeZone: null, businessCalendarDate: getCalendarDateInTimeZone(detectedAt, "UTC") });
  }
  if (event.eventOccurredAt || event.eventType === "earnings_expectation_correction" || event.eventType === "earnings_expectation_comparison_available") {
    const occurredAt = event.eventOccurredAt ?? event.publishedAt ?? event.eventBusinessDate ?? event.eventDate;
    if (!occurredAt) return null;
    return toCanonicalBusinessTemporal({
      value: occurredAt,
      precision: isPreciseInstant(occurredAt) ? "datetime" : "date",
      resolution: isPreciseInstant(occurredAt) ? "absolute" : "date",
      interpretationTimeZone: null,
      businessCalendarDate: event.eventBusinessDate ?? event.eventDate,
    });
  }
  return event.expectation.availableAt?.status === "resolved" ? event.expectation.availableAt.value : null;
}
function metricLabel(metric: EarningsExpectationSnapshot["metric"]) { return ({ revenue: "营业收入", attributable_net_profit: "归母净利润", adjusted_net_profit: "扣非净利润", eps: "每股收益", operating_cash_flow: "经营现金流" })[metric]; }
function periodScopeLabel(scope: EarningsExpectationSnapshot["periodScope"]) { return ({ single_quarter: "单季度", year_to_date: "年初至今累计", half_year: "半年度", first_three_quarters: "前三季度累计", full_year: "全年度", ttm: "TTM" })[scope]; }
function formatExpectation(snapshot: EarningsExpectationSnapshot) { const suffix = snapshot.metric === "eps" ? `${snapshot.currency}/股` : unitLabel(snapshot.unit); return snapshot.estimateShape === "point" ? `点预测 ${snapshot.value ?? "缺失"} ${suffix}` : `区间 ${snapshot.lowerBound ?? "缺失"} 至 ${snapshot.upperBound ?? "缺失"} ${suffix}`; }
function unitLabel(unit: EarningsExpectationSnapshot["unit"]) { return ({ yuan: "元", ten_thousand_yuan: "万元", million_yuan: "百万元", hundred_million_yuan: "亿元", currency_per_share: "每股" })[unit]; }
function stableHash(value: string) { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(36); }
