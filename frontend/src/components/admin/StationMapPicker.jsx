import { useMapEvents } from "react-leaflet";

export default function StationMapPicker({ onPick }) {
  useMapEvents({
    click(event) {
      onPick?.(event.latlng);
    },
  });

  return null;
}
