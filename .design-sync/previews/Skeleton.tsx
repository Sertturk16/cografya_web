import { Skeleton } from "cografya_web";

export const TextBlock = () => (
  <div className="max-w-sm space-y-2">
    <Skeleton className="h-6 w-2/3" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-5/6" />
  </div>
);

export const Tile = () => (
  <div className="grid max-w-md grid-cols-3 gap-3">
    <Skeleton className="h-20 rounded-2xl" />
    <Skeleton className="h-20 rounded-2xl" />
    <Skeleton className="h-20 rounded-2xl" />
  </div>
);
