import { canManage, getAppContext } from "@/lib/auth/context";
import { buildCsv, getExceptionsForExport, parseRange } from "@/lib/data/reports";

export const dynamic = "force-dynamic";

/** Streams a CSV of exceptions for the active location and date range. */
export async function GET(request: Request): Promise<Response> {
  const ctx = await getAppContext();
  if (!ctx.ok) return new Response("Unauthorized", { status: 401 });
  if (!canManage(ctx.context.role)) return new Response("Forbidden", { status: 403 });

  const { searchParams } = new URL(request.url);
  const range = parseRange({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });

  const rows = await getExceptionsForExport(ctx.context.locationId, range);
  const csv = buildCsv(
    ["Created at", "Title", "Severity", "Status", "Description", "Resolution note", "Resolved at"],
    rows.map((r) => [
      r.created_at,
      r.title,
      r.severity,
      r.status,
      r.description,
      r.resolution_note,
      r.resolved_at,
    ]),
  );

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="shiftproof-exceptions-${range.label}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
