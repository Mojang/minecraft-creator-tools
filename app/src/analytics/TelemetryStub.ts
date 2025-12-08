// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Stub telemetry service for non-vscweb builds
 * All methods are no-ops to ensure telemetry is disabled
 */

import type {
  TelemetryEventName,
  TelemetryPropertyKey,
  TelemetryMeasurementKey,
  TelemetrySeverityLevel,
} from "./TelemetryConstants";

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

class TelemetryStubService {
  public setActiveProjectCount(_count: number): void {}
  public isEnabled(): boolean {
    return false;
  }
  public trackEvent(_event: TelemetryEvent): void {}
  public trackPageView(_pageView: TelemetryPageView): void {}
  public trackException(_exception: TelemetryException): void {}
  public trackMetric(
    _name: TelemetryMeasurementKey,
    _value: number,
    _properties?: Partial<Record<TelemetryPropertyKey, any>>
  ): void {}
  public trackTrace(
    _message: string,
    _severityLevel?: TelemetrySeverityLevel,
    _properties?: Partial<Record<TelemetryPropertyKey, any>>
  ): void {}
  public flush(): void {}
  public setAuthenticatedUserContext(_authenticatedUserId: string, _accountId?: string): void {}
  public clearAuthenticatedUserContext(): void {}
}

export default new TelemetryStubService();
