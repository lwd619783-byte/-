export type DataSourceStatus = "mock" | "real" | "stale" | "missing" | "error" | "unsupported_market";
export type DashboardDataMode = "mock" | "real" | "mixed";

export interface DataQualityMeta {
  source: string;
  sourceLayer?: string;
  sourceEndpoint?: string;
  sourceUrl?: string;
  updatedAt?: string;
  status: DataSourceStatus;
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
      unsupported: number;
      unsupportedTotal: number;
    }
  >;
  universeWarnings?: string[];
}
