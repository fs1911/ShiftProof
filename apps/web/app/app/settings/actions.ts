"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ACTIVE_LOCATION_COOKIE, getAppContext } from "@/lib/auth/context";
import { getAppBaseUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/db";

const ROLES: UserRole[] = ["owner", "manager", "staff"];
const LOCATIONS_PATH = "/app/settings/locations";
const MEMBERS_PATH = "/app/settings/members";

/**
 * Onboarding writes. Location creation and membership changes go through
 * SECURITY DEFINER RPCs (create_location, add_member_by_email, set_member_role,
 * remove_member) invoked with the RLS-governed client — never the service-role
 * key. Those functions enforce the role rules; these actions add clear UX and
 * map error codes to friendly messages.
 */

/** Create a location; the caller becomes its owner and it becomes active. */
export async function createLocation(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim() || "UTC";

  if (!name) {
    redirect(`${LOCATIONS_PATH}?error=${encodeURIComponent("Location name is required.")}`);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("create_location", {
    p_name: name,
    p_timezone: timezone,
  });

  if (error) {
    redirect(`${LOCATIONS_PATH}?error=${encodeURIComponent(mapError(error.message))}`);
  }

  // Make the new location active so the owner lands in its context.
  if (typeof data === "string") {
    cookies().set(ACTIVE_LOCATION_COOKIE, data, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  revalidatePath(LOCATIONS_PATH);
  redirect(MEMBERS_PATH);
}

/** Rename / retime / activate a location (owner-only, enforced by RLS). */
export async function updateLocation(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim() || "UTC";
  // An unchecked checkbox is absent from the form data → treat as inactive.
  const isActive = formData.get("is_active") != null;

  if (!id) redirect(LOCATIONS_PATH);
  if (!name) {
    redirect(`${LOCATIONS_PATH}?error=${encodeURIComponent("Location name is required.")}`);
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("locations")
    .update({ name, timezone, is_active: isActive })
    .eq("id", id);

  if (error) {
    redirect(`${LOCATIONS_PATH}?error=${encodeURIComponent(mapError(error.message))}`);
  }
  revalidatePath(LOCATIONS_PATH);
  redirect(LOCATIONS_PATH);
}

/** Add an existing user to the active location by email with a role. */
export async function addMember(formData: FormData): Promise<void> {
  const ctx = await requireManagerContext();
  const email = String(formData.get("email") ?? "").trim();
  const role = asRole(String(formData.get("role") ?? "staff"));

  if (!email) {
    redirect(`${MEMBERS_PATH}?error=${encodeURIComponent("Enter the person's email.")}`);
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("add_member_by_email", {
    p_location_id: ctx.locationId,
    p_email: email,
    p_role: role,
  });

  if (error) {
    redirect(`${MEMBERS_PATH}?error=${encodeURIComponent(mapError(error.message))}`);
  }
  revalidatePath(MEMBERS_PATH);
  redirect(MEMBERS_PATH);
}

/** Change a member's role in the active location (owner-only, per the RPC). */
export async function changeMemberRole(formData: FormData): Promise<void> {
  const ctx = await requireManagerContext();
  const userId = String(formData.get("user_id") ?? "");
  const role = asRole(String(formData.get("role") ?? "staff"));
  if (!userId) redirect(MEMBERS_PATH);

  const supabase = createClient();
  const { error } = await supabase.rpc("set_member_role", {
    p_location_id: ctx.locationId,
    p_user_id: userId,
    p_role: role,
  });

  if (error) {
    redirect(`${MEMBERS_PATH}?error=${encodeURIComponent(mapError(error.message))}`);
  }
  revalidatePath(MEMBERS_PATH);
  redirect(MEMBERS_PATH);
}

/** Remove a member from the active location. */
export async function removeMember(formData: FormData): Promise<void> {
  const ctx = await requireManagerContext();
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) redirect(MEMBERS_PATH);

  const supabase = createClient();
  const { error } = await supabase.rpc("remove_member", {
    p_location_id: ctx.locationId,
    p_user_id: userId,
  });

  if (error) {
    redirect(`${MEMBERS_PATH}?error=${encodeURIComponent(mapError(error.message))}`);
  }
  revalidatePath(MEMBERS_PATH);
  redirect(MEMBERS_PATH);
}

/**
 * Invite someone to the active location by email + role.
 *
 * New person: create their auth account via Supabase invite (they set a password
 * from the email link, landing on /auth/update-password) and provision their
 * profile + first membership. Existing person: fall back to add_member_by_email.
 *
 * Owner/manager only; only an owner may grant owner/manager. The service-role
 * admin client is used ONLY to create the auth user and its first membership —
 * this action first enforces the same role rules the RLS RPCs would.
 */
export async function inviteMember(formData: FormData): Promise<void> {
  const ctx = await requireManagerContext();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = asRole(String(formData.get("role") ?? "staff"));

  if (!email) {
    redirect(`${MEMBERS_PATH}?error=${encodeURIComponent("Enter the person's email.")}`);
  }
  // Only owners may grant elevated roles; managers may invite staff only.
  if ((role === "owner" || role === "manager") && ctx.role !== "owner") {
    redirect(
      `${MEMBERS_PATH}?error=${encodeURIComponent("Only owners can invite managers or owners.")}`,
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${getAppBaseUrl()}/auth/callback?next=/auth/update-password`,
  });

  if (error) {
    // Already-registered users can't be invited again — add them directly.
    if (isAlreadyRegistered(error.message)) {
      const supabase = createClient();
      const { error: addErr } = await supabase.rpc("add_member_by_email", {
        p_location_id: ctx.locationId,
        p_email: email,
        p_role: role,
      });
      if (addErr) {
        redirect(`${MEMBERS_PATH}?error=${encodeURIComponent(mapError(addErr.message))}`);
      }
      revalidatePath(MEMBERS_PATH);
      redirect(`${MEMBERS_PATH}?ok=${encodeURIComponent("Existing account added to this location.")}`);
    }
    redirect(`${MEMBERS_PATH}?error=${encodeURIComponent(mapError(error.message))}`);
  }

  const newUserId = data.user?.id;
  if (!newUserId) {
    redirect(`${MEMBERS_PATH}?error=${encodeURIComponent("The invite could not be created.")}`);
  }

  // Provision the profile + first membership. The admin client bypasses RLS;
  // the role rules were enforced above. Idempotent upserts.
  await admin.from("users").upsert({ id: newUserId, email }, { onConflict: "id" });
  const { error: memErr } = await admin
    .from("user_locations")
    .upsert(
      { user_id: newUserId, location_id: ctx.locationId, role },
      { onConflict: "user_id,location_id" },
    );
  if (memErr) {
    redirect(`${MEMBERS_PATH}?error=${encodeURIComponent(memErr.message)}`);
  }

  revalidatePath(MEMBERS_PATH);
  redirect(`${MEMBERS_PATH}?ok=${encodeURIComponent(`Invite sent to ${email}.`)}`);
}

/**
 * Re-send the set-password email to a pending member (owner/manager only).
 * Uses resetPasswordForEmail — which for an invited, not-yet-accepted account
 * delivers a fresh link to set a password (via the recovery email template →
 * /auth/confirm → /auth/update-password). The target is confined to a member of
 * the active location (looked up via the manager-gated RPC), so a manager can't
 * trigger emails to arbitrary addresses.
 */
export async function resendInvite(formData: FormData): Promise<void> {
  const ctx = await requireManagerContext();
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) redirect(MEMBERS_PATH);

  const supabase = createClient();
  const { data, error: listErr } = await supabase.rpc("list_location_members", {
    p_location_id: ctx.locationId,
  });
  if (listErr) {
    redirect(`${MEMBERS_PATH}?error=${encodeURIComponent(mapError(listErr.message))}`);
  }
  const member = ((data ?? []) as { user_id: string; email: string }[]).find(
    (m) => m.user_id === userId,
  );
  if (!member?.email) {
    redirect(`${MEMBERS_PATH}?error=${encodeURIComponent("That person is no longer a member.")}`);
  }

  const { error } = await supabase.auth.resetPasswordForEmail(member.email, {
    redirectTo: `${getAppBaseUrl()}/auth/callback?next=/auth/update-password`,
  });
  if (error) {
    redirect(`${MEMBERS_PATH}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(MEMBERS_PATH);
  redirect(`${MEMBERS_PATH}?ok=${encodeURIComponent(`Invite re-sent to ${member.email}.`)}`);
}

/** Does an auth error mean the email already has an account? */
function isAlreadyRegistered(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("already") ||
    m.includes("registered") ||
    m.includes("exists") ||
    m.includes("duplicate")
  );
}

async function requireManagerContext() {
  const result = await getAppContext();
  if (!result.ok) {
    redirect(`${MEMBERS_PATH}?error=${encodeURIComponent("Your account is not assigned to a location yet.")}`);
  }
  if (result.context.role === "staff") {
    redirect(`${MEMBERS_PATH}?error=${encodeURIComponent("Only managers and owners can manage members.")}`);
  }
  return result.context;
}

function asRole(value: string): UserRole {
  return (ROLES as string[]).includes(value) ? (value as UserRole) : "staff";
}

/** Map RPC error codes to friendly, actionable messages. */
function mapError(message: string): string {
  if (message.includes("USER_NOT_FOUND")) {
    return "No ShiftProof account with that email. Ask them to sign up first, then add them.";
  }
  if (message.includes("ALREADY_MEMBER")) return "That person is already a member of this location.";
  if (message.includes("LAST_OWNER")) return "You can't remove or demote the last owner.";
  if (message.includes("NOT_ALLOWED")) return "You don't have permission to do that.";
  if (message.includes("NOT_A_MEMBER")) return "That person is no longer a member.";
  if (message.includes("NAME_REQUIRED")) return "Location name is required.";
  if (message.includes("NOT_AUTHENTICATED")) return "Please sign in again.";
  return message;
}
