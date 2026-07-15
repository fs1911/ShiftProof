import { canManage, getAppContext } from "@/lib/auth/context";
import { buildCsv, getRunsForExport, parseRange } from "@/lib/data/reports";

export const dynamic = "force-dynamic";

/** Streams a CSV of routine runs for the active location and date range. */
export async function GET(request: Request): Promise<Response> {
  const ctx = await getAppContext();
  if (!ctx.ok) return new Response("Unauthorized", { status: 401 });
  if (!canManage(ctx.context.role)) return new Response("Forbidden", { status: 403 });

  const { searchParams } = new URL(request.url);
  const range = parseRange({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });

  const rows = await getRunsForExport(ctx.context.locationId, range);
  const csv = buildCsv(
    ["Started at", "Routine", "Status", "Completed at", "Notes"],
    rows.map((r) => [r.started_at, r.routine_name, r.status, r.completed_at, r.notes]),
  );

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="shiftproof-runs-${range.label}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
