// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { useCallback } from "react";
import telemetryService, { TelemetryEvent, TelemetryException, TelemetryPageView } from "./Telemetry";
import type { TelemetryMeasurementKey, TelemetryPropertyKey, TelemetrySeverityLevel } from "./TelemetryConstants";

/**
 * React hook for using telemetry in functional components.
 *
 * All methods enforce the use of predefined constants from TelemetryConstants
 * to ensure standardized, queryable telemetry data.
 */
export function useTelemetry() {
  const trackEvent = useCallback((event: TelemetryEvent) => {
    telemetryService.trackEvent(event);
  }, []);

  const trackPageView = useCallback((pageView: TelemetryPageView) => {
    telemetryService.trackPageView(pageView);
  }, []);

  const trackException = useCallback((exception: TelemetryException) => {
    telemetryService.trackException(exception);
  }, []);

  const trackMetric = useCallback(
    (name: TelemetryMeasurementKey, value: number, properties?: Partial<Record<TelemetryPropertyKey, any>>) => {
      telemetryService.trackMetric(name, value, properties);
    },
    []
  );

  const trackTrace = useCallback(
    (
      message: string,
      severityLevel?: TelemetrySeverityLevel,
      properties?: Partial<Record<TelemetryPropertyKey, any>>
    ) => {
      telemetryService.trackTrace(message, severityLevel, properties);
    },
    []
  );

  const isEnabled = useCallback(() => {
    return telemetryService.isEnabled();
  }, []);

  const flush = useCallback(() => {
    telemetryService.flush();
  }, []);

  const setAuthenticatedUserContext = useCallback((authenticatedUserId: string, accountId?: string) => {
    telemetryService.setAuthenticatedUserContext(authenticatedUserId, accountId);
  }, []);

  const clearAuthenticatedUserContext = useCallback(() => {
    telemetryService.clearAuthenticatedUserContext();
  }, []);

  return {
    trackEvent,
    trackPageView,
    trackException,
    trackMetric,
    trackTrace,
    isEnabled,
    flush,
    setAuthenticatedUserContext,
    clearAuthenticatedUserContext,
  };
}

export default useTelemetry;
