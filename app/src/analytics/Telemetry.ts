// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Telemetry service that wraps 1DS ApplicationInsights instance
 */

import type { OneDSApplicationInsights } from "../types/oneds";
import type {
  TelemetryEventName,
  TelemetryPropertyKey,
  TelemetryMeasurementKey,
  TelemetrySeverityLevel,
} from "./TelemetryConstants";

/**
 * Telemetry event with strict type checking
 * Only accepts predefined event names, property keys, and measurement keys
 */
export interface TelemetryEvent {
  name: TelemetryEventName;
  properties?: Partial<Record<TelemetryPropertyKey, any>>;
  measurements?: Partial<Record<TelemetryMeasurementKey, number>>;
}

export interface TelemetryException {
  exception: Error;
  properties?: Partial<Record<TelemetryPropertyKey, any>>;
  severityLevel?: TelemetrySeverityLevel;
}

export interface TelemetryPageView {
  name: string;
  uri?: string;
  properties?: Partial<Record<TelemetryPropertyKey, any>>;
  measurements?: Partial<Record<TelemetryMeasurementKey, number>>;
}

class TelemetryService {
  private _isInitialized: boolean = false;
  private _oneDSInstance: OneDSApplicationInsights | null = null;

  constructor() {
    this._checkInitialization();
  }

  /**
   * Check if 1DS is initialized and available on the window object
   */
  private _checkInitialization(): void {
    if (typeof window !== "undefined" && window.oneDSInstance) {
      this._oneDSInstance = window.oneDSInstance;
      this._isInitialized = true;
    }
  }

  /**
   * Get the 1DS instance, checking initialization if not already done
   */
  private _getInstance(): OneDSApplicationInsights | null {
    if (!this._isInitialized) {
      this._checkInitialization();
    }
    return this._oneDSInstance;
  }

  /**
   * Check if telemetry is enabled and available
   */
  public isEnabled(): boolean {
    return this._getInstance() !== null;
  }

  /**
   * Track a custom event
   * Only accepts predefined event names, property keys, and measurement keys from TelemetryConstants
   * @param event Event with strictly typed properties and measurements
   */
  public trackEvent(event: TelemetryEvent): void {
    const instance = this._getInstance();
    if (!instance) {
      // console.debug("1DS not available, skipping event:", event.name);
      return;
    }

    try {
      const eventData: any = {
        name: event.name,
      };

      if (event.properties && Object.keys(event.properties).length > 0) {
        eventData.data = event.properties;
      }

      if (event.measurements && Object.keys(event.measurements).length > 0) {
        eventData.measurements = event.measurements;
      }

      instance.trackEvent(eventData);
    } catch (error) {
      console.error("Error tracking event:", error);
    }
  }

  /**
   * Track a page view
   * @param pageView Page view name and optional properties
   */
  public trackPageView(pageView: TelemetryPageView): void {
    const instance = this._getInstance();
    if (!instance) {
      // console.debug("1DS not available, skipping page view:", pageView.name);
      return;
    }

    try {
      const pageViewData: any = {
        name: pageView.name,
        uri: pageView.uri || window.location.href,
      };

      // Add properties to data object for proper 1DS formatting
      if (pageView.properties && Object.keys(pageView.properties).length > 0) {
        pageViewData.data = pageView.properties;
      }

      // Add measurements if provided
      if (pageView.measurements && Object.keys(pageView.measurements).length > 0) {
        pageViewData.measurements = pageView.measurements;
      }

      instance.trackPageView(pageViewData);
    } catch (error) {
      console.error("Error tracking page view:", error);
    }
  }

  /**
   * Track an exception
   * @param exception Exception details
   */
  public trackException(exception: TelemetryException): void {
    const instance = this._getInstance();
    if (!instance) {
      // console.debug("1DS not available, skipping exception:", exception.exception);
      return;
    }

    try {
      const exceptionData: any = {
        exception: exception.exception,
        severityLevel: exception.severityLevel || 3, // Error level
      };

      if (exception.properties && Object.keys(exception.properties).length > 0) {
        exceptionData.data = exception.properties;
      }

      instance.trackException(exceptionData);
    } catch (error) {
      console.error("Error tracking exception:", error);
    }
  }

  /**
   * Track a metric/measurement
   * @param name Metric name from TelemetryMeasurements
   * @param value Metric value
   * @param properties Optional properties
   */
  public trackMetric(
    name: TelemetryMeasurementKey,
    value: number,
    properties?: Partial<Record<TelemetryPropertyKey, any>>
  ): void {
    const instance = this._getInstance();
    if (!instance) {
      // console.debug("1DS not available, skipping metric:", name);
      return;
    }

    try {
      const metricData: any = {
        name,
        average: value,
      };

      if (properties && Object.keys(properties).length > 0) {
        metricData.data = properties;
      }

      instance.trackMetric(metricData);
    } catch (error) {
      console.error("Error tracking metric:", error);
    }
  }

  /**
   * Track a trace/log message
   * @param message Log message
   * @param severityLevel Severity level
   * @param properties Optional properties
   */
  public trackTrace(
    message: string,
    severityLevel?: TelemetrySeverityLevel,
    properties?: Partial<Record<TelemetryPropertyKey, any>>
  ): void {
    const instance = this._getInstance();
    if (!instance) {
      // console.debug("1DS not available, skipping trace:", message);
      return;
    }

    try {
      const traceData: any = {
        message,
        severityLevel: severityLevel || 1,
      };

      if (properties && Object.keys(properties).length > 0) {
        traceData.data = properties;
      }

      instance.trackTrace(traceData);
    } catch (error) {
      console.error("Error tracking trace:", error);
    }
  }

  /**
   * Flush any pending telemetry data
   */
  public flush(): void {
    const instance = this._getInstance();
    if (!instance) {
      return;
    }

    try {
      if (instance.flush) {
        instance.flush();
      }
    } catch (error) {
      console.error("Error flushing telemetry:", error);
    }
  }

  /**
   * Set authenticated user context
   * @param authenticatedUserId User ID
   * @param accountId Optional account ID
   */
  public setAuthenticatedUserContext(authenticatedUserId: string, accountId?: string): void {
    const instance = this._getInstance();
    if (!instance) {
      return;
    }

    try {
      if (instance.setAuthenticatedUserContext) {
        instance.setAuthenticatedUserContext(authenticatedUserId, accountId);
      }
    } catch (error) {
      console.error("Error setting authenticated user context:", error);
    }
  }

  /**
   * Clear authenticated user context
   */
  public clearAuthenticatedUserContext(): void {
    const instance = this._getInstance();
    if (!instance) {
      return;
    }

    try {
      if (instance.clearAuthenticatedUserContext) {
        instance.clearAuthenticatedUserContext();
      }
    } catch (error) {
      console.error("Error clearing authenticated user context:", error);
    }
  }
}

// Export singleton instance as default
export default new TelemetryService();
