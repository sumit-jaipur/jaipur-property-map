"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Factor } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";

type TotpFactor = Factor<"totp">;

// Account Security -- where an admin turns on two-factor authentication
// (TOTP, the same kind of 6-digit code as Google Authenticator / Authy)
// for their own login, and can remove it again later. Reachable by any
// admin at AAL1 (password-only) so a first-time enrollment is always
// possible, but once a verified factor already exists, adding another
// one or removing the existing one requires a fresh AAL2 step-up first
// (enforced here for a clear UI message, and enforced again by Supabase
// itself regardless of what this page allows).
export default function AdminSecurityPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [isAal2, setIsAal2] = useState(false);
  const [error, setError] = useState("");

  // Enrollment flow state
  const [enrolling, setEnrolling] = useState(false);
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [removingId, setRemovingId] = useState<string | null>(null);

  async function loadPage() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/auth");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    const [{ data: factorData, error: factorError }, { data: aal }] =
      await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);

    if (factorError) {
      setError(factorError.message);
    } else {
      // `.all` includes both verified and still-unverified (abandoned
      // mid-setup) factors; the convenience `.totp` grouping only ever
      // contains verified ones, which would hide an unfinished setup.
      setFactors(
        (factorData?.all ?? []).filter(
          (f): f is TotpFactor => f.factor_type === "totp"
        )
      );
    }

    setIsAal2(aal?.currentLevel === "aal2");
    setLoading(false);
  }

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const verifiedFactor = factors.find((f) => f.status === "verified");

  async function startEnroll() {
    setError("");
    setSuccessMessage("");
    setEnrolling(true);

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `99Bricks Admin (${new Date().toLocaleDateString()})`,
    });

    if (enrollError || !data) {
      setEnrolling(false);
      setError(enrollError?.message || "Could not start 2FA setup.");
      return;
    }

    setEnrollFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();

    if (!enrollFactorId) return;

    setConfirming(true);
    setError("");

    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: enrollFactorId });

    if (challengeError || !challenge) {
      setConfirming(false);
      setError(challengeError?.message || "Could not verify that code.");
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrollFactorId,
      challengeId: challenge.id,
      code: code.trim(),
    });

    setConfirming(false);

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    setEnrolling(false);
    setEnrollFactorId(null);
    setQrCode(null);
    setSecret(null);
    setCode("");
    setSuccessMessage(
      "Two-factor authentication is now on. From your next sign-in, you'll need a code from your authenticator app to reach the admin dashboard."
    );

    await loadPage();
  }

  function cancelEnroll() {
    setEnrolling(false);
    setEnrollFactorId(null);
    setQrCode(null);
    setSecret(null);
    setCode("");
    setError("");
  }

  async function removeFactor(factor: TotpFactor) {
    const confirmed = window.confirm(
      factor.status === "verified"
        ? "Remove two-factor authentication? Your account will go back to password-only login."
        : "Cancel this unfinished 2FA setup?"
    );

    if (!confirmed) return;

    setRemovingId(factor.id);
    setError("");
    setSuccessMessage("");

    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: factor.id,
    });

    setRemovingId(null);

    if (unenrollError) {
      setError(unenrollError.message);
      return;
    }

    setSuccessMessage("Removed.");
    await loadPage();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-zinc-900 mb-2">
            Admins only
          </h1>
          <p className="text-zinc-500">
            This page is only available to administrators.
          </p>
        </div>
      </main>
    );
  }

  const needsStepUpToChange = !!verifiedFactor && !isAal2;

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="bg-zinc-900 px-5 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link
            href="/admin/properties"
            className="text-sm font-bold text-white"
          >
            ← Admin Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8">
        <h1 className="text-2xl font-black text-zinc-900 mb-1">
          Account Security
        </h1>
        <p className="text-sm text-zinc-500 mb-6">
          Add a second step to your admin login so a stolen or guessed
          password alone isn&apos;t enough to get in.
        </p>

        {error && (
          <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 text-green-700 px-3 py-2 rounded-lg text-sm mb-4">
            {successMessage}
          </div>
        )}

        <div className="bg-white border rounded-2xl p-6">
          <h2 className="font-bold text-zinc-900 mb-1">
            Two-Factor Authentication (2FA)
          </h2>

          {verifiedFactor ? (
            <>
              <p className="text-sm text-zinc-500 mb-4">
                Status:{" "}
                <span className="font-semibold text-green-700">
                  Enabled
                </span>{" "}
                ({verifiedFactor.friendly_name || "Authenticator app"})
              </p>

              {needsStepUpToChange ? (
                <div className="bg-amber-50 text-amber-800 px-3 py-2.5 rounded-lg text-sm">
                  To remove or change this, verify your current
                  authenticator code first.{" "}
                  <Link
                    href={`/admin/verify-2fa?next=${encodeURIComponent(
                      "/admin/security"
                    )}`}
                    className="font-semibold underline"
                  >
                    Verify now
                  </Link>
                </div>
              ) : (
                <button
                  onClick={() => removeFactor(verifiedFactor)}
                  disabled={removingId === verifiedFactor.id}
                  className="rounded-lg bg-red-50 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
                >
                  {removingId === verifiedFactor.id
                    ? "Removing..."
                    : "Remove 2FA"}
                </button>
              )}
            </>
          ) : enrolling ? (
            <div className="space-y-4">
              {qrCode ? (
                <>
                  <p className="text-sm text-zinc-600">
                    Scan this with Google Authenticator, Authy, or any TOTP
                    app, then enter the 6-digit code it shows.
                  </p>

                  <div
                    className="w-full max-w-[220px] mx-auto bg-white border rounded-xl p-3"
                    dangerouslySetInnerHTML={{ __html: qrCode }}
                  />

                  {secret && (
                    <p className="text-xs text-zinc-400 text-center break-all">
                      Can&apos;t scan? Enter this key manually:
                      <br />
                      <span className="font-mono text-zinc-600">
                        {secret}
                      </span>
                    </p>
                  )}

                  <form onSubmit={confirmEnroll} className="space-y-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      required
                      minLength={6}
                      maxLength={6}
                      placeholder="123456"
                      className="w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-center text-lg tracking-[0.3em] text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={cancelEnroll}
                        className="flex-1 rounded-lg border border-zinc-300 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={confirming || code.length < 6}
                        className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {confirming ? "Confirming..." : "Confirm & Enable"}
                      </button>
                    </div>
                  </form>

                  <p className="text-xs text-zinc-400">
                    Save the manual key above somewhere safe before
                    continuing -- it&apos;s the only way back in if you
                    ever lose this device.
                  </p>
                </>
              ) : (
                <p className="text-sm text-zinc-500">Setting up...</p>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-zinc-500 mb-4">
                Status:{" "}
                <span className="font-semibold text-zinc-700">
                  Not enabled
                </span>
              </p>

              <button
                onClick={startEnroll}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
              >
                Set up 2FA
              </button>
            </>
          )}
        </div>

        {factors.some((f) => f.status !== "verified") && (
          <div className="mt-4 bg-white border rounded-2xl p-6">
            <h2 className="font-bold text-zinc-900 mb-3 text-sm">
              Unfinished setups
            </h2>

            {factors
              .filter((f) => f.status !== "verified")
              .map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between py-1.5"
                >
                  <span className="text-sm text-zinc-500">
                    {f.friendly_name || f.id}
                  </span>

                  <button
                    onClick={() => removeFactor(f)}
                    disabled={removingId === f.id}
                    className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                  >
                    {removingId === f.id ? "..." : "Cancel"}
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </main>
  );
}
