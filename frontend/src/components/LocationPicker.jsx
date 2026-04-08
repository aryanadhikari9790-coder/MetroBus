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
    if (!position) return;
    map.setView(position, 15, { animate: true });
  }, [map, position]);

  return null;
}

function normalizeLocation(value) {
  if (!value) return { label: "", lat: null, lng: null };
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
    [current.lat, current.lng],
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

      const response = await fetch(url.toString(), {
        headers: { "Accept-Language": "en" },
      });
      if (!response.ok) throw new Error("search_failed");

      const data = await response.json();
      setResults(data);
      setInfo(data.length ? "" : "No matching places found. Try a nearby landmark or tap the map directly.");
    } catch {
      setError("Place search is unavailable right now. You can still pin the location on the map.");
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

      const response = await fetch(url.toString(), {
        headers: { "Accept-Language": "en" },
      });
      if (!response.ok) throw new Error("reverse_failed");

      const data = await response.json();
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
    <section className="overflow-hidden rounded-[2rem] bg-[var(--mb-card-soft)]">
      <div className="px-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#241828]">
              {label} {required ? <span className="text-rose-500">*</span> : null}
            </p>
            {helperText ? <p className="mt-1 text-xs leading-5 text-[#6d6581]">{helperText}</p> : null}
          </div>
          {current.lat != null && current.lng != null ? (
            <span className="rounded-full bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--mb-accent)]">
              Pinned
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-full bg-white px-4 py-3 text-sm font-medium text-[#241828] outline-none placeholder:text-[#aea5bf]"
            placeholder={`Search ${label.toLowerCase()}`}
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
            className="rounded-full bg-[linear-gradient(135deg,var(--mb-accent),var(--mb-accent-2))] px-4 py-3 text-sm font-black text-white shadow-[var(--mb-shadow-strong)] disabled:opacity-60"
          >
            {searching ? "..." : "Search"}
          </button>
        </div>

        {results.length ? (
          <div className="mt-3 space-y-2">
            {results.map((result) => (
              <button
                key={result.place_id}
                type="button"
                onClick={() => applyResult(result)}
                className="w-full rounded-[1.25rem] bg-white px-4 py-3 text-left text-sm font-medium text-[#3c354a] shadow-[0_10px_18px_rgba(67,49,117,0.06)]"
              >
                {result.display_name}
              </button>
            ))}
          </div>
        ) : null}

        {!results.length && current.label ? (
          <div className="mt-3 rounded-[1.25rem] bg-white px-4 py-3 text-sm shadow-[0_10px_18px_rgba(67,49,117,0.06)]">
            <p className="font-semibold text-[#241828]">{current.label}</p>
            <p className="mt-1 text-xs text-[#6d6581]">
              {current.lat}, {current.lng}
            </p>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-xs font-medium text-red-600">{error}</p> : null}
        {info ? <p className="mt-3 text-xs font-medium text-[var(--mb-accent)]">{info}</p> : null}
      </div>

      <div className="relative mt-4 overflow-hidden rounded-[1.8rem]">
        <MapContainer center={markerPosition} zoom={13} scrollWheelZoom className="h-[250px] w-full">
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <MapFocus position={markerPosition} />
          <MapClickCapture onPick={({ lat, lng }) => reverseLookup(lat, lng)} />
          {current.lat != null && current.lng != null ? (
            <CircleMarker
              center={[Number(current.lat), Number(current.lng)]}
              radius={10}
              pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#ff6b73", fillOpacity: 1 }}
            />
          ) : (
            <CircleMarker
              center={POKHARA_CENTER}
              radius={8}
              pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#ff9b91", fillOpacity: 0.85 }}
            />
          )}
        </MapContainer>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(46,18,79,0.08),rgba(46,18,79,0.2))]" />
        <div className="absolute bottom-4 left-4 rounded-full bg-white/92 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--mb-accent)] shadow-[0_10px_22px_rgba(17,9,40,0.18)]">
          Tap map to pin
        </div>
      </div>

      <p className="px-4 pb-4 pt-3 text-xs text-[#6f6883]">
        Search a place name or tap directly on the map to pin the exact location.{resolving ? " Resolving address..." : ""}
      </p>
    </section>
  );
}
