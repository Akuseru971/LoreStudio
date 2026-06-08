"use client";

type ResultActionsProps = {
  onReset: () => void;
};

export default function ResultActions({ onReset }: ResultActionsProps) {
  return (
    <section className="mx-auto mt-8 w-full max-w-4xl rounded-[2rem] border border-[#d9bd78]/15 bg-black/30 p-5 text-center backdrop-blur-xl sm:p-6">
      <p className="font-title text-2xl text-[#f7ebce]">The prophecy remains unfinished.</p>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[#9baabd]">
        Soon, this relic may leave the screen as a printed artifact. For now, begin another legend or keep turning the pages.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          disabled
          className="rounded-2xl border border-white/10 px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-[#738096] opacity-70"
        >
          Download PDF - coming soon
        </button>
        <button
          type="button"
          disabled
          className="rounded-2xl border border-white/10 px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-[#738096] opacity-70"
        >
          Order printed book - coming soon
        </button>
        <button
          type="button"
          onClick={onReset}
          className="gold-button rounded-2xl px-5 py-3 text-xs font-bold uppercase tracking-[0.2em]"
        >
          Generate another legend
        </button>
      </div>
    </section>
  );
}
