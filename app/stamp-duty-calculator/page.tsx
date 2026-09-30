import Link from "next/link";
import StampDutyCalculator from "../components/StampDutyCalculator";
import EmiCalculator from "../components/EmiCalculator";

export const metadata = {
  title: "Stamp Duty & Registration Calculator | 99Bricks",
  description:
    "Estimate stamp duty and registration fees for property purchases in Jaipur, Rajasthan.",
};

export default function StampDutyCalculatorPage() {
  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="border-b border-black/10 bg-header-bg">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="99Bricks"
              className="h-9 w-9 rounded-full object-cover shadow-sm"
            />
            <span className="text-sm font-black text-header-fg">
              99Bricks
            </span>
          </Link>

          <Link
            href="/"
            className="text-sm font-semibold text-header-fg/70 hover:text-white"
          >
            Back to listings
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
        <StampDutyCalculator />
        <EmiCalculator />
      </div>
    </main>
  );
}
