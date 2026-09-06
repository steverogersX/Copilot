import type { KeyboardEvent } from "react";

// TanStack Form's Standard Schema adapter puts the raw validation issue
// object in `field.state.meta.errors` (e.g. `{ message, path }`), not a
// plain string - rendering one directly (or via `.join(", ")`) prints
// "[object Object]" instead of the message. Extract the message safely
// regardless of whether the entry is already a string or an issue object.
export const formatFieldError = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
};

// Marks a field as required next to its label.
export const Required = () => (
  <span className="text-destructive" aria-hidden="true">
    {" "}
    *
  </span>
);

// Whole numbers only — used on every numeric field so incomes/amounts can't go negative.
export const onlyDigits = (value: string) => value.replace(/[^0-9]/g, "");

export const blockNonDigitKeys = (e: KeyboardEvent<HTMLInputElement>) => {
  if (["-", "+", "e", "E", "."].includes(e.key)) e.preventDefault();
};

// Positive decimals only (e.g. interest rates) — digits with at most one decimal point.
export const onlyDecimalDigits = (value: string) =>
  value
    .replace(/[^0-9.]/g, "")
    .replace(/(\..*)\./g, "$1")
    .replace(/^(\d*\.\d{2})\d*$/, "$1");

export const blockNonDecimalKeys = (e: KeyboardEvent<HTMLInputElement>) => {
  if (["-", "+", "e", "E"].includes(e.key)) e.preventDefault();
};

export const positiveNumberValidator =
  (message: string) =>
  ({ value }: { value: string }) =>
    !value || Number(value) <= 0 ? message : undefined;

export const percentageValidator =
  (message: string) =>
  ({ value }: { value: string }) =>
    !value || Number(value) <= 0 || Number(value) > 100 ? message : undefined;

// Only enforced when another field (e.g. incomeType) currently holds conditionValue —
// so fields hidden behind a conditional section don't block submission.
export const positiveNumberValidatorWhen =
  (conditionFieldName: string, conditionValue: unknown, message: string) =>
  ({ value, fieldApi }: { value: string; fieldApi: any }) => {
    if (fieldApi.form.getFieldValue(conditionFieldName) !== conditionValue) {
      return undefined;
    }
    return !value || Number(value) <= 0 ? message : undefined;
  };
