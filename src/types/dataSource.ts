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
}
