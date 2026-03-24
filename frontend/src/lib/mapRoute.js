export async function snapRouteToRoad(points, signal) {
  if (!Array.isArray(points) || points.length < 2) {
    return [];
  }

  const coordinates = points.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`,
    { signal }
  );

  if (!response.ok) {
    throw new Error("Unable to fetch road route.");
  }

  const data = await response.json();
  const geometry = data?.routes?.[0]?.geometry?.coordinates || [];
  return geometry
    .map(([lng, lat]) => [Number(lat), Number(lng)])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
}
