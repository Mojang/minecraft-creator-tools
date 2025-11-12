// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Type definitions for 1DS JS SDK (Analytics Web SKU)
 *
 * These types are based on the Application Insights JavaScript SDK API
 * since 1DS JS SDK is built on top of it.
 *
 * Note: Initialization happens in site/index.body.html, so only the runtime
 * instance methods are defined here.
 */

declare global {
  interface Window {
    oneDSInstance?: OneDSApplicationInsights;
  }
}

export interface OneDSApplicationInsights {
  /**
   * Track a custom event
   * @param event Event details
   */
  trackEvent(event: { name: string; data?: Record<string, any>; measurements?: Record<string, number> }): void;

  /**
   * Track a page view
   * @param pageView Page view details
   */
  trackPageView(pageView: {
    name: string;
    uri?: string;
    data?: Record<string, any>;
    measurements?: Record<string, number>;
  }): void;

  /**
   * Track an exception/error
   * @param exception Exception details
   */
  trackException(exception: { exception: Error; data?: Record<string, any>; severityLevel?: number }): void;

  /**
   * Track a metric/measurement
   * @param metric Metric details
   */
  trackMetric(metric: {
    name: string;
    average: number;
    sampleCount?: number;
    min?: number;
    max?: number;
    data?: Record<string, any>;
  }): void;

  /**
   * Track a trace/log message
   * @param trace Trace details
   */
  trackTrace(trace: { message: string; severityLevel?: number; data?: Record<string, any> }): void;

  /**
   * Track a page action (Web Analytics plugin)
   * @param action Action details
   */
  trackPageAction?(action: { name: string; data?: Record<string, any> }): void;

  /**
   * Track content update (Web Analytics plugin)
   * @param update Update details
   */
  trackContentUpdate?(update: { name: string; data?: Record<string, any> }): void;

  /**
   * Set authenticated user context
   * @param authenticatedUserId User identifier
   * @param accountId Optional account identifier
   */
  setAuthenticatedUserContext?(authenticatedUserId: string, accountId?: string): void;

  /**
   * Clear authenticated user context
   */
  clearAuthenticatedUserContext?(): void;

  /**
   * Flush any pending telemetry data
   */
  flush?(): void;

  /**
   * Start tracking a page (for SPA scenarios)
   * @param name Page name
   */
  startTrackPage?(name: string): void;

  /**
   * Stop tracking a page (for SPA scenarios)
   * @param name Page name
   * @param url Optional URL
   * @param data Optional properties
   */
  stopTrackPage?(name: string, url?: string, data?: Record<string, any>): void;

  /**
   * Start tracking an event (for duration tracking)
   * @param name Event name
   */
  startTrackEvent?(name: string): void;

  /**
   * Stop tracking an event (for duration tracking)
   * @param name Event name
   * @param data Optional properties
   * @param measurements Optional measurements
   */
  stopTrackEvent?(name: string, data?: Record<string, any>, measurements?: Record<string, number>): void;
}
