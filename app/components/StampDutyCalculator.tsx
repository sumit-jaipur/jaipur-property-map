"use client";

import { useMemo, useState } from "react";

type Props = {
  defaultPrice?: number;
};

type Buyer = "male" | "female" | "joint";

// Indicative Rajasthan rates. Editable in the UI because the state revises
// them periodically and they vary by buyer category and local body.
const DEFAULT_RATES: Record<Buyer, { stamp: number; registration: number }> = {
  male: { stamp: 5, registration: 1 },
  female: { stamp: 4, registration: 1 },
  joint: { stamp: 5, registration: 1 },
};

const BUYER_LABELS: Record<Buyer, string> = {
  male: "Male",
  female: "Female",
  joint: "Joint / Other",
};

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export default function StampDutyCalculator({ defaultPrice }: Props) {
  const [salePrice, setSalePrice] = useState(defaultPrice || 5000000);
  const [areaSqFt, setAreaSqFt] = useState(1000);
  const [dlcRate, setDlcRate] = useState(0);
  const [buyer, setBuyer] = useState<Buyer>("male");
  const [stampRate, setStampRate] = useState(DEFAULT_RATES.male.stamp);
  const [registrationRate, setRegistrationRate] = useState(
    DEFAULT_RATES.male.registration
  );

  function selectBuyer(next: Buyer) {
    setBuyer(next);
    setStampRate(DEFAULT_RATES[next].stamp);
    setRegistrationRate(DEFAULT_RATES[next].registration);
  }

  const result = useMemo(() => {
    const dlcValue = dlcRate * areaSqFt;
    const taxableValue = Math.max(salePrice, dlcValue);
    const stampDuty = (taxableValue * stampRate) / 100;
    const registrationFee = (taxableValue * registrationRate) / 100;
    const total = stampDuty + registrationFee;

    return {
      dlcValue,
      taxableValue,
      stampDuty,
      registrationFee,
      total,
      totalCost: salePrice + total,
    };
  }, [salePrice, areaSqFt, dlcRate, stampRate, registrationRate]);

  const inputClass =
    "mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-900";

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-red-500">
        Plan your budget
      </p>

      <h2 className="mt-1 text-xl font-black text-zinc-900">
        Stamp Duty &amp; Registration Calculator
      </h2>

      <p className="mt-1 text-sm text-zinc-500">
        Estimate Rajasthan stamp duty and registration fees. Duty is
        charged on the higher of the sale price and the DLC
        (district level committee) value.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold text-zinc-700">
          Sale price (₹)
          <input
            type="number"
            min={0}
            value={salePrice}
            onChange={(e) => setSalePrice(Number(e.target.value) || 0)}
            className={inputClass}
          />
        </label>

        <label className="text-sm font-bold text-zinc-700">
          Built-up / plot area (sq ft)
          <input
            type="number"
            min={0}
            value={areaSqFt}
            onChange={(e) => setAreaSqFt(Number(e.target.value) || 0)}
            className={inputClass}
          />
        </label>

        <label className="text-sm font-bold text-zinc-700">
          DLC rate (₹ per sq ft)
          <input
            type="number"
            min={0}
            value={dlcRate}
            onChange={(e) => setDlcRate(Number(e.target.value) || 0)}
            className={inputClass}
          />
          <span className="mt-1 block text-xs font-normal text-zinc-400">
            Enter the current DLC rate for the locality (leave 0 to
            use the sale price only).
          </span>
        </label>

        <label className="text-sm font-bold text-zinc-700">
          Buyer category
          <select
            value={buyer}
            onChange={(e) => selectBuyer(e.target.value as Buyer)}
            className={inputClass}
          >
            {(Object.keys(BUYER_LABELS) as Buyer[]).map((key) => (
              <option key={key} value={key}>
                {BUYER_LABELS[key]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-bold text-zinc-700">
          Stamp duty rate (%)
          <input
            type="number"
            min={0}
            step={0.1}
            value={stampRate}
            onChange={(e) => setStampRate(Number(e.target.value) || 0)}
            className={inputClass}
          />
        </label>

        <label className="text-sm font-bold text-zinc-700">
          Registration fee rate (%)
          <input
            type="number"
            min={0}
            step={0.1}
            value={registrationRate}
            onChange={(e) =>
              setRegistrationRate(Number(e.target.value) || 0)
            }
            className={inputClass}
          />
        </label>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-zinc-100 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
            Stamp Duty
          </p>
          <p className="mt-1 text-lg font-black text-zinc-900">
            ₹{formatINR(result.stampDuty)}
          </p>
        </div>

        <div className="rounded-2xl bg-zinc-100 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
            Registration Fee
          </p>
          <p className="mt-1 text-lg font-black text-zinc-900">
            ₹{formatINR(result.registrationFee)}
          </p>
        </div>

        <div className="rounded-2xl bg-accent-soft p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-accent">
            Total Charges
          </p>
          <p className="mt-1 text-lg font-black text-zinc-900">
            ₹{formatINR(result.total)}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-sm text-zinc-600">
        <p>
          Value used for duty:{" "}
          <span className="font-bold text-zinc-900">
            ₹{formatINR(result.taxableValue)}
          </span>
          {result.dlcValue > salePrice && " (DLC value is higher)"}
        </p>
        <p>
          Sale price + charges:{" "}
          <span className="font-bold text-zinc-900">
            ₹{formatINR(result.totalCost)}
          </span>
        </p>
      </div>

      <p className="mt-4 text-xs text-zinc-400">
        Rates shown are indicative defaults and may change; concessions
        and surcharges vary by location and buyer. Confirm the current
        rates and DLC value with the Rajasthan registration department
        or your sub-registrar before transacting.
      </p>
    </div>
  );
}
