"use client";

import { useEffect, useState, useId } from "react";
import { fetchVehicles } from "@/lib/api";

export interface VehicleSelection {
  year: number | null;
  make: string | null;
  model: string | null;
  vehiclePrice: number | null;
}

interface VehicleSelectorProps {
  value: VehicleSelection;
  onChange: (v: VehicleSelection) => void;
  error?: string;
}

const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + 1 - i);

const selectBase: React.CSSProperties = {
  width: "100%",
  padding: "0.75rem 1rem",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  color: "#0f172a",
  fontSize: "0.9375rem",
  fontFamily: "inherit",
  appearance: "none",
  WebkitAppearance: "none",
  transition: "border-color 0.15s",
  cursor: "pointer",
};

const disabledSelect: React.CSSProperties = {
  ...selectBase,
  background: "#f8fafc",
  color: "#94a3b8",
  cursor: "not-allowed",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "#64748b",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  marginBottom: "0.375rem",
};

function LoadingDot() {
  return (
    <span aria-hidden="true" style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#4f9cf9", marginLeft: 6, animation: "pulse 1s ease-in-out infinite" }} />
  );
}

export default function VehicleSelector({ value, onChange, error }: VehicleSelectorProps) {
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loadingMakes, setLoadingMakes] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [staleWarning, setStaleWarning] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const yearId = useId();
  const makeId = useId();
  const modelId = useId();
  const priceId = useId();

  // Fetch makes when year changes
  useEffect(() => {
    if (!value.year) { setMakes([]); return; }
    setLoadingMakes(true);
    setFetchError(null);
    setMakes([]);
    setModels([]);
    onChange({ ...value, make: null, model: null, vehiclePrice: null });

    fetchVehicles({ year: value.year })
      .then(({ vehicles, cacheZone }) => {
        const uniqueMakes = [...new Set(vehicles.map(v => v.make).filter(Boolean))].sort();
        setMakes(uniqueMakes);
        if (uniqueMakes.length === 0) setFetchError("No vehicle data found for this year. The vehicle database may be temporarily unavailable.");
        if (cacheZone === "stale") setStaleWarning(true);
      })
      .catch(() => setFetchError("Could not load vehicle makes. Check that the backend is running, then try selecting the year again."))
      .finally(() => setLoadingMakes(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.year]);

  // Fetch models when make changes
  useEffect(() => {
    if (!value.year || !value.make) { setModels([]); return; }
    setLoadingModels(true);
    setFetchError(null);
    setModels([]);
    onChange({ ...value, model: null, vehiclePrice: null });

    fetchVehicles({ year: value.year, make: value.make })
      .then(({ vehicles, cacheZone }) => {
        const uniqueModels = [...new Set(vehicles.map(v => v.model).filter(Boolean))].sort();
        setModels(uniqueModels);
        if (uniqueModels.length === 0) setFetchError("No models found for this make and year.");
        if (cacheZone === "stale") setStaleWarning(true);
      })
      .catch(() => setFetchError("Could not load vehicle models. Check that the backend is running, then try again."))
      .finally(() => setLoadingModels(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.make]);

  const selectStyle = (disabled: boolean): React.CSSProperties =>
    disabled ? disabledSelect : { ...selectBase, borderColor: "#e2e8f0" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        select option { background: #ffffff; color: #0f172a; }
        select:focus { border-color: #4f9cf9 !important; outline: none; }
        input[type="number"]:focus { border-color: #4f9cf9 !important; outline: none; }
      `}</style>

      {staleWarning && (
        <div className="stale-banner" role="status" aria-live="polite">
          <span>⚠️</span>
          <span>Vehicle data may be outdated. Live data temporarily unavailable.</span>
        </div>
      )}

      {/* Year */}
      <div>
        <label htmlFor={yearId} style={labelStyle}>Model Year</label>
        <div style={{ position: "relative" }}>
          <select id={yearId} value={value.year ?? ""} aria-required="true"
            onChange={e => onChange({ year: Number(e.target.value) || null, make: null, model: null, vehiclePrice: null })}
            style={selectStyle(false)}>
            <option value="">Select year…</option>
            {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#94a3b8", fontSize: 12 }}>▼</span>
        </div>
      </div>

      {/* Make */}
      <div>
        <label htmlFor={makeId} style={labelStyle}>Make {loadingMakes && <LoadingDot />}</label>
        <div style={{ position: "relative" }}>
          <select id={makeId} value={value.make ?? ""} disabled={!value.year || loadingMakes} aria-required="true"
            aria-disabled={!value.year || loadingMakes}
            onChange={e => onChange({ ...value, make: e.target.value || null, model: null, vehiclePrice: null })}
            style={selectStyle(!value.year || loadingMakes)}>
            <option value="">{loadingMakes ? "Loading makes…" : "Select make…"}</option>
            {makes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#94a3b8", fontSize: 12 }}>▼</span>
        </div>
      </div>

      {/* Model */}
      <div>
        <label htmlFor={modelId} style={labelStyle}>Model {loadingModels && <LoadingDot />}</label>
        <div style={{ position: "relative" }}>
          <select id={modelId} value={value.model ?? ""} disabled={!value.make || loadingModels} aria-required="true"
            aria-disabled={!value.make || loadingModels}
            onChange={e => onChange({ ...value, model: e.target.value || null, vehiclePrice: null })}
            style={selectStyle(!value.make || loadingModels)}>
            <option value="">{loadingModels ? "Loading models…" : "Select model…"}</option>
            {models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#94a3b8", fontSize: 12 }}>▼</span>
        </div>
      </div>

      {/* Vehicle Price — shown once model is selected */}
      {value.model && (
        <div>
          <label htmlFor={priceId} style={labelStyle}>Vehicle Price (MSRP)</label>
          <p style={{ fontSize: "0.8125rem", color: "#64748b", marginBottom: "0.5rem", marginTop: "-0.125rem" }}>
            Enter the sticker price or asking price of the vehicle.
          </p>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: "0.9375rem", pointerEvents: "none" }}>$</span>
            <input
              id={priceId}
              type="number"
              min={1}
              max={500000}
              step={100}
              placeholder="e.g. 32000"
              value={value.vehiclePrice ?? ""}
              onChange={e => onChange({ ...value, vehiclePrice: Number(e.target.value) || null })}
              aria-required="true"
              style={{ ...selectBase, paddingLeft: "1.75rem", cursor: "text" }}
            />
          </div>
        </div>
      )}

      {fetchError && (
        <p role="alert" aria-live="polite" style={{ fontSize: "0.8125rem", color: "#dc2626", background: "rgba(220,38,38,0.06)", borderRadius: 8, padding: "0.625rem 0.875rem", margin: 0 }}>
          {fetchError}
        </p>
      )}

      {error && (
        <p role="alert" aria-live="polite" style={{ fontSize: "0.8125rem", color: "#dc2626", margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}
