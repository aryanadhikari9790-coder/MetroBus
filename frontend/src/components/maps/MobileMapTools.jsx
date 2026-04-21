import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, useMap } from "react-leaflet";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function SmartMapViewport({
  points,
  fitKey,
  singleZoom = 13,
  maxZoom = 13,
  padding = [42, 42],
}) {
  const map = useMap();
  const lastAppliedFitRef = useRef(null);

  useEffect(() => {
    if (!points?.length) return;
    const nextKey = fitKey || JSON.stringify(points);
    if (lastAppliedFitRef.current === nextKey) return;
    lastAppliedFitRef.current = nextKey;

    if (points.length === 1) {
      map.setView(points[0], Math.min(singleZoom, maxZoom), { animate: false });
      return;
    }

    map.fitBounds(points, { padding, maxZoom, animate: false });
  }, [fitKey, map, maxZoom, padding, points, singleZoom]);

  return null;
}

export function AdaptiveCircleMarker({
  baseRadius = 5,
  minRadius = 3,
  maxRadius = 8,
  baseZoom = 12,
  zoomStep = 0.4,
  ...props
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useEffect(() => {
    const handleZoom = () => setZoom(map.getZoom());
    map.on("zoomend", handleZoom);
    return () => {
      map.off("zoomend", handleZoom);
    };
  }, [map]);

  const radius = useMemo(
    () => clamp(baseRadius + (zoom - baseZoom) * zoomStep, minRadius, maxRadius),
    [baseRadius, baseZoom, maxRadius, minRadius, zoom, zoomStep],
  );

  return <CircleMarker radius={radius} {...props} />;
}
