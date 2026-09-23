"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { getAccountTypeLabel } from "../lib/accountTypes";

export default function AuthButton() {
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accountTypeLabel, setAccountTypeLabel] = useState("Buyer");
  const [open, setOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);

  async function loadUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setEmail(null);
      setIsAdmin(false);
      return;
    }

    setEmail(user.email ?? null);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, account_type")
      .eq("id", user.id)
      .single();

    setIsAdmin(profile?.role === "admin");
    setAccountTypeLabel(getAccountTypeLabel(profile?.account_type));
  }

  useEffect(() => {
    loadUser();

    const { data } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();

    setEmail(null);
    setIsAdmin(false);
    setOpen(false);

    window.location.href = "/";
  }

  if (!email) {
    return (
      <Link
        href="/auth"
        className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-zinc-900 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-600 sm:px-5 sm:text-sm"
      >
        <span className="sm:hidden">Sign In / Up</span>
        <span className="hidden sm:inline">Sign In / Sign Up</span>
      </Link>
    );
  }

  const initial = email.charAt(0).toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-2.5 py-2 shadow-sm transition hover:border-red-200 hover:bg-red-50"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 text-sm font-bold text-white shadow-sm">
          {initial}
        </div>

        <div className="hidden max-w-36 text-left lg:block">
          <p className="truncate text-xs text-zinc-500">
            {accountTypeLabel}
          </p>

          <p className="truncate text-sm font-semibold text-zinc-900">
            {email}
          </p>
        </div>

        <span className="hidden text-xs text-zinc-400 sm:block">
          ▼
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-[100] mt-3 w-64 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">

          <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Account
            </p>

            <p className="mt-1 truncate text-sm font-semibold text-zinc-900">
              {email}
            </p>

            <span className="mt-1.5 inline-block rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
              {accountTypeLabel}
            </span>
          </div>

          <div className="p-2">

            {isAdmin && (
              <Link
                href="/admin/properties"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
              >
                <span>🛡️</span>
                Admin Dashboard
              </Link>
            )}

            <Link
              href="/favorites"
              onClick={() => setOpen(false)}
              className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-red-600"
            >
              <span>❤️</span>
              My Favorites
            </Link>

            <Link
              href="/my-properties"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-red-600"
            >
              <span>🏠</span>
              My Properties
            </Link>

            <Link
              href="/my-inquiries"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-red-600"
            >
              <span>💬</span>
              My Inquiries
            </Link>

            <Link
              href="/inquiries"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-red-600"
            >
              <span>📥</span>
              Seller Inbox
            </Link>

          </div>

          <div className="border-t border-zinc-100 p-2">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-zinc-700 transition hover:bg-red-50 hover:text-red-600"
            >
              <span>↪</span>
              Sign Out
            </button>
          </div>

        </div>
      )}
    </div>
  );
}