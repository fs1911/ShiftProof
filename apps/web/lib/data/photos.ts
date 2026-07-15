import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Photo, PhotoWithUrl } from "@/types/db";

export const PHOTO_BUCKET = "shift-photos";
const SIGNED_URL_TTL_SECONDS = 300;

const PHOTO_COLUMNS =
  "id, task_run_id, location_id, storage_path, caption, uploaded_by, created_at";

/**
 * Photos for a set of task runs, grouped by task_run_id, each with a short-lived
 * signed URL generated server-side. RLS scopes both the metadata rows and the
 * Storage objects to the caller's location(s).
 */
export async function getRunPhotos(
  taskRunIds: string[],
): Promise<{ byTaskRun: Record<string, PhotoWithUrl[]>; error: string | null }> {
  if (taskRunIds.length === 0) return { byTaskRun: {}, error: null };

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("photos")
      .select(PHOTO_COLUMNS)
      .in("task_run_id", taskRunIds)
      .order("created_at", { ascending: true });

    if (error) return { byTaskRun: {}, error: error.message };

    const photos = (data ?? []) as Photo[];
    const signedByPath = await signPaths(
      supabase,
      photos.map((p) => p.storage_path),
    );

    const byTaskRun: Record<string, PhotoWithUrl[]> = {};
    for (const photo of photos) {
      const withUrl: PhotoWithUrl = {
        ...photo,
        signed_url: signedByPath.get(photo.storage_path) ?? null,
      };
      (byTaskRun[photo.task_run_id] ??= []).push(withUrl);
    }

    return { byTaskRun, error: null };
  } catch (err) {
    return {
      byTaskRun: {},
      error: err instanceof Error ? err.message : "Unknown error loading photos.",
    };
  }
}

async function signPaths(
  supabase: ReturnType<typeof createClient>,
  paths: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;

  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  if (error || !data) return map;
  for (const item of data) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return map;
}
