import { NextResponse } from "next/server";
import { handleDeleteFavorite, handlePutFavorite } from "@/lib/favorites/transport.server";
import type { FavoriteEntityType } from "@/lib/favorites/client";

/**
 * Polymorphic route handler for favorites: PUT and DELETE /api/favorites/:entityType/:entityId.
 * Supports all 4 entity types: "province" | "country" | "region" | "continent".
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

const VALID_ENTITY_TYPES: ReadonlySet<string> = new Set<FavoriteEntityType>([
  "province",
  "country",
  "region",
  "continent",
]);

async function handlePut(
  request: Request,
  ctx: { params: Promise<{ entityType: string; entityId: string }> },
) {
  const { entityType, entityId } = await ctx.params;
  if (!VALID_ENTITY_TYPES.has(entityType)) {
    return NextResponse.json(
      { ok: false, code: "errors.transport.invalidRequest" },
      { status: 400 },
    );
  }
  const result = await handlePutFavorite(request, {
    entityType: entityType as FavoriteEntityType,
    entityId,
  });
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

async function handleDelete(
  request: Request,
  ctx: { params: Promise<{ entityType: string; entityId: string }> },
) {
  const { entityType, entityId } = await ctx.params;
  if (!VALID_ENTITY_TYPES.has(entityType)) {
    return NextResponse.json(
      { ok: false, code: "errors.transport.invalidRequest" },
      { status: 400 },
    );
  }
  const result = await handleDeleteFavorite(request, {
    entityType: entityType as FavoriteEntityType,
    entityId,
  });
  // IRIS91-C1: Fetch/Response constructor forbids non-null body with 204
  if (result.status === 204) {
    return new NextResponse(null, { status: 204, headers: result.headers });
  }
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

export const PUT = handlePut;
export const DELETE = handleDelete;
