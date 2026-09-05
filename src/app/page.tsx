import LoanEligibilityForm from "@/components/LoanEligibilityForm";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10">
      <h2 className="text-xl font-semibold">Copilot</h2>
      <LoanEligibilityForm />
    </div>
  );
}
