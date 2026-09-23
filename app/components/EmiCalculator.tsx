"use client";

import { useMemo, useState } from "react";

type Props = {
  defaultPrice?: number;
};

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export default function EmiCalculator({ defaultPrice }: Props) {
  const [loanAmount, setLoanAmount] = useState(
    defaultPrice
      ? Math.round((defaultPrice * 0.8) / 10000) * 10000
      : 5000000
  );
  const [interestRate, setInterestRate] = useState(8.5);
  const [tenureYears, setTenureYears] = useState(20);

  const { emi, totalInterest, totalPayment } = useMemo(() => {
    const principal = loanAmount;
    const monthlyRate = interestRate / 12 / 100;
    const months = tenureYears * 12;

    if (monthlyRate === 0 || months === 0) {
      const flatEmi = months === 0 ? 0 : principal / months;

      return {
        emi: flatEmi,
        totalInterest: 0,
        totalPayment: principal,
      };
    }

    const factor = Math.pow(1 + monthlyRate, months);
    const emiValue =
      (principal * monthlyRate * factor) / (factor - 1);
    const totalPaymentValue = emiValue * months;
    const totalInterestValue = totalPaymentValue - principal;

    return {
      emi: emiValue,
      totalInterest: totalInterestValue,
      totalPayment: totalPaymentValue,
    };
  }, [loanAmount, interestRate, tenureYears]);

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-red-500">
        Plan your budget
      </p>

      <h2 className="mt-1 text-xl font-black text-zinc-900">
        EMI Calculator
      </h2>

      <p className="mt-1 text-sm text-zinc-500">
        Estimate your monthly home loan installment for this
        property.
      </p>

      <div className="mt-6 space-y-6">
        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-zinc-700">
              Loan Amount
            </label>

            <span className="text-sm font-black text-zinc-900">
              ₹{formatINR(loanAmount)}
            </span>
          </div>

          <input
            type="range"
            min={100000}
            max={50000000}
            step={50000}
            value={loanAmount}
            onChange={(e) =>
              setLoanAmount(Number(e.target.value))
            }
            className="mt-2 w-full accent-accent"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-zinc-700">
              Interest Rate (per annum)
            </label>

            <span className="text-sm font-black text-zinc-900">
              {interestRate.toFixed(1)}%
            </span>
          </div>

          <input
            type="range"
            min={5}
            max={16}
            step={0.1}
            value={interestRate}
            onChange={(e) =>
              setInterestRate(Number(e.target.value))
            }
            className="mt-2 w-full accent-accent"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-zinc-700">
              Loan Tenure
            </label>

            <span className="text-sm font-black text-zinc-900">
              {tenureYears} {tenureYears === 1 ? "year" : "years"}
            </span>
          </div>

          <input
            type="range"
            min={1}
            max={30}
            step={1}
            value={tenureYears}
            onChange={(e) =>
              setTenureYears(Number(e.target.value))
            }
            className="mt-2 w-full accent-accent"
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-accent-soft p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-accent">
            Monthly EMI
          </p>

          <p className="mt-1 text-lg font-black text-zinc-900">
            ₹{formatINR(emi)}
          </p>
        </div>

        <div className="rounded-2xl bg-zinc-100 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
            Total Interest
          </p>

          <p className="mt-1 text-lg font-black text-zinc-900">
            ₹{formatINR(totalInterest)}
          </p>
        </div>

        <div className="rounded-2xl bg-zinc-100 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
            Total Payment
          </p>

          <p className="mt-1 text-lg font-black text-zinc-900">
            ₹{formatINR(totalPayment)}
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs text-zinc-400">
        This is an estimate for planning purposes only. Actual EMI
        depends on your lender&apos;s terms and eligibility.
      </p>
    </div>
  );
}
