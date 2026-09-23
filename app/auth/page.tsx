"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { ACCOUNT_TYPES, type AccountType } from "../lib/accountTypes";

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("buyer");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError("");
    setMessage("");

    if (mode === "signup" && !agreedToTerms) {
      setError(
        "Please agree to the Terms of Service and Privacy Policy to create an account."
      );
      return;
    }

    setLoading(true);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      setLoading(false);

      if (error) {
        setError(error.message);
        return;
      }

      router.push("/");
      router.refresh();
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setLoading(false);
        setError(error.message);
        return;
      }

      if (data.user) {
        // Save what kind of account this is (buyer, owner, agent,
        // broker, builder, colonizer, PG/rental manager) so it can
        // show up on their profile and on their listings later.
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({
            id: data.user.id,
            account_type: accountType,
          });

        if (profileError) {
          console.error(profileError);
        }
      }

      setLoading(false);

      setMessage(
        "Account created. Check your email if Supabase asks you to confirm your account."
      );
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border rounded-2xl shadow-sm p-7">
        <button
          onClick={() => router.push("/")}
          className="text-sm text-zinc-500 hover:text-accent mb-6"
        >
          ← Back to Home
        </button>

        <div className="flex items-center gap-2.5 mb-1">
          <img
            src="/logo.png"
            alt="99Bricks"
            className="h-9 w-9 rounded-full object-cover"
          />
          <h1 className="text-2xl font-black text-zinc-900">
            99Bricks
          </h1>
        </div>

        <p className="text-sm text-zinc-500 mt-1 mb-6">
          {mode === "signin"
            ? "Sign in to your account"
            : "Create your account"}
        </p>

        {error && (
          <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-50 text-green-700 px-3 py-2 rounded-lg text-sm mb-4">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-700 mb-1">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-700 mb-1">
              Password
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

          {mode === "signup" && (
            <div>
              <label className="block text-sm text-zinc-700 mb-2">
                I am a...
              </label>

              <div className="grid grid-cols-2 gap-2">
                {ACCOUNT_TYPES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAccountType(option.value)}
                    className={`rounded-lg border px-3 py-2.5 text-left text-xs transition ${
                      accountType === option.value
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                    }`}
                  >
                    <span className="block font-semibold">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-zinc-500">
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "signup" && (
            <label className="flex items-start gap-2.5 text-sm text-zinc-600">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-red-600 focus:ring-red-200"
              />
              <span>
                I agree to the{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  className="font-semibold text-red-600 hover:underline"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="font-semibold text-red-600 hover:underline"
                >
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading || (mode === "signup" && !agreedToTerms)}
            className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg py-2.5 font-semibold disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : mode === "signin"
              ? "Sign In"
              : "Create Account"}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-zinc-600">
          {mode === "signin" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                onClick={() => {
                  setMode("signup");
                  setError("");
                  setMessage("");
                }}
                className="text-red-600 font-semibold"
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => {
                  setMode("signin");
                  setError("");
                  setMessage("");
                }}
                className="text-red-600 font-semibold"
              >
                Sign In
              </button>
            </>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-zinc-400">
          <Link href="/terms" className="hover:text-zinc-600">
            Terms of Service
          </Link>
          <span className="mx-2">·</span>
          <Link href="/privacy" className="hover:text-zinc-600">
            Privacy Policy
          </Link>
        </div>
      </div>
    </main>
  );
}