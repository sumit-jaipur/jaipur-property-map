"use client";

// Sellers were typing the full rupee amount by hand -- "7000000" for a
// seventy-lakh property, counting zeros to get it right. This splits
// price entry into a plain number plus a Lakh/Crore unit, the way
// everyone actually talks about property prices in India, and does the
// zero-counting for them.

export type PriceUnit = "lakh" | "crore";

const UNIT_MULTIPLIER: Record<PriceUnit, number> = {
  lakh: 100000,
  crore: 10000000,
};

export function priceUnitToRupees(
  valueText: string,
  unit: PriceUnit
): number {
  const parsed = Number(valueText);

  if (!valueText || Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }

  return Math.round(parsed * UNIT_MULTIPLIER[unit]);
}

// The inverse -- for editing an existing listing, show its saved rupee
// amount back in the same lakh/crore shorthand a seller would naturally
// type, instead of the raw number with all its zeros.
export function rupeesToPriceUnit(
  rupees: number
): { valueText: string; unit: PriceUnit } {
  if (!rupees) {
    return { valueText: "", unit: "lakh" };
  }

  if (rupees >= UNIT_MULTIPLIER.crore) {
    return {
      valueText: trimTrailingZeros(rupees / UNIT_MULTIPLIER.crore),
      unit: "crore",
    };
  }

  return {
    valueText: trimTrailingZeros(rupees / UNIT_MULTIPLIER.lakh),
    unit: "lakh",
  };
}

function trimTrailingZeros(value: number): string {
  return parseFloat(value.toFixed(4)).toString();
}

type Props = {
  valueText: string;
  unit: PriceUnit;
  onValueChange: (value: string) => void;
  onUnitChange: (unit: PriceUnit) => void;
  inputClassName: string;
  labelClassName: string;
  required?: boolean;
};

export default function PriceInput({
  valueText,
  unit,
  onValueChange,
  onUnitChange,
  inputClassName,
  labelClassName,
  required,
}: Props) {
  const rupees = priceUnitToRupees(valueText, unit);

  return (
    <div>
      <label className={labelClassName}>Price *</label>

      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={valueText}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={unit === "crore" ? "Example: 1.5" : "Example: 70"}
          className={`${inputClassName} flex-1`}
          required={required}
        />

        <select
          value={unit}
          onChange={(e) => onUnitChange(e.target.value as PriceUnit)}
          className={`${inputClassName} w-28 shrink-0`}
        >
          <option value="lakh">Lakh</option>
          <option value="crore">Crore</option>
        </select>
      </div>

      {/* No zero-counting needed -- this is exactly what gets saved, so
          a seller can double-check before submitting. */}
      {valueText !== "" && (
        <p className="mt-1.5 text-xs font-semibold text-zinc-400">
          {"₹"}
          {rupees.toLocaleString("en-IN")}
        </p>
      )}
    </div>
  );
}
