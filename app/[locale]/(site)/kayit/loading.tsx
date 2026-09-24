import { PageSkeleton } from "@/components/patterns/page-skeleton";

/**
 * `/kayit` is `force-dynamic` because the province list feeds a required registration-form
 * field (see the page's own docblock). Renders the same auth-shape pieces the page uses as its
 * own Suspense fallback, so the swap to the page shell moves nothing.
 */
export default function Loading() {
  return <PageSkeleton shape="auth" />;
}
