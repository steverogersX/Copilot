"use client";

import { Plus } from "lucide-react";
import { useForm } from "@tanstack/react-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  incomeStabilityAvg: "",
  yearsInBusiness: "",
  age: "",
  netMonthlyIncome: "",
  existingEmis: [],
  monthlyExpenses: "",
  hadEmiBounces: "",
  emiBounces: [],
  hasHighCostDebt: "",
  highCostDebtAmount: "",
  creditScore: "",
  creditScoreUnknown: false,
};

const fieldWrapper = "flex flex-col gap-1.5";
const hintClass = "text-xs text-muted-foreground";
const errorClass = "text-xs text-destructive";

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

export default function LoanEligibilityForm() {
  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: loanFormSchema,
    },
    onSubmit: async ({ value }) => {
      console.log("Loan eligibility form submitted:", value);
    },
  });

  const renderSelfEmployedFields = () => (
    <div className="mt-1 flex flex-col gap-4 rounded-md border border-input/50 p-4">
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                    {subField.state.meta.errors.join(", ")}
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
                    {subField.state.meta.errors.join(", ")}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="incomeStabilityAvg">
            {(subField) => (
              <div className={fieldWrapper}>
                <Label htmlFor={subField.name}>Avg income month</Label>
                <Input
                  id={subField.name}
                  name={subField.name}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="e.g. 35000"
                  value={subField.state.value}
                  onBlur={subField.handleBlur}
                  onKeyDown={blockNonDigitKeys}
                  onChange={(e) =>
                    subField.handleChange(onlyDigits(e.target.value))
                  }
                />
                {subField.state.meta.errors.length > 0 && (
                  <p className={errorClass}>
                    {subField.state.meta.errors.join(", ")}
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
                {subField.state.meta.errors.join(", ")}
              </p>
            )}
          </div>
        )}
      </form.Field>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loan eligibility check</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          {/* 1. Loan type */}
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
                    {field.state.meta.errors.join(", ")}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* 2. Amount wanted */}
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
                    {field.state.meta.errors.join(", ")}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* 3. Income type */}
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
                    {field.state.meta.errors.join(", ")}
                  </p>
                )}

                {/* Follow-up: only shown for self-employed / business-owner income */}
                {field.state.value === IncomeType.SelfEmployed &&
                  renderSelfEmployedFields()}
              </div>
            )}
          </form.Field>

          {/* 4. Tenure preferred */}
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
                    {field.state.meta.errors.join(", ")}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* 5. Age */}
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
                    {field.state.meta.errors.join(", ")}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* 6. Net monthly income */}
          <form.Field name="netMonthlyIncome">
            {(field) => (
              <div className={fieldWrapper}>
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
                    {field.state.meta.errors.join(", ")}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* 7. Existing EMIs (optional, repeatable) */}
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

                <div className="flex flex-col gap-4">
                  {field.state.value.map((_, index) => (
                    <div
                      key={index}
                      className="flex flex-col gap-3 rounded-md border border-input/50 p-3"
                    >
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
                                  {typeField.state.meta.errors.join(", ")}
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
                                    onlyDigits(e.target.value),
                                  )
                                }
                              />
                              {amountField.state.meta.errors.length > 0 && (
                                <p className={errorClass}>
                                  {amountField.state.meta.errors.join(", ")}
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
                                    onlyDecimalDigits(e.target.value),
                                  )
                                }
                              />
                              {rateField.state.meta.errors.length > 0 && (
                                <p className={errorClass}>
                                  {rateField.state.meta.errors.join(", ")}
                                </p>
                              )}
                            </div>
                          )}
                        </form.Field>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        className="self-start"
                        onClick={() => field.removeValue(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  className="self-start"
                  onClick={() =>
                    field.pushValue({ type: "", amount: "", interestRate: "" })
                  }
                >
                  <Plus className="size-4" />
                  Add EMI
                </Button>
              </div>
            )}
          </form.Field>

          {/* 8. Household/monthly expenses */}
          <form.Field name="monthlyExpenses">
            {(field) => (
              <div className={fieldWrapper}>
                <Label htmlFor={field.name}>
                  Household/monthly expenses
                  <Required />
                </Label>
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
                    {field.state.meta.errors.join(", ")}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* 9. EMI bounces */}
          <form.Field name="hadEmiBounces">
            {(field) => (
              <div className={fieldWrapper}>
                <Label>Any EMI bounces?</Label>
                <RadioGroup
                  name={field.name}
                  value={field.state.value || null}
                  onValueChange={(value) =>
                    field.handleChange((value as "yes" | "no") ?? "")
                  }
                  className="flex flex-row gap-4"
                >
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <RadioGroupItem value="yes" />
                    Yes
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <RadioGroupItem value="no" />
                    No
                  </label>
                </RadioGroup>

                {/* Follow-up: only shown when answer is "yes" */}
                {field.state.value === "yes" && (
                  <form.Field name="emiBounces" mode="array">
                    {(bouncesField) => (
                      <div className="mt-1 flex flex-col gap-4 rounded-md border border-input/50 p-4">
                        <div>
                          <p className="text-sm font-medium">
                            EMI bounce details
                          </p>
                          <p className={hintClass}>
                            Add every EMI that has bounced, with how often and
                            how recently.
                          </p>
                        </div>

                        {bouncesField.state.value.length === 0 && (
                          <p className={hintClass}>No EMI bounces added yet.</p>
                        )}

                        <div className="flex flex-col gap-4">
                          {bouncesField.state.value.map((_, index) => (
                            <div
                              key={index}
                              className="flex flex-col gap-3 rounded-md border border-input/50 p-3"
                            >
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <form.Field name={`emiBounces[${index}].type`}>
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
                                      {typeField.state.meta.errors.length >
                                        0 && (
                                        <p className={errorClass}>
                                          {typeField.state.meta.errors.join(
                                            ", ",
                                          )}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </form.Field>

                                <form.Field name={`emiBounces[${index}].amount`}>
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
                                            onlyDigits(e.target.value),
                                          )
                                        }
                                      />
                                      {amountField.state.meta.errors.length >
                                        0 && (
                                        <p className={errorClass}>
                                          {amountField.state.meta.errors.join(
                                            ", ",
                                          )}
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
                                        onChange={frequencyField.handleChange}
                                        options={EMI_BOUNCE_FREQUENCY_OPTIONS}
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
                                        onChange={recencyField.handleChange}
                                        options={Object.values(
                                          EmiBounceRecency,
                                        )}
                                        labels={EMI_BOUNCE_RECENCY_LABELS}
                                        placeholder="Select how recent"
                                      />
                                    </div>
                                  )}
                                </form.Field>
                              </div>

                              <Button
                                type="button"
                                variant="outline"
                                className="self-start"
                                onClick={() => bouncesField.removeValue(index)}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>

                        <Button
                          type="button"
                          variant="secondary"
                          className="self-start"
                          onClick={() =>
                            bouncesField.pushValue({
                              type: "",
                              amount: "",
                              frequency: "",
                              recency: "",
                            })
                          }
                        >
                          <Plus className="size-4" />
                          Add EMI bounce
                        </Button>
                      </div>
                    )}
                  </form.Field>
                )}
              </div>
            )}
          </form.Field>

          {/* 10. Existing high-cost/informal debt */}
          <form.Field name="hasHighCostDebt">
            {(field) => (
              <div className={fieldWrapper}>
                <Label>
                  Any existing high-cost/informal debt (loan apps, high-interest
                  loans)?
                </Label>
                <RadioGroup
                  name={field.name}
                  value={field.state.value || null}
                  onValueChange={(value) =>
                    field.handleChange((value as "yes" | "no") ?? "")
                  }
                  className="flex flex-row gap-4"
                >
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <RadioGroupItem value="yes" />
                    Yes
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <RadioGroupItem value="no" />
                    No
                  </label>
                </RadioGroup>

                {/* Follow-up: only shown when answer is "yes" */}
                {field.state.value === "yes" && (
                  <form.Field name="highCostDebtAmount">
                    {(subField) => (
                      <div
                        className={`${fieldWrapper} mt-1 sm:max-w-[50%]`}
                      >
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
                            subField.handleChange(onlyDigits(e.target.value))
                          }
                        />
                        {subField.state.meta.errors.length > 0 && (
                          <p className={errorClass}>
                            {subField.state.meta.errors.join(", ")}
                          </p>
                        )}
                      </div>
                    )}
                  </form.Field>
                )}
              </div>
            )}
          </form.Field>

          {/* 11. Credit score */}
          <form.Field name="creditScoreUnknown">
            {(unknownField) => (
              <form.Field name="creditScore">
                {(field) => (
                  <div className={fieldWrapper}>
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

          <p className={hintClass}>
            This form will grow smarter over time — later steps may adapt based
            on what you enter above.
          </p>

          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([canSubmit, isSubmitting]) => (
              <Button type="submit" disabled={!canSubmit}>
                {isSubmitting ? "Checking..." : "Check eligibility"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}
