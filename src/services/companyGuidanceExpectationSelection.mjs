export function selectDefaultCompanyGuidanceStockIds(items) {
  return Object.values(items).filter((item) => item.snapshotCount > 0 || item.excludedAnnouncementCount > 0).map((item) => item.stockId);
}
