export function selectDefaultCompanyGuidanceStockIds(items) {
  return Object.values(items).filter((item) => item.snapshotCount > 0 || item.excludedAnnouncementCount > 0).map((item) => item.stockId);
}

export function deriveCompanyGuidanceDetailStatus(detail) {
  const providerSnapshots = requiredArray(detail, "providerSnapshots");
  const exclusions = requiredArray(detail, "exclusions");
  const targetAnnouncements = requiredArray(detail, "targetAnnouncements");
  if (providerSnapshots.length > 0) return exclusions.length > 0 ? "partial" : "generated_real";
  return targetAnnouncements.length > 0 ? "partial" : "missing";
}

function requiredArray(detail, field) {
  if (!detail || !Array.isArray(detail[field])) throw new TypeError(`company-guidance detail ${field} must be an array`);
  return detail[field];
}
