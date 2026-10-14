import { supabase } from "./supabaseClient";

// Shared admin-access check used by every /admin/* page.
//
// Beyond the existing "is this user an admin" check, this also enforces
// that an admin who has enrolled two-factor authentication (TOTP) has
// actually completed the second step for *this* session -- Supabase
// calls this AAL2 (Authenticator Assurance Level 2), vs. AAL1 for a
// plain password-only session. Until an admin enrolls 2FA themselves
// (see /admin/security), nothing here changes: the extra step is only
// ever required once a verified factor already exists on the account,
// so there is no way to get locked out by this landing live.
export type AdminAccessResult =
  | { ok: true }
  | { ok: false; reason: "signed_out" }
  | { ok: false; reason: "not_admin" }
  | { ok: false; reason: "mfa_required" };

export async function checkAdminAccess(): Promise<AdminAccessResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, reason: "signed_out" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { ok: false, reason: "not_admin" };
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  // nextLevel === "aal2" means this account has a verified MFA factor
  // and is expected to reach aal2 to be fully signed in; currentLevel is
  // what *this particular session* has actually completed so far. If
  // they don't match, the password step passed but the 6-digit
  // authenticator code step hasn't -- send them to finish it.
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    return { ok: false, reason: "mfa_required" };
  }

  return { ok: true };
}

// Whether the signed-in user already has a verified TOTP factor on their
// account. Used by the Account Security page: if one already exists, the
// "enroll a new device" UI is gated behind a fresh AAL2 step-up, so
// someone who only has the password (but not the authenticator app)
// can't add their own factor and hand themselves a working 2FA code.
export async function hasVerifiedTotpFactor(): Promise<boolean> {
  const { data } = await supabase.auth.mfa.listFactors();
  return !!data?.totp?.some((factor) => factor.status === "verified");
}
