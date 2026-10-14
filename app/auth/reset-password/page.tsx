"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

// Landing page for the link in the "reset your password" email (sent from
// /auth via supabase.auth.resetPasswordForEmail with redirectTo pointing
// here). Supabase's client automatically reads the recovery token out of
// the URL on load and fires a PASSWORD_RECOVERY auth event once it's
// established a temporary session from it -- this page just waits for
// that, then lets the person set a new password.
export default function ResetPasswordPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    // If the recovery session was already established just before this
    // listener was attached (a real race in practice), fall back to a
    // plain session check so the form doesn't stay stuck waiting.
    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (sessionData.session) setReady(true);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setDone(true);
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
          Set a new password
        </p>

        {done ? (
          <div>
            <div className="bg-green-50 text-green-700 px-3 py-2 rounded-lg text-sm mb-4">
              Password updated. You can sign in with your new password now.
            </div>
            <button
              onClick={() => router.push("/auth")}
              className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg py-2.5 font-semibold"
            >
              Go to Sign In
            </button>
          </div>
        ) : !ready ? (
          <p className="text-sm text-zinc-500">
            Checking your reset link... If this doesn&apos;t change in a few
            seconds, the link may have expired -- request a new one from the
            Sign In page.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm text-zinc-700 mb-1">
                New password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Minimum 6 characters"
                className="w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-700 mb-1">
                Confirm new password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg py-2.5 font-semibold disabled:opacity-50"
            >
              {loading ? "Please wait..." : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
