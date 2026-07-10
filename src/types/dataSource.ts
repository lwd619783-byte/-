export type DataSourceStatus = "mock" | "real" | "partial" | "stale" | "missing" | "error" | "not_implemented" | "unsupported_market" | "conflicted" | "source_unavailable";
export type EvidenceSourceType = "real" | "generated_real" | "manual_verified" | "manual_unverified" | "static_reference" | "inferred" | "mock" | "placeholder" | "stale" | "conflicted" | "partial" | "not_implemented" | "source_unavailable" | "unknown";

export interface DataFreshness {
  fetchedAt: string | null;
  sourceUpdatedAt: string | null;
  generatedAt: string | null;
  status: EvidenceSourceType;
  error: string | null;
  isStale: boolean | null;
  staleReason: string | null;
}

export interface DataSourceRegistryEntry {
  id: string;
  category: string;
  market: string | null;
  status: EvidenceSourceType;
  provider: string | null;
  sourceType: EvidenceSourceType;
  sourceUrl: string | null;
  sourceDescription: string | null;
  storageLocation: string | null;
  generatedBy: string | null;
  refreshMethod: string | null;
  refreshFrequency: string | null;
  lastUpdated: string | null;
  coverage: { numerator: number | null; denominator: number | null; note?: string } | null;
  frontendConsumers: string[];
  fallbackBehavior: string | null;
  isDisplayed: boolean | null;
  verificationStatus: string | null;
  knownLimitations: string[];
  notes: string | null;
}
export type DashboardDataMode = "mock" | "real" | "mixed";

export interface DataQualityMeta {
  source: string;
  sourceLayer?: string;
  sourceEndpoint?: string;
  sourceUrl?: string;
  updatedAt?: string;
  status: DataSourceStatus | EvidenceSourceType;
  errorMessage?: string;
}

export interface DataManifest {
  updatedAt: string | null;
  status: DashboardDataMode | "missing" | "error" | "stale";
  sourceSummary: string[];
  errors: string[];
  generatedAt?: string;
  universe?: {
    total: number;
    markets: Partial<Record<"A股" | "港股" | "美股" | "未上市", number>>;
    supported?: Partial<Record<"A股" | "港股" | "美股" | "未上市", number>>;
    unsupported?: Partial<Record<"A股" | "港股" | "美股" | "未上市", number>>;
    privateCompanies?: number;
    source?: string;
  };
  coverage?: Record<
    string,
    {
      real: number;
      total: number;
      pct: number;
      missing: string[];
      partial?: string[];
      unsupported: number;
      unsupportedTotal: number;
      status?: string;
    }
  >;
  universeWarnings?: string[];
}
