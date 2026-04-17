import { useMemo } from "react";
import dummyPassengerPhoto from "../../assets/dummy-passenger-photo.svg";
import dummySeatPhoto from "../../assets/dummy-seat-photo.svg";

function SeatIcon({ className = "h-7 w-7" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M8 5a2 2 0 0 1 2 2v2.5h4V7a2 2 0 1 1 4 0v7h-2v5h-2v-5H9l-2.2 3.6A1 1 0 0 1 5 17V9a4 4 0 0 1 3-4Z" />
      <path d="M9 11h8" />
    </svg>
  );
}

function BadgeIcon({ className = "h-7 w-7", mode = "passenger" }) {
  if (mode === "helper") {
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M12 3 5.5 6.2V11c0 4.1 2.9 7.8 6.5 9.5 3.6-1.7 6.5-5.4 6.5-9.5V6.2L12 3Z" />
        <path d="m9.5 12.2 1.6 1.6 3.5-4" />
      </svg>
    );
  }

  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <rect x="5" y="4.5" width="14" height="15" rx="2.5" />
      <circle cx="12" cy="10" r="2.6" />
      <path d="M8.2 16.2c.9-1.6 2.2-2.4 3.8-2.4s2.9.8 3.8 2.4" />
    </svg>
  );
}

function PreviewPhoto({ src, alt }) {
  return (
    <div className="relative h-16 w-16 overflow-hidden rounded-[1.4rem] border border-[rgba(75,38,102,0.08)] bg-[rgba(241,235,246,0.94)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] sm:h-20 sm:w-20">
      <img src={src} alt={alt} className="h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 rounded-[1.4rem] shadow-[inset_0_-24px_28px_rgba(255,255,255,0.15)]" />
    </div>
  );
}

function rowValue(rowLabel) {
  return rowLabel.split("").reduce((value, char) => (value * 26) + (char.charCodeAt(0) - 64), 0);
}

function formatSeatLabel(seatNo) {
  const alphaFirst = /^([A-Za-z]+)(\d+)$/.exec(seatNo || "");
  if (alphaFirst) return `${alphaFirst[2]}${alphaFirst[1].toUpperCase()}`;

  const numberFirst = /^(\d+)([A-Za-z]+)$/.exec(seatNo || "");
  if (numberFirst) return `${numberFirst[1]}${numberFirst[2].toUpperCase()}`;

  return seatNo || "--";
}

function parseSeatPosition(seat, index) {
  const alphaFirst = /^([A-Za-z]+)(\d+)$/.exec(seat?.seat_no || "");
  if (alphaFirst) {
    const columnLabel = alphaFirst[1].toUpperCase();
    const rowNumber = Number(alphaFirst[2]);
    return {
      rowLabel: String(rowNumber),
      rowOrder: rowNumber,
      column: rowValue(columnLabel),
      displaySeatNo: `${rowNumber}${columnLabel}`,
    };
  }

  const numberFirst = /^(\d+)([A-Za-z]+)$/.exec(seat?.seat_no || "");
  if (numberFirst) {
    const rowNumber = Number(numberFirst[1]);
    const columnLabel = numberFirst[2].toUpperCase();
    return {
      rowLabel: String(rowNumber),
      rowOrder: rowNumber,
      column: rowValue(columnLabel),
      displaySeatNo: `${rowNumber}${columnLabel}`,
    };
  }

  if (!seat?.seat_no) {
    return {
      rowLabel: `ROW${index + 1}`,
      rowOrder: index + 1,
      column: index + 1,
      displaySeatNo: `S${index + 1}`,
    };
  }

  return {
    rowLabel: String(index + 1),
    rowOrder: index + 1,
    column: index + 1,
    displaySeatNo: formatSeatLabel(seat.seat_no),
  };
}

function buildRows(seats) {
  const grouped = new Map();

  seats.forEach((seat, index) => {
    const meta = parseSeatPosition(seat, index);
    const bucket = grouped.get(meta.rowLabel) || [];
    bucket.push({ ...seat, ...meta });
    grouped.set(meta.rowLabel, bucket);
  });

  return [...grouped.entries()]
    .sort((left, right) => left[1][0].rowOrder - right[1][0].rowOrder)
    .map(([rowLabel, rowSeats]) => ({
      rowLabel,
      seats: rowSeats.sort((left, right) => left.column - right.column),
    }));
}

function helperAppearance(seat, selected) {
  if (seat.available) {
    return {
      tile: "border-[rgba(75,38,102,0.14)] bg-white/88 text-[var(--primary)] shadow-[0_8px_18px_rgba(75,38,102,0.08)]",
      marker: "bg-emerald-500",
      label: "Open",
      selected: "ring-[rgba(255,138,31,0.9)]",
    };
  }

  if (seat.payment_verified) {
    return {
      tile: "border-transparent bg-[linear-gradient(180deg,#4b2666_0%,#5a3279_100%)] text-white shadow-[0_14px_28px_rgba(75,38,102,0.22)]",
      marker: "bg-emerald-400",
      label: seat.offline_boarding_id ? "Cash OK" : "Paid",
      selected: "ring-[rgba(255,138,31,0.9)]",
    };
  }

  return {
    tile: "border-transparent bg-[linear-gradient(180deg,#4b2666_0%,#6d3d9b_100%)] text-white shadow-[0_14px_28px_rgba(75,38,102,0.22)]",
    marker: seat.offline_boarding_id ? "bg-[#ffb15c]" : "bg-[#ff8a1f]",
    label: seat.offline_boarding_id ? "Cash" : "Due",
    selected: "ring-[rgba(255,138,31,0.9)]",
  };
}

function passengerAppearance(seat, selected) {
  if (selected || seat.held_by_me) {
    return {
      tile: "border-transparent bg-[linear-gradient(135deg,#ff8a1f_0%,#ffa46e_100%)] text-white shadow-[0_14px_30px_rgba(255,138,31,0.28)]",
      marker: "bg-white/90",
      label: selected ? "Selected" : "Held",
      selected: "ring-[rgba(255,138,31,0.35)]",
    };
  }

  if (seat.available) {
    return {
      tile: "border-[rgba(75,38,102,0.14)] bg-white/88 text-[var(--primary)] shadow-[0_8px_18px_rgba(75,38,102,0.08)]",
      marker: "bg-transparent",
      label: "Available",
      selected: "ring-[rgba(75,38,102,0.16)]",
    };
  }

  return {
    tile: "border-transparent bg-[linear-gradient(180deg,#4b2666_0%,#5a3279_100%)] text-white shadow-[0_14px_28px_rgba(75,38,102,0.22)]",
    marker: "bg-[rgba(255,255,255,0.82)]",
    label: seat.occupant_kind === "HOLD" ? "Held" : "Occupied",
    selected: "ring-[rgba(75,38,102,0.18)]",
  };
}

function legendForMode(mode) {
  if (mode === "helper") {
    return [
      { label: "Available", swatch: "border border-[rgba(75,38,102,0.18)] bg-white/90" },
      { label: "Occupied", swatch: "bg-[linear-gradient(180deg,#4b2666_0%,#5a3279_100%)]" },
      { label: "Paid / Collected", swatch: "bg-emerald-500" },
      { label: "Payment Due", swatch: "bg-[#ff8a1f]" },
    ];
  }

  return [
    { label: "Available", swatch: "border border-[rgba(75,38,102,0.18)] bg-white/90" },
    { label: "Occupied", swatch: "bg-[linear-gradient(180deg,#4b2666_0%,#5a3279_100%)]" },
    { label: "Selected", swatch: "bg-[linear-gradient(135deg,#ff8a1f_0%,#ffa46e_100%)]" },
  ];
}

function SeatTile({ seat, mode, selected, onSeatClick }) {
  const appearance = mode === "helper" ? helperAppearance(seat, selected) : passengerAppearance(seat, selected);
  const interactive = typeof onSeatClick === "function";
  const seatLabel = seat.displaySeatNo || formatSeatLabel(seat.seat_no);

  return (
    <button
      type="button"
      onClick={() => interactive && onSeatClick(seat)}
      className={`relative flex h-[4.55rem] w-[4.55rem] shrink-0 flex-col items-center justify-center rounded-[1.12rem] border transition hover:translate-y-[-1px] ${appearance.tile} ${selected ? `ring-2 ring-offset-2 ring-offset-transparent ${appearance.selected}` : ""} ${interactive ? "" : "cursor-default"}`}
    >
      <span className={`absolute right-2 top-2 h-2.5 w-2.5 rounded-full ${appearance.marker}`} />
      <span className="text-[1rem] font-black tracking-[0.02em]">{seatLabel}</span>
      <span className={`mt-1 text-[0.52rem] font-black uppercase tracking-[0.16em] ${mode === "passenger" && seat.available && !selected ? "text-[var(--muted)]" : "opacity-85"}`}>{appearance.label}</span>
    </button>
  );
}

export default function MetroSeatBoard({
  title = "Seat Selection",
  routeName,
  busLabel,
  seats = [],
  mode = "passenger",
  selectedSeatIds = [],
  activeSeatId = null,
  onSeatClick,
  loading = false,
  loadingMessage = "Loading seat layout...",
  emptyMessage = "Seat layout is not ready for this bus yet.",
  summarySlot = null,
  className = "",
}) {
  const rows = useMemo(() => buildRows(seats), [seats]);
  const maxColumns = useMemo(() => rows.reduce((max, row) => Math.max(max, row.seats.length), 0), [rows]);
  const aisleAfter = Math.max(1, Math.ceil(maxColumns / 2));
  const legends = useMemo(() => legendForMode(mode), [mode]);
  const leftPreview = mode === "helper" ? dummySeatPhoto : dummySeatPhoto;
  const rightPreview = mode === "helper" ? dummyPassengerPhoto : dummyPassengerPhoto;

  return (
    <div className={`rounded-[2.3rem] border border-[rgba(75,38,102,0.1)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(252,248,245,0.98)_100%)] p-5 shadow-[0_28px_54px_rgba(75,38,102,0.08)] sm:p-7 ${className}`}>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.34em] text-[var(--muted)]">{title}</p>
          <h3 className="mt-3 break-words text-[1.5rem] font-black leading-[1.08] text-[var(--text)] sm:text-[2.1rem]">{routeName || "MetroBus Seat Layout"}</h3>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-[0.66rem] font-black uppercase tracking-[0.3em] text-[var(--muted)]">Bus No.</p>
          <p className="mt-3 break-words text-[1.15rem] font-black text-[var(--primary)] sm:text-[1.7rem]">{busLabel || "--"}</p>
        </div>
      </div>

      <div className="mt-6 rounded-[2.25rem] border border-[rgba(75,38,102,0.06)] bg-[linear-gradient(180deg,#ffffff_0%,#fffdfa_100%)] p-5 shadow-[0_22px_44px_rgba(75,38,102,0.06)] sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <PreviewPhoto src={leftPreview} alt={mode === "helper" ? "Bus seat preview" : "Seat preview"} />
          <div className="min-w-0 flex-1 px-2 text-center">
            <div className="mx-auto h-2.5 w-28 rounded-full bg-[rgba(75,38,102,0.16)]" />
            <p className="mt-4 text-[0.74rem] font-black uppercase tracking-[0.34em] text-[var(--muted)]">Front Of Bus</p>
          </div>
          <PreviewPhoto src={rightPreview} alt={mode === "helper" ? "Passenger preview" : "Bus rider preview"} />
        </div>

        <div className="mt-6 border-t border-[rgba(75,38,102,0.08)] pt-6">
          {loading ? (
            <div className="rounded-[2rem] border border-dashed border-[rgba(75,38,102,0.12)] bg-[rgba(248,244,250,0.56)] px-5 py-14 text-center text-sm font-semibold text-[var(--muted)]">{loadingMessage}</div>
          ) : !rows.length ? (
            <div className="rounded-[2rem] border border-dashed border-[rgba(75,38,102,0.12)] bg-[rgba(248,244,250,0.56)] px-5 py-14 text-center text-sm font-semibold text-[var(--muted)]">{emptyMessage}</div>
          ) : (
            <div className="space-y-3.5">
              {rows.map((row) => {
                const leftSeats = row.seats.filter((seat) => seat.column <= aisleAfter);
                const rightSeats = row.seats.filter((seat) => seat.column > aisleAfter);
                return (
                  <div key={row.rowLabel} className="flex items-center justify-center gap-4 sm:gap-7">
                    <div className="flex min-w-0 flex-1 justify-end gap-2.5 sm:gap-3">
                      {leftSeats.map((seat) => (
                        <SeatTile
                          key={seat.seat_id || seat.seat_no}
                          seat={seat}
                          mode={mode}
                          selected={mode === "passenger" ? selectedSeatIds.includes(seat.seat_id) : Number(activeSeatId) === Number(seat.seat_id)}
                          onSeatClick={onSeatClick}
                        />
                      ))}
                    </div>
                    <div className="h-px w-7 bg-transparent sm:w-12" />
                    <div className="flex min-w-0 flex-1 justify-start gap-2.5 sm:gap-3">
                      {rightSeats.map((seat) => (
                        <SeatTile
                          key={seat.seat_id || seat.seat_no}
                          seat={seat}
                          mode={mode}
                          selected={mode === "passenger" ? selectedSeatIds.includes(seat.seat_id) : Number(activeSeatId) === Number(seat.seat_id)}
                          onSeatClick={onSeatClick}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-[0.72rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
        {legends.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-2.5">
            <span className={`h-4 w-4 rounded-[0.45rem] ${item.swatch}`} />
            {item.label}
          </span>
        ))}
      </div>

      {summarySlot ? <div className="mt-4">{summarySlot}</div> : null}
    </div>
  );
}
