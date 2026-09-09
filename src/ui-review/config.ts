export type UiReviewProfile = "full" | "empty" | "degraded";
export const UI_REVIEW_LABEL = "界面验收样例 / 合成数据 / 不用于投资研究";
/** Only the explicit query switch enables review. Hash routes/data modes cannot. */
export function readUiReview(search: string): { profile: UiReviewProfile } | null {
  const query = new URLSearchParams(search);
  if (query.get("ui-review") !== "1") return null;
  const value = query.get("profile");
  return { profile: value === "empty" || value === "degraded" ? value : "full" };
}
