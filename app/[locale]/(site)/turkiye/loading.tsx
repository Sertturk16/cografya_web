import { PageSkeleton } from "@/components/patterns/page-skeleton";

/**
 * `/turkiye` is `force-dynamic`, so Next prefetches the route only down to this boundary and
 * paints it on click, before the server answers. It renders the same pieces the page uses as
 * its Suspense fallbacks, so the swap to the page shell moves nothing.
 */
export default function Loading() {
  return <PageSkeleton shape="hub" plate="turkey" />;
}
