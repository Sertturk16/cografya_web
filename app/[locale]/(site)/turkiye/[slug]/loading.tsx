import { PageSkeleton } from "@/components/patterns/page-skeleton";

/**
 * The province page must resolve `getProvinceBySlug` before its first return — an unknown slug
 * has to be a real 404, and a `notFound()` thrown after the shell streamed cannot change the
 * status. While that lookup runs, the reader sees this. Same pieces as the page's own fallbacks.
 */
export default function Loading() {
  return <PageSkeleton shape="detail" />;
}
