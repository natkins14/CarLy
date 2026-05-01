"use client";

// ─────────────────────────────────────────────────────────────────────────────
// components/VehicleSelector.tsx
// Cascading Year → Make → Model → Trim vehicle selector.
// Each dropdown disabled until its predecessor resolves.
// Fetches from GET /cars/ via fetchVehicles().
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useId } from "react";
import { fetchVehicles } from "@/lib/api";
import type { VehicleRecord } from "@/types";

export interface VehicleSelection {
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  msrp: number | null;
  manualMsrp: number | null;
}

interface VehicleSelectorProps {
  value: VehicleSelection;
  onChange: (v: VehicleSelection) => void;
  error?: string;
}

const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + 1 - i);

const inputBase: React.CSSProperties = {
  width: "100%",
  padding: "0.75rem 1rem",
  background: "#0e1117",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "10px",
  color: "#e8eaf0",
  fontSize: "0.9375rem",
  fontFamily: "inherit",
  appearance: "none",
  WebkitAppearance: "none",
  transition: "border-color 0.15s",
  cursor: "pointer",
};

const disabledInput: React.CSSProperties = {
  ...inputBase,
  opacity: 0.4,
  cursor: "not-allowed",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "#8b90a8",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  marginBottom: "0.375rem",
};

function LoadingDot() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: "#4f9cf9",
        marginLeft: 6,
        animation: "pulse 1s ease-in-out infinite",
      }}
    />
  );
}

export default function VehicleSelector({ value, onChange, error }: VehicleSelectorProps) {
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [trims, setTrims] = useState<VehicleRecord[]>([]);
  const [loadingMakes, setLoadingMakes] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingTrims, setLoadingTrims] = useState(false);
  const [staleWarning, setStaleWarning] = useState(false);
  const [msrpMissing, setMsrpMissing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const yearId = useId();
  const makeId = useId();
  const modelId = useId();
  const trimId = useId();
  const msrpId = useId();

  // Fetch makes when year changes
  useEffect(() => {
    if (!value.year) { setMakes([]); return; }
    setLoadingMakes(true);
    setFetchError(null);
    setMakes([]);
    setModels([]);
    setTrims([]);
    onChange({ ...value, make: null, model: null, trim: null, msrp: null });

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
    setTrims([]);
    onChange({ ...value, model: null, trim: null, msrp: null });

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

  // Fetch trims when model changes
  useEffect(() => {
    if (!value.year || !value.make || !value.model) { setTrims([]); return; }
    setLoadingTrims(true);
    setFetchError(null);
    setTrims([]);
    onChange({ ...value, trim: null, msrp: null });

    fetchVehicles({ year: value.year, make: value.make, model: value.model })
      .then(({ vehicles, cacheZone }) => {
        setTrims(vehicles);
        if (vehicles.length === 0) setFetchError("No trims found for this model.");
        if (cacheZone === "stale") setStaleWarning(true);
      })
      .catch(() => setFetchError("Could not load vehicle trims. Check that the backend is running, then try again."))
      .finally(() => setLoadingTrims(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.model]);

  function handleTrimChange(trimName: string) {
    const found = trims.find(t => t.trim === trimName || t.model === trimName);
    const msrp = found?.msrp ?? null;
    setMsrpMissing(!msrp && !!found);
    onChange({ ...value, trim: trimName, msrp, manualMsrp: null });
  }

  const selectStyle = (disabled: boolean): React.CSSProperties =>
    disabled ? disabledInput : {
      ...inputBase,
      borderColor: "rgba(255,255,255,0.12)",
    };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        select option { background: #0e1117; color: #e8eaf0; }
        select:focus { border-color: #4f9cf9 !important; outline: none; }
        input:focus { border-color: #4f9cf9 !important; outline: none; }
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
          <select
            id={yearId}
            value={value.year ?? ""}
            onChange={e => onChange({ ...value, year: Number(e.target.value) || null, make: null, model: null, trim: null, msrp: null })}
            style={selectStyle(false)}
            aria-required="true"
          >
            <option value="">Select year…</option>
            {YEAR_OPTIONS.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#555977", fontSize: 12 }}>▼</span>
        </div>
      </div>

      {/* Make */}
      <div>
        <label htmlFor={makeId} style={labelStyle}>
          Make {loadingMakes && <LoadingDot />}
        </label>
        <div style={{ position: "relative" }}>
          <select
            id={makeId}
            value={value.make ?? ""}
            onChange={e => onChange({ ...value, make: e.target.value || null, model: null, trim: null, msrp: null })}
            disabled={!value.year || loadingMakes}
            style={selectStyle(!value.year || loadingMakes)}
            aria-required="true"
            aria-disabled={!value.year || loadingMakes}
          >
            <option value="">{loadingMakes ? "Loading makes…" : "Select make…"}</option>
            {makes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#555977", fontSize: 12 }}>▼</span>
        </div>
      </div>

      {/* Model */}
      <div>
        <label htmlFor={modelId} style={labelStyle}>
          Model {loadingModels && <LoadingDot />}
        </label>
        <div style={{ position: "relative" }}>
          <select
            id={modelId}
            value={value.model ?? ""}
            onChange={e => onChange({ ...value, model: e.target.value || null, trim: null, msrp: null })}
            disabled={!value.make || loadingModels}
            style={selectStyle(!value.make || loadingModels)}
            aria-required="true"
            aria-disabled={!value.make || loadingModels}
          >
            <option value="">{loadingModels ? "Loading models…" : "Select model…"}</option>
            {models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#555977", fontSize: 12 }}>▼</span>
        </div>
      </div>

      {/* Trim */}
      <div>
        <label htmlFor={trimId} style={labelStyle}>
          Trim {loadingTrims && <LoadingDot />}
        </label>
        <div style={{ position: "relative" }}>
          <select
            id={trimId}
            value={value.trim ?? ""}
            onChange={e => handleTrimChange(e.target.value)}
            disabled={!value.model || loadingTrims}
            style={selectStyle(!value.model || loadingTrims)}
            aria-disabled={!value.model || loadingTrims}
          >
            <option value="">{loadingTrims ? "Loading trims…" : "Select trim…"}</option>
            {trims.map((t, i) => {
              const label = t.trim ?? t.model;
              return <option key={`${label}-${i}`} value={t.trim ?? t.model}>{label}{t.msrp ? ` — $${t.msrp.toLocaleString()}` : " — MSRP N/A"}</option>;
            })}
          </select>
          <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#555977", fontSize: 12 }}>▼</span>
        </div>
      </div>

      {/* Manual MSRP fallback */}
      {msrpMissing && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            background: "rgba(251,191,36,0.06)",
            border: "1px solid rgba(251,191,36,0.2)",
            borderRadius: 10,
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <p style={{ fontSize: "0.8125rem", color: "#fbbf24", margin: 0 }}>
            ⚠️ MSRP unavailable for this trim. Enter it manually to get payment estimates.
          </p>
          <div>
            <label htmlFor={msrpId} style={{ ...labelStyle, color: "#fbbf24" }}>MSRP (USD)</label>
            <input
              id={msrpId}
              type="number"
              min={1}
              max={500000}
              placeholder="e.g. 32000"
              value={value.manualMsrp ?? ""}
              onChange={e => onChange({ ...value, manualMsrp: Number(e.target.value) || null })}
              style={{ ...inputBase, borderColor: "rgba(251,191,36,0.3)" }}
              aria-required="true"
            />
          </div>
        </div>
      )}

      {fetchError && (
        <p role="alert" aria-live="polite" style={{ fontSize: "0.8125rem", color: "#f87171", background: "rgba(248,113,113,0.08)", borderRadius: "8px", padding: "0.625rem 0.875rem", margin: 0 }}>
          {fetchError}
        </p>
      )}

      {error && (
        <p role="alert" aria-live="polite" style={{ fontSize: "0.8125rem", color: "#f87171", margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}
