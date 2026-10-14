"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Sparkles,
  Newspaper,
  TrendingUp,
  Briefcase,
  ShieldCheck,
  Gauge,
  type LucideIcon,
} from "lucide-react";

// Shared header + nav for every /admin/* dashboard page. Pulled out of
// six near-identical copies (Properties, AI Suggestions, Blog, Sales
// Pipeline, HR, Security each hand-rolled their own) so a page can't
// silently drift out of sync with the others again -- that's exactly how
// the admin nav-overlap bug happened, and how Security ended up linked
// from only one of the five dashboard pages instead of all of them.
//
// Active page is read from the URL (usePathname), not passed in, so a
// new page can't forget to mark itself current and a renamed route can't
// leave a stale highlight behind.

type AdminRoute = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const ADMIN_ROUTES: AdminRoute[] = [
  { href: "/admin/properties", label: "Property Approval", icon: Building2 },
  { href: "/admin/ai-suggestions", label: "AI Suggestions", icon: Sparkles },
  { href: "/admin/blog", label: "Blog Studio", icon: Newspaper },
  { href: "/admin/inquiries", label: "Sales Pipeline", icon: TrendingUp },
  { href: "/admin/hr", label: "HR", icon: Briefcase },
  { href: "/admin/security", label: "Security", icon: ShieldCheck },
  { href: "/admin/usage", label: "Usage & Limits", icon: Gauge },
];

export default function AdminHeader() {
  const pathname = usePathname();

  return (
    <div className="border-b border-black/10 bg-header-bg">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          {/* Distinct admin mark -- a dark monogram tile instead of the
              public site's circular photo logo, so it's obvious at a
              glance that this is the internal dashboard, not the
              public-facing site. The small shield badge nods at the
              2FA step every admin session already passes through to get
              here. */}
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-[13px] font-black tracking-tight text-white shadow-sm">
            99
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 ring-2 ring-header-bg">
              <ShieldCheck className="h-2.5 w-2.5 text-white" strokeWidth={3} />
            </span>
          </span>

          <span className="leading-tight">
            <span className="block text-sm font-black text-header-fg">
              99Bricks
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-header-fg/60">
              Admin
            </span>
          </span>
        </Link>

        <nav className="flex flex-wrap items-center gap-1.5">
          {ADMIN_ROUTES.map((route) => {
            const isActive = pathname === route.href;
            const Icon = route.icon;

            return (
              <Link
                key={route.href}
                href={route.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  isActive
                    ? "bg-white text-zinc-900"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                <span>{route.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
