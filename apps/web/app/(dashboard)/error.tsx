"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-foundry-page px-5 py-10 text-foundry-text-primary">
      <div className="bg-foundry-panel border border-foundry-hairline p-8 flex flex-col gap-6 text-center max-w-md">
        <h2 className="text-foundry-hazard font-cond tracking-widest uppercase text-xl">
          System Fault
        </h2>
        <p className="text-foundry-text-secondary text-sm">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="bg-foundry-inset border border-foundry-subrule px-4 py-2 text-sm font-cond uppercase tracking-widest hover:bg-foundry-panel2 transition-colors"
        >
          Retry Route
        </button>
      </div>
    </div>
  );
}
