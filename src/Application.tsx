import { lazy, Suspense } from "react";
import { AppearanceProvider } from "./components/layout/Appearance";
import { readUiReview } from "./ui-review/config";

const BusinessApp = lazy(() => import("./App"));
const ReviewApp = lazy(() => import("./ui-review/UiReviewApp"));
/** The business App (repositories, providers, exports) never mounts in UI review. */
export function Application({ search = window.location.search }: { search?: string }) {
  const review = readUiReview(search);
  return <AppearanceProvider key={review ? "review" : "business"} persist={!review}>
    <Suspense fallback={<p className="p-5">正在加载界面…</p>}>
      {review ? <ReviewApp initialProfile={review.profile} /> : <BusinessApp />}
    </Suspense>
  </AppearanceProvider>;
}
