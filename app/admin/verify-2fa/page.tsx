"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

// Step-up verification: reached when an admin has signed in with their
// password (AAL1) but their account has a verified 2FA (TOTP) factor
// enrolled, so an authenticator-app code is still required before any
// /admin/* page will let them in. See app/lib/adminGuard.ts for the
// check that redirects here, and app/admin/security/page.tsx for where
// 2FA actually gets enrolled in the first place.
function Verify2FAInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/admin/properties";

  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth");
        return;
      }

      const { data, error: listError } = await supabase.auth.mfa.listFactors();

      if (listError) {
        setError(listError.message);
        setLoading(false);
        return;
      }

      // `.totp` only ever contains verified factors (unverified ones are
      // only visible via `.all`), so the first entry here is exactly the
      // one that requires a step-up code.
      const verified = data?.totp?.[0];

      if (!verified) {
        // Nothing to verify -- nothing stops them, just send them on.
        router.replace(next);
        return;
      }

      setFactorId(verified.id);
      setLoading(false);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();

    if (!factorId) return;

    setVerifying(true);
    setError("");

    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });

    if (challengeError || !challenge) {
      setVerifying(false);
      setError(challengeError?.message || "Could not start verification.");
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });

    setVerifying(false);

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    router.replace(next);
    router.refresh();
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/auth");
  }

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border rounded-2xl shadow-sm p-7">
        <div className="flex items-center gap-2.5 mb-1">
          <img
            src="/logo.png"
            alt="99Bricks"
            className="h-9 w-9 rounded-full object-cover"
          />
          <h1 className="text-2xl font-black text-zinc-900">99Bricks</h1>
        </div>

        <p className="text-sm text-zinc-500 mt-1 mb-6">
          Enter the 6-digit code from your authenticator app to continue to
          the admin dashboard.
        </p>

        {loading ? (
          <p className="text-sm text-zinc-500">Checking your account...</p>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-700 mb-1">
                  Authenticator code
                </label>

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
                  autoFocus
                  placeholder="123456"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-center text-lg tracking-[0.3em] text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </div>

              <button
                type="submit"
                disabled={verifying || code.length < 6}
                className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg py-2.5 font-semibold disabled:opacity-50"
              >
                {verifying ? "Verifying..." : "Verify & Continue"}
              </button>
            </form>

            <button
              onClick={handleSignOut}
              className="mt-5 w-full text-center text-sm text-zinc-500 hover:text-zinc-700"
            >
              Not you? Sign out
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function Verify2FAPage() {
  return (
    <Suspense fallback={null}>
      <Verify2FAInner />
    </Suspense>
  );
}
