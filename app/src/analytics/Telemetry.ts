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
import { TelemetryProperties, TelemetryMeasurements } from "./TelemetryConstants";
import { constants } from "../core/Constants";

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
  private _activeProjectCount: number = 0;
  private _mctoolsVersion: string = "0.0.1";
  private window: typeof globalThis = globalThis;

  constructor() {
    this._checkInitialization();
    this._loadVersion();
  }

  /**
   * Load the version from constants
   */
  private _loadVersion(): void {
    this._mctoolsVersion = constants.version;
  }

  /**
   * Set the active project count
   */
  public setActiveProjectCount(count: number): void {
    this._activeProjectCount = count;
  }

  /**
   * Get common properties and measurements to include with every event
   */
  private _getCommonPropertiesAndMeasurements(): {
    properties: Partial<Record<TelemetryPropertyKey, any>>;
    measurements: Partial<Record<TelemetryMeasurementKey, number>>;
  } {
    const properties: Partial<Record<TelemetryPropertyKey, any>> = {};
    const measurements: Partial<Record<TelemetryMeasurementKey, number>> = {};

    if (this._mctoolsVersion) {
      properties[TelemetryProperties.MCTOOLS_VERSION] = this._mctoolsVersion;
    }

    if (this._activeProjectCount > 0) {
      measurements[TelemetryMeasurements.ACTIVE_PROJECT_COUNT] = this._activeProjectCount;
    }

    return { properties, measurements };
  }

  /**
   * Check if 1DS is initialized and available on the window object
   */
  private _checkInitialization(): void {
    if (typeof this.window !== "undefined" && (this.window as any).oneDSInstance) {
      this._oneDSInstance = (this.window as any).oneDSInstance;
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

    if (!this._isInitialized && typeof this.window !== "undefined" && (this.window as any).oneDSInstance) {
      this._oneDSInstance = (this.window as any).oneDSInstance;
      this._isInitialized = true;
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
      return;
    }

    try {
      const commonData = this._getCommonPropertiesAndMeasurements();

      const eventData: any = {
        name: event.name,
      };

      const mergedProperties = {
        ...commonData.properties,
        ...(event.properties || {}),
      };

      if (Object.keys(mergedProperties).length > 0) {
        eventData.data = mergedProperties;
      }

      const mergedMeasurements = {
        ...commonData.measurements,
        ...(event.measurements || {}),
      };

      if (Object.keys(mergedMeasurements).length > 0) {
        eventData.measurements = mergedMeasurements;
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
      return;
    }

    try {
      const commonData = this._getCommonPropertiesAndMeasurements();

      const pageViewData: any = {
        name: pageView.name,
        uri:
          pageView.uri ||
          (typeof this.window !== "undefined" && (this.window as any).location
            ? (this.window as any).location.href
            : ""),
      };

      const mergedProperties = {
        ...commonData.properties,
        ...(pageView.properties || {}),
      };

      if (Object.keys(mergedProperties).length > 0) {
        pageViewData.data = mergedProperties;
      }

      const mergedMeasurements = {
        ...commonData.measurements,
        ...(pageView.measurements || {}),
      };

      if (Object.keys(mergedMeasurements).length > 0) {
        pageViewData.measurements = mergedMeasurements;
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
      return;
    }

    try {
      const commonData = this._getCommonPropertiesAndMeasurements();

      const exceptionData: any = {
        exception: exception.exception,
        severityLevel: exception.severityLevel || 3,
      };

      const mergedProperties = {
        ...commonData.properties,
        ...(exception.properties || {}),
      };

      if (Object.keys(mergedProperties).length > 0) {
        exceptionData.data = mergedProperties;
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
      return;
    }

    try {
      const commonData = this._getCommonPropertiesAndMeasurements();

      const metricData: any = {
        name,
        average: value,
      };

      const mergedProperties = {
        ...commonData.properties,
        ...(properties || {}),
      };

      if (Object.keys(mergedProperties).length > 0) {
        metricData.data = mergedProperties;
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
      return;
    }

    try {
      const commonData = this._getCommonPropertiesAndMeasurements();

      const traceData: any = {
        message,
        severityLevel: severityLevel || 1,
      };

      const mergedProperties = {
        ...commonData.properties,
        ...(properties || {}),
      };

      if (Object.keys(mergedProperties).length > 0) {
        traceData.data = mergedProperties;
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
