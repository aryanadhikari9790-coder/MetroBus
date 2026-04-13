import { MetroBusMark, MetroBusWordmark } from "../passenger/PassengerUI";

export default function PaymentPendingView() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8f2f6_0%,#ffffff_100%)] px-4 py-12 text-[#27133f]">
      <div className="mx-auto max-w-md">
        <div className="mb-12 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.4rem] bg-white shadow-[0_14px_30px_rgba(0,0,0,0.05)]">
            <div className="grid h-12 w-12 place-items-center rounded-[0.9rem] bg-[linear-gradient(135deg,#34155d,#ff6b73)] text-white shadow-[0_10px_22px_rgba(52,21,93,0.16)]">
              <MetroBusMark className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 opacity-80 scale-90 origin-center">
            <MetroBusWordmark />
          </div>
        </div>

        <div className="rounded-[2.5rem] bg-white p-12 text-center shadow-[0_24px_50px_rgba(52,21,93,0.08)] border border-slate-50">
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-slate-50">
            <div className="h-12 w-12 animate-spin rounded-full border-[5px] border-slate-200 border-t-[#34155d]"></div>
          </div>
          
          <h1 className="text-[2rem] font-black text-[#111827]">Verifying Payment</h1>
          <p className="mt-4 text-base font-medium leading-relaxed text-slate-500">
            Please wait while we confirm your transaction with the payment gateway. This usually takes a few seconds.
          </p>
          
          <div className="mt-10 flex flex-col items-center gap-2">
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-full origin-left animate-[loading-bar_2s_infinite_ease-in-out] bg-[linear-gradient(90deg,#34155d,#ff6b73)]"></div>
            </div>
            <span className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-slate-400">Secure Handshake</span>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes loading-bar {
          0% { transform: scaleX(0); opacity: 0.1; }
          50% { transform: scaleX(1); opacity: 0.5; }
          100% { transform: scaleX(0); transform-origin: right; opacity: 0.1; }
        }
      `}} />
    </div>
  );
}
