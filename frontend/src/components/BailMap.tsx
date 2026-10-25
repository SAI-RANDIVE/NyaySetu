import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CheckInRow } from "../lib/api";
import { formatDateTime, formatMetres } from "../lib/format";

/**
 * The bail geo-fence and the check-ins against it, on OpenStreetMap tiles.
 * Circle markers rather than image pins, so no marker assets are needed.
 * Shown only to the judge and the parties the bail route already admits.
 */
export default function BailMap({
  centre,
  radiusMetres,
  checkins,
}: {
  centre: { lat: number; lng: number };
  radiusMetres: number;
  checkins: CheckInRow[];
}) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!el.current) return;
    const map = L.map(el.current, { scrollWheelZoom: false, attributionControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const fence = radiusMetres > 0 ? L.circle([centre.lat, centre.lng], { radius: radiusMetres, color: "#1d4ed8", weight: 2, fillOpacity: 0.08 }).addTo(map) : null;
    L.circleMarker([centre.lat, centre.lng], { radius: 5, color: "#1d4ed8", fillColor: "#1d4ed8", fillOpacity: 1 })
      .bindTooltip("Permitted residence")
      .addTo(map);

    const points: L.LatLngExpression[] = [[centre.lat, centre.lng]];
    for (const c of checkins) {
      if (c.gps_lat == null || c.gps_lng == null) continue;
      const colour = c.within_fence ? "#15803d" : "#b91c1c";
      L.circleMarker([c.gps_lat, c.gps_lng], { radius: 7, color: "#ffffff", weight: 2, fillColor: colour, fillOpacity: 1 })
        .bindPopup(
          `<strong>${c.within_fence ? "Within the fence" : "Outside the fence"}</strong><br/>${formatDateTime(c.occurred_at)}` +
            (c.distance_metres != null ? `<br/>${formatMetres(c.distance_metres)} from residence` : ""),
        )
        .addTo(map);
      points.push([c.gps_lat, c.gps_lng]);
    }

    const bounds = fence ? fence.getBounds() : L.latLngBounds(points);
    for (const p of points) bounds.extend(p);
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });

    return () => {
      map.remove();
    };
  }, [centre.lat, centre.lng, radiusMetres, checkins]);

  return <div ref={el} className="h-80 w-full overflow-hidden rounded-xl border border-border" role="img" aria-label="Map of the bail geo-fence and check-in locations" />;
}
