"use client";

// ─────────────────────────────────────────────────────────────────────────────
// components/ErrorDisplay.tsx
// HTTP status code → user-facing error state mapping.
// Covers 400, 401, 422, 500, 503 per requirements2.0.md §NFR2.
// Used inline (not as a React ErrorBoundary) so it works in client components.
// ─────────────────────────────────────────────────────────────────────────────

import type { ApiError } from "@/types";

// ─── Status Profiles ──────────────────────────────────────────────────────────

interface ErrorProfile {
  icon: string;
  title: string;
  body: string;
  action: "retry" | "reload" | "manual_input" | "none";
  actionLabel?: string;
  severity: "warning" | "error" | "info";
}

function getErrorProfile(error: ApiError): ErrorProfile {
  // Map by error_code first (more specific), then fall back to HTTP status patterns
  switch (error.error) {
    case "validation_error":
      return {
        icon: "⚠",
        title: "Invalid request",
        body: "Please check your inputs and try again. All fields must be filled in correctly.",
        action: "none",
        severity: "warning",
      };

    case "jwt_invalid":
      return {
        icon: "🔒",
        title: "Session expired",
        body: "Your session has expired. Please start over — your privacy is protected.",
        action: "reload",
        actionLabel: "Start Over",
        severity: "info",
      };

    case "dcs_calculation_error":
      return {
        icon: "⚡",
        title: "Calculation error",
        body: "We couldn't calculate payments for this vehicle. Please check your inputs — the MSRP or term may be outside our supported range.",
        action: "none",
        severity: "error",
      };

    case "vehicle_data_unavailable":
    case "carquery_error":
    case "carquery_timeout":
      return {
        icon: "🔌",
        title: "Vehicle data unavailable",
        body: "Our vehicle data provider is temporarily unreachable. You may enter vehicle details manually to continue.",
        action: "retry",
        actionLabel: "Try Again",
        severity: "warning",
      };

    case "vehicle_not_found":
      return {
        icon: "🔍",
        title: "Vehicle not found",
        body: "We couldn't find that vehicle in our database. Try entering the MSRP manually or selecting a different trim.",
        action: "none",
        severity: "warning",
      };

    case "internal_error":
    default:
      return {
        icon: "🔧",
        title: "Something went wrong",
        body: "An unexpected error occurred on our end. Please try again in a moment.",
        action: "retry",
        actionLabel: "Try Again",
        severity: "error",
      };
  }
}

const severityColors = {
  warning: {
    bg: "rgba(251,191,36,0.06)",
    border: "rgba(251,191,36,0.2)",
    icon: "#fbbf24",
    title: "#fbbf24",
    body: "#c4c8dc",
    btn: { bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.3)", text: "#fbbf24" },
  },
  error: {
    bg: "rgba(248,113,113,0.06)",
    border: "rgba(248,113,113,0.2)",
    icon: "#f87171",
    title: "#f87171",
    body: "#c4c8dc",
    btn: { bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)", text: "#f87171" },
  },
  info: {
    bg: "rgba(79,156,249,0.06)",
    border: "rgba(79,156,249,0.2)",
    icon: "#4f9cf9",
    title: "#4f9cf9",
    body: "#c4c8dc",
    btn: { bg: "rgba(79,156,249,0.1)", border: "rgba(79,156,249,0.25)", text: "#4f9cf9" },
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface ErrorDisplayProps {
  error: ApiError;
  onRetry?: () => void;
  onReload?: () => void;
  /** Additional context from the page (e.g. "manual MSRP input" trigger) */
  onManualInput?: () => void;
}

export default function ErrorDisplay({
  error,
  onRetry,
  onReload,
  onManualInput,
}: ErrorDisplayProps) {
  const profile = getErrorProfile(error);
  const colors = severityColors[profile.severity];

  function handleAction() {
    if (profile.action === "retry" && onRetry) onRetry();
    if (profile.action === "reload") {
      if (onReload) onReload();
      else window.location.reload();
    }
    if (profile.action === "manual_input" && onManualInput) onManualInput();
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "1.5rem", display: "flex", gap: "1rem", alignItems: "flex-start" }}>
        {/* Icon */}
        <div
          aria-hidden="true"
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: `${colors.bg}`,
            border: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.125rem",
            flexShrink: 0,
          }}
        >
          {profile.icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 0.375rem", fontSize: "0.9375rem", fontWeight: 700, color: colors.title, lineHeight: 1.3 }}>
            {profile.title}
          </p>
          <p style={{ margin: 0, fontSize: "0.875rem", color: colors.body, lineHeight: 1.6 }}>
            {profile.body}
          </p>

          {/* Retry-after hint */}
          {error.retry_after_seconds && (
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "#555977" }}>
              Retry available in {error.retry_after_seconds} seconds.
            </p>
          )}
        </div>
      </div>

      {/* Action button */}
      {profile.action !== "none" && profile.actionLabel && (
        <div style={{
          borderTop: `1px solid ${colors.border}`,
          padding: "0.875rem 1.5rem",
          display: "flex",
          justifyContent: "flex-end",
        }}>
          <button
            onClick={handleAction}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: 8,
              border: `1px solid ${colors.btn.border}`,
              background: colors.btn.bg,
              color: colors.btn.text,
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            {profile.actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Inline field-level error ─────────────────────────────────────────────────

interface FieldErrorProps {
  message: string;
  id?: string;
}

export function FieldError({ message, id }: FieldErrorProps) {
  return (
    <p
      id={id}
      role="alert"
      aria-live="polite"
      style={{
        margin: "0.375rem 0 0",
        fontSize: "0.8125rem",
        color: "#f87171",
        display: "flex",
        alignItems: "center",
        gap: "0.375rem",
        lineHeight: 1.4,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: "0.75rem" }}>⚠</span>
      {message}
    </p>
  );
}
