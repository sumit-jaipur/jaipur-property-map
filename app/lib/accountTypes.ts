export type AccountType =
  | "buyer"
  | "individual"
  | "agent"
  | "broker"
  | "builder"
  | "colonizer"
  | "pg_rental";

export const ACCOUNT_TYPES: {
  value: AccountType;
  label: string;
  description: string;
}[] = [
  {
    value: "buyer",
    label: "Buyer",
    description: "Looking for a property",
  },
  {
    value: "individual",
    label: "Individual Owner",
    description: "Selling or renting my own property",
  },
  {
    value: "agent",
    label: "Real Estate Agent",
    description: "I help clients buy, sell, or rent",
  },
  {
    value: "broker",
    label: "Broker",
    description: "I list properties on behalf of sellers",
  },
  {
    value: "builder",
    label: "Builder / Developer",
    description: "I build and sell new projects",
  },
  {
    value: "colonizer",
    label: "Colonizer",
    description: "I develop and sell plotted colonies",
  },
  {
    value: "pg_rental",
    label: "PG / Rental Manager",
    description: "I manage PG or rental accommodations",
  },
];

export function getAccountTypeLabel(value: string | null | undefined) {
  return (
    ACCOUNT_TYPES.find((accountType) => accountType.value === value)
      ?.label ?? "Buyer"
  );
}
