// Browser code must not call AKShare directly. The Python script under scripts/
// owns AKShare/BaoStock/yfinance access and writes generated JSON for this provider layer.
export const akshareProviderNote =
  "AKShare is accessed only by scripts/fetch-real-data.py; frontend reads standardized generated JSON.";
