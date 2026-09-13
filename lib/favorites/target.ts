export type FavoriteEntityType = "province" | "country" | "region" | "continent";

/** One favoritable target: province, country, region, continent, or generic polymorphic shape. */
export type FavoriteTargetParam =
  | { readonly kind: "province"; readonly plateCode: string }
  | { readonly kind: "country"; readonly isoCode: string }
  | { readonly kind: "region"; readonly slug: string }
  | { readonly kind: "continent"; readonly code: string }
  | { readonly entityType: FavoriteEntityType; readonly entityId: string };

/** The narrowed, parsed shape a caller actually needs. */
export interface FavoriteRecord {
  readonly type: FavoriteEntityType;
  readonly entityType: FavoriteEntityType;
  readonly entityId: string;
  readonly plateCode: string | null;
  readonly isoCode: string | null;
}

/** Normalizes any valid FavoriteTargetParam variant into standard entityType + entityId. */
export function normalizeFavoriteTarget(target: FavoriteTargetParam): {
  readonly entityType: FavoriteEntityType;
  readonly entityId: string;
} {
  if ("entityType" in target) {
    return { entityType: target.entityType, entityId: target.entityId };
  }
  switch (target.kind) {
    case "province":
      return { entityType: "province", entityId: target.plateCode };
    case "country":
      return { entityType: "country", entityId: target.isoCode };
    case "region":
      return { entityType: "region", entityId: target.slug };
    case "continent":
      return { entityType: "continent", entityId: target.code };
  }
}

/** Checks whether a FavoriteRecord matches a target param across all 4 entity types. */
export function isFavoriteMatch(target: FavoriteTargetParam, record: FavoriteRecord): boolean {
  const norm = normalizeFavoriteTarget(target);
  return (
    (record.entityType === norm.entityType || record.type === norm.entityType) &&
    (record.entityId === norm.entityId ||
      (norm.entityType === "province" && record.plateCode === norm.entityId) ||
      (norm.entityType === "country" && record.isoCode === norm.entityId))
  );
}
