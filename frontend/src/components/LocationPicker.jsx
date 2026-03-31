import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";

const POKHARA_CENTER = [28.2096, 83.9856];

function MapClickCapture({ onPick }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng);
    },
  });

  return null;
}

function MapFocus({ position }) {
  const map = useMap();

  useEffect(() => {
    if (!position) {
      return;
    }
    map.setView(position, 15, { animate: true });
  }, [map, position]);

  return null;
}

function normalizeLocation(value) {
  if (!value) {
    return { label: "", lat: null, lng: null };
  }

  return {
    label: value.label || "",
    lat: value.lat ?? null,
    lng: value.lng ?? null,
  };
}

export default function LocationPicker({
  label,
  value,
  onChange,
  isDark,
  required = false,
  helperText = "",
}) {
  const current = normalizeLocation(value);
  const [query, setQuery] = useState(current.label);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setQuery(current.label);
  }, [current.label]);

  const markerPosition = useMemo(
    () =>
      current.lat != null && current.lng != null
        ? [Number(current.lat), Number(current.lng)]
        : POKHARA_CENTER,
    [current.lat, current.lng]
  );

  const searchPlaces = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setInfo("");
      setError("Enter a place name to search.");
      return;
    }

    setSearching(true);
    setError("");
    setInfo("");
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("countrycodes", "np");
      url.searchParams.set("limit", "5");
      url.searchParams.set("q", `${trimmed}, Pokhara, Nepal`);

      const res = await fetch(url.toString(), {
        headers: { "Accept-Language": "en" },
      });
      if (!res.ok) {
        throw new Error("search_failed");
      }

      const data = await res.json();
      setResults(data);
      setInfo(data.length ? "" : "No matching places found. Try a nearby landmark or tap directly on the map.");
    } catch {
      setError("Place search is unavailable right now. You can still select the point directly on the map.");
    } finally {
      setSearching(false);
    }
  };

  const reverseLookup = async (lat, lng) => {
    setResolving(true);
    setError("");
    setInfo("");
    try {
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lng));

      const res = await fetch(url.toString(), {
        headers: { "Accept-Language": "en" },
      });
      if (!res.ok) {
        throw new Error("reverse_failed");
      }

      const data = await res.json();
      onChange({
        label: data.display_name || `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`,
        lat: Number(lat).toFixed(6),
        lng: Number(lng).toFixed(6),
      });
      setInfo("Location updated from the map.");
    } catch {
      onChange({
        label: `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`,
        lat: Number(lat).toFixed(6),
        lng: Number(lng).toFixed(6),
      });
      setInfo("Location pinned on the map. Reverse address lookup was unavailable.");
    } finally {
      setResolving(false);
    }
  };

  const applyResult = (result) => {
    onChange({
      label: result.display_name,
      lat: Number(result.lat).toFixed(6),
      lng: Number(result.lon).toFixed(6),
    });
    setQuery(result.display_name);
    setResults([]);
    setInfo("Location selected from search.");
    setError("");
  };

  return (
    <section className={`rounded-[28px] border p-4 ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
            {label} {required ? <span className="text-rose-400">*</span> : null}
          </p>
          {helperText ? (
            <p className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{helperText}</p>
          ) : null}
        </div>
        {current.lat != null && current.lng != null ? (
          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${isDark ? "bg-emerald-500/15 text-emerald-300" : "bg-emerald-100 text-emerald-700"}`}>
            Pin Ready
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row">
        <div className="lg:w-[340px] lg:flex-none">
          <div className="flex gap-2">
            <input
              className={`flex-1 rounded-2xl border px-4 py-3 text-sm outline-none transition ${isDark ? "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-indigo-400" : "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-indigo-400"}`}
              placeholder="Search place name in Pokhara"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  searchPlaces();
                }
              }}
            />
            <button
              type="button"
              onClick={searchPlaces}
              disabled={searching}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${isDark ? "bg-indigo-500 text-white hover:bg-indigo-400 disabled:bg-indigo-500/60" : "bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-indigo-300"}`}
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {results.map((result) => (
              <button
                key={result.place_id}
                type="button"
                onClick={() => applyResult(result)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${isDark ? "border-white/10 bg-[#111827] text-slate-200 hover:border-white/20" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"}`}
              >
                <p className="text-sm font-medium">{result.display_name}</p>
              </button>
            ))}
            {!results.length && current.label ? (
              <div className={`rounded-2xl border px-4 py-3 text-sm ${isDark ? "border-white/10 bg-[#111827] text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                <p className="font-medium">{current.label}</p>
                <p className="mt-1 text-xs">
                  {current.lat}, {current.lng}
                </p>
              </div>
            ) : null}
          </div>

          {error ? <p className="mt-3 text-xs text-rose-400">{error}</p> : null}
          {info ? <p className={`mt-3 text-xs ${isDark ? "text-sky-300" : "text-sky-700"}`}>{info}</p> : null}
        </div>

        <div className="min-h-[280px] flex-1 overflow-hidden rounded-[24px] border border-black/5">
          <MapContainer center={markerPosition} zoom={13} scrollWheelZoom className="h-[320px] w-full">
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url={
                isDark
                  ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              }
            />
            <MapFocus position={markerPosition} />
            <MapClickCapture onPick={({ lat, lng }) => reverseLookup(lat, lng)} />
            {current.lat != null && current.lng != null ? (
              <CircleMarker
                center={[Number(current.lat), Number(current.lng)]}
                radius={10}
                pathOptions={{ color: "#2563eb", fillColor: "#60a5fa", fillOpacity: 0.9 }}
              />
            ) : (
              <CircleMarker
                center={POKHARA_CENTER}
                radius={8}
                pathOptions={{ color: "#475569", fillColor: "#94a3b8", fillOpacity: 0.55 }}
              />
            )}
          </MapContainer>
        </div>
      </div>

      <p className={`mt-3 text-xs ${isDark ? "text-slate-500" : "text-slate-500"}`}>
        Search a place name or tap directly on the map to pin the exact location.
        {resolving ? " Resolving address..." : ""}
      </p>
    </section>
  );
}
