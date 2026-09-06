"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useForm } from "@tanstack/react-form";
import { engine, type EligibilityResult } from "@/lib/engine";
import { NegotiationCard } from "@/components/negotiation-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EMI_BOUNCE_FREQUENCY_LABELS,
  EMI_BOUNCE_FREQUENCY_OPTIONS,
  EMI_BOUNCE_RECENCY_LABELS,
  EmiBounceRecency,
  INCOME_TYPE_DESCRIPTIONS,
  INCOME_TYPE_LABELS,
  IncomeType,
  LOAN_TYPE_LABELS,
  LoanType,
  loanFormSchema,
  type LoanFormValues,
} from "@/types/loan-eligibility-form";
import {
  Required,
  blockNonDecimalKeys,
  blockNonDigitKeys,
  formatFieldError,
  onlyDecimalDigits,
  onlyDigits,
} from "@/lib/loan-form-fields";

const defaultValues: LoanFormValues = {
  loanType: "",
  amountWanted: "",
  incomeType: "",
  tenurePreferred: "",
  incomeStabilityLow: "",
  incomeStabilityHigh: "",
  yearsInBusiness: "",
  age: "",
  netMonthlyIncome: "",
  existingEmis: [],
  monthlyExpenses: "",
  hadEmiBounces: "",
  emiBounces: [],
  hasHighCostDebt: "",
  highCostDebtAmount: "",
  highCostDebtInterestRate: "",
  creditScore: "",
  creditScoreUnknown: false,
  hasCollateral: "",
  collateralValue: "",
  collateralAlreadyPledged: "",
  collateralOutstandingAmount: "",
  collateralInterestRate: "",
  collateralRemainingTenureMonths: "",
};

const fieldWrapper = "flex flex-col gap-1.5";
const hintClass = "text-xs text-muted-foreground";
const errorClass = "text-xs text-destructive";
const gridTwo = "grid grid-cols-1 gap-4 sm:grid-cols-2";
// Nested follow-up fields (self-employed detail, EMI bounce detail, collateral detail)
// read as an indented aside off the question that triggered them.
const insetPanel = "mt-1 flex flex-col gap-4 border-l-2 border-border pl-4";

// Shared dropdown for every enum-backed field (loan type, income type, EMI type, ...).
function EnumSelect<T extends string>({
  id,
  name,
  value,
  onChange,
  options,
  labels,
  descriptions,
  placeholder,
}: {
  id?: string;
  name?: string;
  value: T | "";
  onChange: (value: T | "") => void;
  options: readonly T[];
  labels: Record<T, string>;
  descriptions?: Record<T, string>;
  placeholder: string;
}) {
  return (
    <Select
      name={name}
      value={value || null}
      onValueChange={(newValue) => onChange((newValue as T) ?? "")}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder}>
          {(selected: T | null) => (selected ? labels[selected] : placeholder)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option}
            value={option}
            description={descriptions?.[option]}
          >
            {labels[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Compact two-way switch for every yes/no question — a single pill split
// into two segments rather than a pair of radio dots.
function YesNoToggle({
  name,
  value,
  onChange,
}: {
  name: string;
  value: "yes" | "no" | "";
  onChange: (value: "yes" | "no" | "") => void;
}) {
  return (
    <RadioGroup
      name={name}
      value={value || null}
      onValueChange={(v) => onChange((v as "yes" | "no") ?? "")}
      className="inline-grid w-fit grid-cols-2 rounded-lg border border-input bg-muted/40 p-0.5"
    >
      {(["yes", "no"] as const).map((option) => (
        <label
          key={option}
          className="group/field-label relative flex min-w-16 cursor-pointer items-center justify-center rounded-[7px] px-3 py-1 text-sm text-muted-foreground transition-colors has-[[data-checked]]:bg-background has-[[data-checked]]:text-foreground has-[[data-checked]]:shadow-sm has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
        >
          <RadioGroupItem
            value={option}
            className="absolute inset-0 size-full cursor-pointer appearance-none rounded-[7px] border-0 bg-transparent p-0 opacity-0 after:content-none"
          />
          {option === "yes" ? "Yes" : "No"}
        </label>
      ))}
    </RadioGroup>
  );
}

// Icon-only remove control for repeatable rows (existing EMIs, EMI bounces).
function RemoveRowButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
    >
      <X className="size-3.5" />
    </button>
  );
}

export default function LoanEligibilityForm() {
  const [result, setResult] = useState<EligibilityResult | null | undefined>(
    undefined
  );
  const [resultOpen, setResultOpen] = useState(false);

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: loanFormSchema,
    },
    onSubmit: async ({ value }) => {
      setResult(engine(value));
      setResultOpen(true);
    },
  });

  const renderSelfEmployedFields = () => (
    <div className={insetPanel}>
      <div>
        <p className="text-sm font-medium">Business income details</p>
        <p className={hintClass}>
          Self-employed income varies — give us the range so we can assess it
          fairly.
        </p>
      </div>

      <div className={fieldWrapper}>
        <Label>
          Income stability (monthly)
          <Required />
        </Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <form.Field name="incomeStabilityLow">
            {(subField) => (
              <div className={fieldWrapper}>
                <Label htmlFor={subField.name}>Low income month</Label>
                <Input
                  id={subField.name}
                  name={subField.name}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="e.g. 15000"
                  value={subField.state.value}
                  onBlur={subField.handleBlur}
                  onKeyDown={blockNonDigitKeys}
                  onChange={(e) =>
                    subField.handleChange(onlyDigits(e.target.value))
                  }
                />
                {subField.state.meta.errors.length > 0 && (
                  <p className={errorClass}>
                    {subField.state.meta.errors.map(formatFieldError).join(", ")}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="incomeStabilityHigh">
            {(subField) => (
              <div className={fieldWrapper}>
                <Label htmlFor={subField.name}>High income month</Label>
                <Input
                  id={subField.name}
                  name={subField.name}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="e.g. 60000"
                  value={subField.state.value}
                  onBlur={subField.handleBlur}
                  onKeyDown={blockNonDigitKeys}
                  onChange={(e) =>
                    subField.handleChange(onlyDigits(e.target.value))
                  }
                />
                {subField.state.meta.errors.length > 0 && (
                  <p className={errorClass}>
                    {subField.state.meta.errors.map(formatFieldError).join(", ")}
                  </p>
                )}
              </div>
            )}
          </form.Field>

        </div>
      </div>

      <form.Field name="yearsInBusiness">
        {(subField) => (
          <div className={`${fieldWrapper} sm:max-w-[50%]`}>
            <Label htmlFor={subField.name}>
              Years in business
              <Required />
            </Label>
            <Input
              id={subField.name}
              name={subField.name}
              type="number"
              min={1}
              inputMode="numeric"
              placeholder="e.g. 4"
              value={subField.state.value}
              onBlur={subField.handleBlur}
              onKeyDown={blockNonDigitKeys}
              onChange={(e) =>
                subField.handleChange(onlyDigits(e.target.value))
              }
            />
            {subField.state.meta.errors.length > 0 && (
              <p className={errorClass}>
                {subField.state.meta.errors.map(formatFieldError).join(", ")}
              </p>
            )}
          </div>
        )}
      </form.Field>
    </div>
  );

  const renderInformalFields = () => (
    <div className={insetPanel}>
      <div>
        <p className="text-sm font-medium">Income details</p>
        <p className={hintClass}>
          Your income can vary week to week — give us the range so we can
          assess it fairly.
        </p>
      </div>

      <div className={fieldWrapper}>
        <Label>
          Income stability (monthly)
          <Required />
        </Label>
        <div className={gridTwo}>
          <form.Field name="incomeStabilityLow">
            {(subField) => (
              <div className={fieldWrapper}>
                <Label htmlFor={subField.name}>Low income month</Label>
                <Input
                  id={subField.name}
                  name={subField.name}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="e.g. 10000"
                  value={subField.state.value}
                  onBlur={subField.handleBlur}
                  onKeyDown={blockNonDigitKeys}
                  onChange={(e) =>
                    subField.handleChange(onlyDigits(e.target.value))
                  }
                />
                {subField.state.meta.errors.length > 0 && (
                  <p className={errorClass}>
                    {subField.state.meta.errors.map(formatFieldError).join(", ")}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="incomeStabilityHigh">
            {(subField) => (
              <div className={fieldWrapper}>
                <Label htmlFor={subField.name}>High income month</Label>
                <Input
                  id={subField.name}
                  name={subField.name}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="e.g. 30000"
                  value={subField.state.value}
                  onBlur={subField.handleBlur}
                  onKeyDown={blockNonDigitKeys}
                  onChange={(e) =>
                    subField.handleChange(onlyDigits(e.target.value))
                  }
                />
                {subField.state.meta.errors.length > 0 && (
                  <p className={errorClass}>
                    {subField.state.meta.errors.map(formatFieldError).join(", ")}
                  </p>
                )}
              </div>
            )}
          </form.Field>
        </div>
      </div>

      <form.Field name="yearsInBusiness">
        {(subField) => (
          <div className={`${fieldWrapper} sm:max-w-[50%]`}>
            <Label htmlFor={subField.name}>
              How long have you been doing this work?
              <Required />
            </Label>
            <Input
              id={subField.name}
              name={subField.name}
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="e.g. 2"
              value={subField.state.value}
              onBlur={subField.handleBlur}
              onKeyDown={blockNonDigitKeys}
              onChange={(e) =>
                subField.handleChange(onlyDigits(e.target.value))
              }
            />
            <p className={hintClass}>
              In years. If you do more than one kind of informal work, use
              the longest.
            </p>
            {subField.state.meta.errors.length > 0 && (
              <p className={errorClass}>
                {subField.state.meta.errors.map(formatFieldError).join(", ")}
              </p>
            )}
          </div>
        )}
      </form.Field>
    </div>
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Loan eligibility check
        </h1>
        <p className="text-sm text-muted-foreground">
          Answer a few questions about the loan you want and your finances —
          it takes about three minutes.
        </p>
      </div>

      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-w-md p-0">
          {result === null ? (
            <div className="p-5 text-sm text-muted-foreground">
              We don&apos;t yet support this combination of loan type and
              income type — see README for current scope.
            </div>
          ) : result ? (
            <NegotiationCard result={result} />
          ) : null}
        </DialogContent>
      </Dialog>

      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        {/* 1. Loan request */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Loan request
            </CardTitle>
            <CardDescription>
              What you want to borrow, and for how long.
            </CardDescription>
          </CardHeader>
          <CardContent className={gridTwo}>
            <form.Field name="loanType">
              {(field) => (
                <div className={fieldWrapper}>
                  <Label htmlFor={field.name}>
                    Loan type
                    <Required />
                  </Label>
                  <EnumSelect
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onChange={field.handleChange}
                    options={Object.values(LoanType)}
                    labels={LOAN_TYPE_LABELS}
                    placeholder="Select loan type"
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className={errorClass}>
                      {field.state.meta.errors.map(formatFieldError).join(", ")}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="amountWanted">
              {(field) => (
                <div className={fieldWrapper}>
                  <Label htmlFor={field.name}>
                    Amount wanted
                    <Required />
                  </Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    min={1}
                    inputMode="numeric"
                    placeholder="e.g. 500000"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onKeyDown={blockNonDigitKeys}
                    onChange={(e) =>
                      field.handleChange(onlyDigits(e.target.value))
                    }
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className={errorClass}>
                      {field.state.meta.errors.map(formatFieldError).join(", ")}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="tenurePreferred">
              {(field) => (
                <div className={fieldWrapper}>
                  <Label htmlFor={field.name}>
                    Tenure preferred (months)
                    <Required />
                  </Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    min={1}
                    inputMode="numeric"
                    placeholder="e.g. 36"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onKeyDown={blockNonDigitKeys}
                    onChange={(e) =>
                      field.handleChange(onlyDigits(e.target.value))
                    }
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className={errorClass}>
                      {field.state.meta.errors.map(formatFieldError).join(", ")}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="age">
              {(field) => (
                <div className={fieldWrapper}>
                  <Label htmlFor={field.name}>
                    Age
                    <Required />
                  </Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    min={18}
                    max={100}
                    inputMode="numeric"
                    placeholder="e.g. 30"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onKeyDown={blockNonDigitKeys}
                    onChange={(e) =>
                      field.handleChange(onlyDigits(e.target.value))
                    }
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className={errorClass}>
                      {field.state.meta.errors.map(formatFieldError).join(", ")}
                    </p>
                  )}
                </div>
              )}
            </form.Field>
          </CardContent>
        </Card>

        {/* 2. Income */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Income</CardTitle>
            <CardDescription>
              Tell us how you earn, so affordability is judged fairly.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form.Field name="incomeType">
              {(field) => (
                <div className={fieldWrapper}>
                  <Label htmlFor={field.name}>
                    Income type
                    <Required />
                  </Label>
                  <EnumSelect
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onChange={field.handleChange}
                    options={Object.values(IncomeType)}
                    labels={INCOME_TYPE_LABELS}
                    descriptions={INCOME_TYPE_DESCRIPTIONS}
                    placeholder="Select income type"
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className={errorClass}>
                      {field.state.meta.errors.map(formatFieldError).join(", ")}
                    </p>
                  )}

                  {/* Follow-up: only shown for self-employed / business-owner income */}
                  {field.state.value === IncomeType.SelfEmployed &&
                    renderSelfEmployedFields()}
                  {field.state.value === IncomeType.Informal &&
                    renderInformalFields()}
                </div>
              )}
            </form.Field>

            <form.Subscribe selector={(state) => state.values.incomeType}>
              {(incomeType) =>
                incomeType !== IncomeType.SelfEmployed &&
                incomeType !== IncomeType.Informal && (
                  <form.Field name="netMonthlyIncome">
                    {(field) => (
                      <div className={`${fieldWrapper} sm:max-w-[50%]`}>
                        <Label htmlFor={field.name}>
                          Net monthly income
                          <Required />
                        </Label>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="number"
                          min={1}
                          inputMode="numeric"
                          placeholder="e.g. 60000"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onKeyDown={blockNonDigitKeys}
                          onChange={(e) =>
                            field.handleChange(onlyDigits(e.target.value))
                          }
                        />
                        {field.state.meta.errors.length > 0 && (
                          <p className={errorClass}>
                            {field.state.meta.errors.map(formatFieldError).join(", ")}
                          </p>
                        )}
                      </div>
                    )}
                  </form.Field>
                )
              }
            </form.Subscribe>
          </CardContent>
        </Card>

        {/* 3. Collateral - adaptive branch: no collateral -> stop, else
            value -> already pledged? -> outstanding amount. */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Assets & collateral
            </CardTitle>
            <CardDescription>
              Anything you could pledge can improve the terms on offer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form.Field name="hasCollateral">
              {(field) => (
                <div className={fieldWrapper}>
                  <Label>
                    Do you own any property/asset you could pledge as
                    collateral?
                  </Label>
                  <YesNoToggle
                    name={field.name}
                    value={field.state.value}
                    onChange={field.handleChange}
                  />

                  {field.state.value === "yes" && (
                    <div className={insetPanel}>
                      <form.Field name="collateralValue">
                        {(valueField) => (
                          <div className={`${fieldWrapper} sm:max-w-[50%]`}>
                            <Label htmlFor={valueField.name}>
                              Estimated value of that asset
                              <Required />
                            </Label>
                            <Input
                              id={valueField.name}
                              name={valueField.name}
                              type="number"
                              min={1}
                              inputMode="numeric"
                              placeholder="e.g. 2000000"
                              value={valueField.state.value}
                              onBlur={valueField.handleBlur}
                              onKeyDown={blockNonDigitKeys}
                              onChange={(e) =>
                                valueField.handleChange(
                                  onlyDigits(e.target.value)
                                )
                              }
                            />
                            {valueField.state.meta.errors.length > 0 && (
                              <p className={errorClass}>
                                {valueField.state.meta.errors.map(formatFieldError).join(", ")}
                              </p>
                            )}
                          </div>
                        )}
                      </form.Field>

                      <form.Field name="collateralAlreadyPledged">
                        {(pledgedField) => (
                          <div className={fieldWrapper}>
                            <Label>
                              Is it already pledged against any existing loan?
                            </Label>
                            <YesNoToggle
                              name={pledgedField.name}
                              value={pledgedField.state.value}
                              onChange={pledgedField.handleChange}
                            />

                            {pledgedField.state.value === "yes" && (
                              <div className="mt-1 grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <form.Field name="collateralOutstandingAmount">
                                  {(outstandingField) => (
                                    <div className={fieldWrapper}>
                                      <Label htmlFor={outstandingField.name}>
                                        Outstanding amount
                                        <Required />
                                      </Label>
                                      <Input
                                        id={outstandingField.name}
                                        name={outstandingField.name}
                                        type="number"
                                        min={1}
                                        inputMode="numeric"
                                        placeholder="e.g. 500000"
                                        value={outstandingField.state.value}
                                        onBlur={outstandingField.handleBlur}
                                        onKeyDown={blockNonDigitKeys}
                                        onChange={(e) =>
                                          outstandingField.handleChange(
                                            onlyDigits(e.target.value)
                                          )
                                        }
                                      />
                                      {outstandingField.state.meta.errors
                                        .length > 0 && (
                                        <p className={errorClass}>
                                          {outstandingField.state.meta.errors.map(formatFieldError).join(", ")}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </form.Field>

                                <form.Field name="collateralInterestRate">
                                  {(rateField) => (
                                    <div className={fieldWrapper}>
                                      <Label htmlFor={rateField.name}>
                                        Interest rate (% p.a.)
                                        <Required />
                                      </Label>
                                      <Input
                                        id={rateField.name}
                                        name={rateField.name}
                                        type="number"
                                        min={0.01}
                                        max={100}
                                        step={0.01}
                                        inputMode="decimal"
                                        placeholder="e.g. 9.5"
                                        value={rateField.state.value}
                                        onBlur={rateField.handleBlur}
                                        onKeyDown={blockNonDecimalKeys}
                                        onChange={(e) =>
                                          rateField.handleChange(
                                            onlyDecimalDigits(e.target.value)
                                          )
                                        }
                                      />
                                      {rateField.state.meta.errors.length >
                                        0 && (
                                        <p className={errorClass}>
                                          {rateField.state.meta.errors.map(formatFieldError).join(", ")}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </form.Field>

                                <form.Field name="collateralRemainingTenureMonths">
                                  {(tenureField) => (
                                    <div className={fieldWrapper}>
                                      <Label htmlFor={tenureField.name}>
                                        Tenure left (months)
                                        <Required />
                                      </Label>
                                      <Input
                                        id={tenureField.name}
                                        name={tenureField.name}
                                        type="number"
                                        min={1}
                                        inputMode="numeric"
                                        placeholder="e.g. 84"
                                        value={tenureField.state.value}
                                        onBlur={tenureField.handleBlur}
                                        onKeyDown={blockNonDigitKeys}
                                        onChange={(e) =>
                                          tenureField.handleChange(
                                            onlyDigits(e.target.value)
                                          )
                                        }
                                      />
                                      {tenureField.state.meta.errors.length >
                                        0 && (
                                        <p className={errorClass}>
                                          {tenureField.state.meta.errors.map(formatFieldError).join(", ")}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </form.Field>
                              </div>
                            )}
                          </div>
                        )}
                      </form.Field>
                    </div>
                  )}
                </div>
              )}
            </form.Field>
          </CardContent>
        </Card>

        {/* 4. Existing obligations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Existing obligations
            </CardTitle>
            <CardDescription>
              Other EMIs and monthly expenses you&apos;re already carrying.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form.Field name="existingEmis" mode="array">
              {(field) => (
                <div className={fieldWrapper}>
                  <div className="flex items-center justify-between">
                    <Label>Existing EMIs</Label>
                    <span className={hintClass}>
                      Optional — add if you have any
                    </span>
                  </div>

                  {field.state.value.length === 0 && (
                    <p className={hintClass}>No existing EMIs added.</p>
                  )}

                  {field.state.value.length > 0 && (
                    <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
                      {field.state.value.map((_, index) => (
                        <div key={index} className="flex flex-col gap-3 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                              EMI {index + 1}
                            </span>
                            <RemoveRowButton
                              label={`Remove EMI ${index + 1}`}
                              onClick={() => field.removeValue(index)}
                            />
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <form.Field name={`existingEmis[${index}].type`}>
                              {(typeField) => (
                                <div className={fieldWrapper}>
                                  <Label htmlFor={typeField.name}>
                                    EMI type
                                    <Required />
                                  </Label>
                                  <EnumSelect
                                    id={typeField.name}
                                    name={typeField.name}
                                    value={typeField.state.value}
                                    onChange={typeField.handleChange}
                                    options={Object.values(LoanType)}
                                    labels={LOAN_TYPE_LABELS}
                                    placeholder="Select type"
                                  />
                                  {typeField.state.meta.errors.length > 0 && (
                                    <p className={errorClass}>
                                      {typeField.state.meta.errors.map(formatFieldError).join(", ")}
                                    </p>
                                  )}
                                </div>
                              )}
                            </form.Field>

                            <form.Field name={`existingEmis[${index}].amount`}>
                              {(amountField) => (
                                <div className={fieldWrapper}>
                                  <Label htmlFor={amountField.name}>
                                    Amount/month
                                    <Required />
                                  </Label>
                                  <Input
                                    id={amountField.name}
                                    name={amountField.name}
                                    type="number"
                                    min={1}
                                    inputMode="numeric"
                                    placeholder="e.g. 5000"
                                    value={amountField.state.value}
                                    onBlur={amountField.handleBlur}
                                    onKeyDown={blockNonDigitKeys}
                                    onChange={(e) =>
                                      amountField.handleChange(
                                        onlyDigits(e.target.value)
                                      )
                                    }
                                  />
                                  {amountField.state.meta.errors.length >
                                    0 && (
                                    <p className={errorClass}>
                                      {amountField.state.meta.errors.map(formatFieldError).join(", ")}
                                    </p>
                                  )}
                                </div>
                              )}
                            </form.Field>

                            <form.Field
                              name={`existingEmis[${index}].interestRate`}
                            >
                              {(rateField) => (
                                <div className={fieldWrapper}>
                                  <Label htmlFor={rateField.name}>
                                    Interest rate (% p.a.)
                                    <Required />
                                  </Label>
                                  <Input
                                    id={rateField.name}
                                    name={rateField.name}
                                    type="number"
                                    min={0.01}
                                    max={100}
                                    step={0.01}
                                    inputMode="decimal"
                                    placeholder="e.g. 12.5"
                                    value={rateField.state.value}
                                    onBlur={rateField.handleBlur}
                                    onKeyDown={blockNonDecimalKeys}
                                    onChange={(e) =>
                                      rateField.handleChange(
                                        onlyDecimalDigits(e.target.value)
                                      )
                                    }
                                  />
                                  {rateField.state.meta.errors.length > 0 && (
                                    <p className={errorClass}>
                                      {rateField.state.meta.errors.map(formatFieldError).join(", ")}
                                    </p>
                                  )}
                                </div>
                              )}
                            </form.Field>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      field.pushValue({
                        type: "",
                        amount: "",
                        interestRate: "",
                      })
                    }
                  >
                    <Plus className="size-3.5" />
                    Add EMI
                  </Button>
                </div>
              )}
            </form.Field>

            <form.Field name="monthlyExpenses">
              {(field) => (
                <div className={`${fieldWrapper} sm:max-w-[50%]`}>
                  <Label htmlFor={field.name}>
                    Your monthly expenses
                    <Required />
                  </Label>
                  <p className={hintClass}>
                    Your own share of household costs — if others contribute
                    income toward rent, food, or bills, count only the part
                    you personally cover.
                  </p>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    min={1}
                    inputMode="numeric"
                    placeholder="e.g. 20000"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onKeyDown={blockNonDigitKeys}
                    onChange={(e) =>
                      field.handleChange(onlyDigits(e.target.value))
                    }
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className={errorClass}>
                      {field.state.meta.errors.map(formatFieldError).join(", ")}
                    </p>
                  )}
                </div>
              )}
            </form.Field>
          </CardContent>
        </Card>

        {/* 5. Repayment history */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Repayment history
            </CardTitle>
            <CardDescription>
              Missed EMI payments, if any, and how often they happened.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form.Field name="hadEmiBounces">
              {(field) => (
                <div className={fieldWrapper}>
                  <Label>Any EMI bounces?</Label>
                  <YesNoToggle
                    name={field.name}
                    value={field.state.value}
                    onChange={field.handleChange}
                  />

                  {/* Follow-up: only shown when answer is "yes" */}
                  {field.state.value === "yes" && (
                    <form.Field name="emiBounces" mode="array">
                      {(bouncesField) => (
                        <div className={insetPanel}>
                          <p className={hintClass}>
                            Add every EMI that has bounced, with how often and
                            how recently.
                          </p>

                          {bouncesField.state.value.length === 0 && (
                            <p className={hintClass}>
                              No EMI bounces added yet.
                            </p>
                          )}

                          {bouncesField.state.value.length > 0 && (
                            <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
                              {bouncesField.state.value.map((_, index) => (
                                <div
                                  key={index}
                                  className="flex flex-col gap-3 p-3"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-muted-foreground">
                                      Bounce {index + 1}
                                    </span>
                                    <RemoveRowButton
                                      label={`Remove EMI bounce ${index + 1}`}
                                      onClick={() =>
                                        bouncesField.removeValue(index)
                                      }
                                    />
                                  </div>
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <form.Field
                                      name={`emiBounces[${index}].type`}
                                    >
                                      {(typeField) => (
                                        <div className={fieldWrapper}>
                                          <Label htmlFor={typeField.name}>
                                            EMI type
                                            <Required />
                                          </Label>
                                          <EnumSelect
                                            id={typeField.name}
                                            name={typeField.name}
                                            value={typeField.state.value}
                                            onChange={typeField.handleChange}
                                            options={Object.values(LoanType)}
                                            labels={LOAN_TYPE_LABELS}
                                            placeholder="Select type"
                                          />
                                          {typeField.state.meta.errors
                                            .length > 0 && (
                                            <p className={errorClass}>
                                              {typeField.state.meta.errors.map(formatFieldError).join(", ")}
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </form.Field>

                                    <form.Field
                                      name={`emiBounces[${index}].amount`}
                                    >
                                      {(amountField) => (
                                        <div className={fieldWrapper}>
                                          <Label htmlFor={amountField.name}>
                                            EMI amount
                                            <Required />
                                          </Label>
                                          <Input
                                            id={amountField.name}
                                            name={amountField.name}
                                            type="number"
                                            min={1}
                                            inputMode="numeric"
                                            placeholder="e.g. 5000"
                                            value={amountField.state.value}
                                            onBlur={amountField.handleBlur}
                                            onKeyDown={blockNonDigitKeys}
                                            onChange={(e) =>
                                              amountField.handleChange(
                                                onlyDigits(e.target.value)
                                              )
                                            }
                                          />
                                          {amountField.state.meta.errors
                                            .length > 0 && (
                                            <p className={errorClass}>
                                              {amountField.state.meta.errors.map(formatFieldError).join(", ")}
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </form.Field>

                                    <form.Field
                                      name={`emiBounces[${index}].frequency`}
                                    >
                                      {(frequencyField) => (
                                        <div className={fieldWrapper}>
                                          <Label htmlFor={frequencyField.name}>
                                            How frequent
                                          </Label>
                                          <EnumSelect
                                            id={frequencyField.name}
                                            name={frequencyField.name}
                                            value={frequencyField.state.value}
                                            onChange={
                                              frequencyField.handleChange
                                            }
                                            options={
                                              EMI_BOUNCE_FREQUENCY_OPTIONS
                                            }
                                            labels={EMI_BOUNCE_FREQUENCY_LABELS}
                                            placeholder="Select frequency"
                                          />
                                        </div>
                                      )}
                                    </form.Field>

                                    <form.Field
                                      name={`emiBounces[${index}].recency`}
                                    >
                                      {(recencyField) => (
                                        <div className={fieldWrapper}>
                                          <Label htmlFor={recencyField.name}>
                                            How recent
                                          </Label>
                                          <EnumSelect
                                            id={recencyField.name}
                                            name={recencyField.name}
                                            value={recencyField.state.value}
                                            onChange={
                                              recencyField.handleChange
                                            }
                                            options={Object.values(
                                              EmiBounceRecency
                                            )}
                                            labels={EMI_BOUNCE_RECENCY_LABELS}
                                            placeholder="Select how recent"
                                          />
                                        </div>
                                      )}
                                    </form.Field>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="self-start text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              bouncesField.pushValue({
                                type: "",
                                amount: "",
                                frequency: "",
                                recency: "",
                              })
                            }
                          >
                            <Plus className="size-3.5" />
                            Add EMI bounce
                          </Button>
                        </div>
                      )}
                    </form.Field>
                  )}
                </div>
              )}
            </form.Field>
          </CardContent>
        </Card>

        {/* 6. Credit & other debt */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Credit & other debt
            </CardTitle>
            <CardDescription>
              Informal high-cost debt and your credit score, if you know it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form.Field name="hasHighCostDebt">
              {(field) => (
                <div className={fieldWrapper}>
                  <Label>
                    Any existing high-cost/informal debt (loan apps,
                    high-interest loans)?
                  </Label>
                  <YesNoToggle
                    name={field.name}
                    value={field.state.value}
                    onChange={field.handleChange}
                  />

                  {/* Follow-up: only shown when answer is "yes" */}
                  {field.state.value === "yes" && (
                    <div className={insetPanel}>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <form.Field name="highCostDebtAmount">
                          {(subField) => (
                            <div className={fieldWrapper}>
                              <Label htmlFor={subField.name}>
                                Total outstanding amount
                                <Required />
                              </Label>
                              <Input
                                id={subField.name}
                                name={subField.name}
                                type="number"
                                min={1}
                                inputMode="numeric"
                                placeholder="e.g. 25000"
                                value={subField.state.value}
                                onBlur={subField.handleBlur}
                                onKeyDown={blockNonDigitKeys}
                                onChange={(e) =>
                                  subField.handleChange(
                                    onlyDigits(e.target.value)
                                  )
                                }
                              />
                              {subField.state.meta.errors.length > 0 && (
                                <p className={errorClass}>
                                  {subField.state.meta.errors.map(formatFieldError).join(", ")}
                                </p>
                              )}
                            </div>
                          )}
                        </form.Field>

                        <form.Field name="highCostDebtInterestRate">
                          {(rateField) => (
                            <div className={fieldWrapper}>
                              <Label htmlFor={rateField.name}>
                                Interest rate (% p.a.)
                                <Required />
                              </Label>
                              <Input
                                id={rateField.name}
                                name={rateField.name}
                                type="number"
                                min={0}
                                max={100}
                                step={0.01}
                                inputMode="decimal"
                                placeholder="e.g. 30 (0 if interest-free)"
                                value={rateField.state.value}
                                onBlur={rateField.handleBlur}
                                onKeyDown={blockNonDecimalKeys}
                                onChange={(e) =>
                                  rateField.handleChange(
                                    onlyDecimalDigits(e.target.value)
                                  )
                                }
                              />
                              {rateField.state.meta.errors.length > 0 && (
                                <p className={errorClass}>
                                  {rateField.state.meta.errors.map(formatFieldError).join(", ")}
                                </p>
                              )}
                            </div>
                          )}
                        </form.Field>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="creditScoreUnknown">
              {(unknownField) => (
                <form.Field name="creditScore">
                  {(field) => (
                    <div className={`${fieldWrapper} sm:max-w-[50%]`}>
                      <Label htmlFor={field.name}>Credit score</Label>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="number"
                        min={300}
                        max={900}
                        inputMode="numeric"
                        placeholder="e.g. 750"
                        disabled={unknownField.state.value}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onKeyDown={blockNonDigitKeys}
                        onChange={(e) =>
                          field.handleChange(onlyDigits(e.target.value))
                        }
                      />
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                        <Checkbox
                          checked={unknownField.state.value}
                          onCheckedChange={(checked) => {
                            unknownField.handleChange(checked === true);
                            if (checked === true) field.handleChange("");
                          }}
                        />
                        I don&apos;t know my credit score
                      </label>
                    </div>
                  )}
                </form.Field>
              )}
            </form.Field>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4">
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={!canSubmit}
              >
                {isSubmitting ? "Checking..." : "Check eligibility"}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </div>
  );
}
