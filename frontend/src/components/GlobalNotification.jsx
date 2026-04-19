import React, { useEffect } from "react";
import { useNotification } from "../NotificationContext";

export default function GlobalNotification() {
  const { notification, close } = useNotification();

  useEffect(() => {
    if (notification && notification.type === "success") {
      const timer = setTimeout(close, 4000);
      return () => clearTimeout(timer);
    }
  }, [notification, close]);

  if (!notification) return null;

  const isError = notification.type === "error";
  const isSuccess = notification.type === "success";

  const variants = {
    error: "border-rose-500/50 bg-rose-500/10 text-rose-200",
    success: "border-emerald-500/50 bg-emerald-500/10 text-emerald-200",
    info: "border-sky-500/50 bg-sky-500/10 text-sky-200",
  };

  const currentVariant = variants[notification.type] || variants.info;

  return (
    <div className="fixed inset-x-0 top-6 z-[9999] flex justify-center px-4 animate-in fade-in slide-in-from-top-4 duration-300">
      <div 
        className={`flex max-w-md w-full items-center justify-between gap-4 rounded-[1.2rem] border p-4 shadow-2xl backdrop-blur-xl ${currentVariant}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isError ? "bg-rose-500/20" : isSuccess ? "bg-emerald-500/20" : "bg-sky-500/20"}`}>
            {isError ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : isSuccess ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )}
          </div>
          <p className="text-sm font-bold leading-tight line-clamp-3">{notification.message}</p>
        </div>
        
        <button 
          onClick={close}
          className="rounded-full p-1 transition hover:bg-white/10"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}
