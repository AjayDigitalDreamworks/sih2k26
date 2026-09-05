import React, { useEffect, useState } from "react";
import ApiClient from "@/lib/api";
import { Route, Timer, MapPin, Gauge, TrendingUp, Activity } from "lucide-react";

const fmtTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const fmtDuration = (min) => {
  if (min == null) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m`;
};

/**
 * Trip end summary — computed server-side from REAL persisted GPS history
 * (start/end time, distance, stops, top speed, avg speed). Shows the last
 * completed trip of the selected vehicle, or an honest empty state.
 */
export const TripSummaryCard = ({ vehicleId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!vehicleId) {
      setData(null);
      return undefined;
    }
    setLoading(true);
    ApiClient.getTripSummary(vehicleId)
      .then((res) => {
        if (alive && res?.success && res.data) setData(res.data);
        else if (alive) setData(null);
      })
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [vehicleId]);

  if (!vehicleId) {
    return (
      <div className="card" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13, padding: 16 }}>
        Select a vehicle to see its trip summary.
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="card" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13, padding: 16 }}>
        Loading trip summary from real GPS history…
      </div>
    );
  }

  if (!data?.hasData) {
    return (
      <div className="card" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13, padding: 16, textAlign: "center" }}>
        No GPS history yet for this vehicle. Trip summary appears automatically after a tracked trip ends.
      </div>
    );
  }

  const row = (icon, label, value, sub) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      {icon}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>
          {value}
          {sub && <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginLeft: 6 }}>{sub}</span>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="card" style={{ height: "100%" }}>
      <div className="card-header" style={{ marginBottom: 4 }}>
        <div>
          <h2 className="card-title" style={{ margin: 0 }}>Trip Summary</h2>
          <span className="card-subtitle">Computed from real GPS history</span>
        </div>
        <span className="status-badge" style={{ background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0" }}>
          {data.status}
        </span>
      </div>

      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
        Trip <b style={{ color: "var(--text-primary)" }}>{data.tripId}</b>
        {data.route && <span> · Route {data.route}</span>}
        {(data.origin || data.destination) && (
          <div style={{ marginTop: 2 }}>
            {data.origin} <span style={{ color: "var(--text-muted)" }}>→</span> {data.destination}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <div>
          {row(<Timer size={14} color="#3B82F6" />, "Start", fmtTime(data.startedAt))}
          {row(<Timer size={14} color="#8B5CF6" />, "End", fmtTime(data.endedAt))}
          {row(<Activity size={14} color="#2563EB" />, "Duration", fmtDuration(data.durationMinutes), `${data.pointCount} GPS points`)}
        </div>
        <div>
          {row(<Route size={14} color="#059669" />, "Distance", `${data.distanceKm} km`)}
          {row(<Gauge size={14} color="#EF4444" />, "Top speed", `${data.topSpeedKmh} km/h`)}
          {row(<TrendingUp size={14} color="#D97706" />, "Avg speed", `${data.avgSpeedKmh} km/h`)}
        </div>
      </div>

      <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
        <MapPin size={13} color="#F59E0B" />
        <b style={{ color: "var(--text-primary)" }}>{data.stopCount}</b> stop{data.stopCount === 1 ? "" : "s"}
        {data.stops?.length > 0 && (
          <span style={{ marginLeft: 4 }}>
            · {data.stops.slice(0, 3).map((s) => `${fmtTime(s.arrivalTime)} (${s.durationMinutes}m)`).join(", ")}
            {data.stops.length > 3 ? "…" : ""}
          </span>
        )}
      </div>
    </div>
  );
};

export default TripSummaryCard;