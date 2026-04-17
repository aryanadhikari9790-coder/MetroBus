const STATUS_STYLES = {
  ACTIVE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  INACTIVE: "bg-slate-100 text-slate-700 border-slate-200",
  MAINTENANCE: "bg-amber-100 text-amber-700 border-amber-200",
  "ON-DUTY": "bg-sky-100 text-sky-700 border-sky-200",
  AVAILABLE: "bg-indigo-100 text-indigo-700 border-indigo-200",
  "ON-LEAVE": "bg-rose-100 text-rose-700 border-rose-200",
};

export default function StatusBadge({ status = "INACTIVE" }) {
  const key = String(status).toUpperCase();
  const classes = STATUS_STYLES[key] || STATUS_STYLES.INACTIVE;

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${classes}`}>
      {status}
    </span>
  );
}
