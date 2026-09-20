import type { ResearchExtractionRepository } from '../types/researchExtraction';
import type { CreatorViewpointRepository } from './creatorViewpointRepository';
import { createCreatorResearchAdapter, type CreatorResearchAdapter } from './creatorResearchAdapter';

/** Local-first owner-backed seam. No cache, storage key, copied records or write authority. */
export class CreatorResearchExtractionRepository implements ResearchExtractionRepository {
  constructor(private readonly owner: Pick<CreatorViewpointRepository, 'load'>) {}

  read(asOf: string): CreatorResearchAdapter {
    const loaded = this.owner.load();
    // A recovery placeholder is not a valid empty history. Preserve owner lock semantics.
    if (loaded.error !== null || loaded.corruptedRaw !== null || loaded.recoveryStatus != null) throw new Error('RESEARCH_OWNER_UNAVAILABLE');
    return createCreatorResearchAdapter(loaded.data, asOf);
  }
}
