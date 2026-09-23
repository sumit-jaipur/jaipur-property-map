// Server-only Supabase client using the service_role secret key.
// This BYPASSES Row Level Security entirely -- never import this file
// from a "use client" component, and never send this key to the browser.
//
// Used by API routes to (a) confirm the caller is a logged-in admin and
// (b) write AI-generated suggestions into ai_suggestions, since that
// table intentionally has no public INSERT policy (see
// claude/ai-suggestions-migration.sql in the project docs) -- only a
// trusted server process should ever create suggestion rows.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Verifies a Supabase access token belongs to a logged-in admin
// (profiles.role === 'admin'). Returns the user id if valid, otherwise
// null. Looks the profile up via the service-role client so this check
// works regardless of what RLS policies exist on `profiles`.
export async function verifyAdmin(
  accessToken: string | null
): Promise<string | null> {
  if (!accessToken) return null;

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "admin") return null;

  return user.id;
}
