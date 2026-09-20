import type { WikiOwners, WikiEvidenceRef, WikiResolvedEvidence } from '../types/wiki';
import type { CreatorViewpointRepository } from './creatorViewpointRepository';
import type { IndustryMetricProvider } from './industryMetricRegistry.mjs';
import { CreatorResearchExtractionRepository } from './researchExtractionRepository';
import { industryChartAudit } from './industryMetricProvider';
import { industries } from '../data/industries';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import { wikiRequire } from './wiki';

export interface WikiEvidenceOption extends WikiResolvedEvidence { label: string }
/** Original Registry provider has already checked owner bytes/pins. No copied evidence store. */
export function createWikiOwners(creatorOwner: Pick<CreatorViewpointRepository, 'load'>, industry?: IndustryMetricProvider): WikiOwners & { listEvidence(asOf: string): WikiEvidenceOption[] } {
  const research = new CreatorResearchExtractionRepository(creatorOwner);
  const listEvidence = (asOf: string): WikiEvidenceOption[] => industries.flatMap(industryRow => (industry?.list(industryRow.id) ?? []).flatMap(metric =>
    metric.owner.observations.flatMap((observation, index) => {
      const availableAt = [metric.owner.generatedAt, observation.generatedAt, observation.acquiredAt].sort((a, b) => Date.parse(b) - Date.parse(a))[0];
      if (!Number.isFinite(Date.parse(availableAt)) || Date.parse(availableAt) > Date.parse(asOf)) return [];
      const ref: WikiEvidenceRef = { owner: metric.entry.artifactRef.owner, sha256: metric.entry.artifactRef.sha256,
        version: metric.entry.artifactRef.version, objectId: observation.id, locator: `/observations/${index}/provenance/evidence` };
      return [{ ref, evidence: observation.provenance.evidence, availableAt,
        label: `${metric.owner.definition.canonicalName} · ${observation.valueDate} · ${observation.basis}`,
        audit: { ...industryChartAudit(metric.owner, observation.basis, metric.entry), records: industryChartAudit(metric.owner, observation.basis, metric.entry).records.filter(row => row.title.endsWith(` · ${observation.id}`)) } }];
    })));
  return {
    research: asOf => research.read(asOf), listEvidence,
    evidence(ref, asOf) {
      const matches = listEvidence(asOf).filter(row => canonicalJson(row.ref) === canonicalJson(ref));
      wikiRequire(matches.length === 1, 'WIKI_EVIDENCE_MISSING_FOREIGN_OR_NOT_VISIBLE'); return matches[0];
    },
    related(refs, asOf) {
      // Entity Registry is Node-only. No browser mapping is inferred from topic labels.
      wikiRequire(refs.entities.length === 0, 'WIKI_ENTITY_OWNER_UNAVAILABLE');
      wikiRequire(refs.industryIds.every(id => industries.some(row => row.id === id)), 'WIKI_INDUSTRY_REF_MISSING');
      if (refs.topicRefs.length) {
        const loaded = creatorOwner.load();
        wikiRequire(loaded.error === null && loaded.corruptedRaw === null && loaded.recoveryStatus == null, 'WIKI_TOPIC_OWNER_UNAVAILABLE');
        wikiRequire(refs.topicRefs.every(ref => ref.owner === 'creator_viewpoint_topic' && loaded.data.topics.some(topic => topic.id === ref.topicId && Date.parse(topic.recordedAt) <= Date.parse(asOf))), 'WIKI_TOPIC_REF_MISSING_OR_FOREIGN');
      }
    },
  };
}
