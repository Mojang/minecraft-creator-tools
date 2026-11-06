// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import axios, { AxiosRequestConfig } from "axios";

/** Whole-request bound for small version/registry metadata, not downloads or validation tasks. */
export const METADATA_REQUEST_TIMEOUT_MS = 10000;

/**
 * The referenced timer keeps one-shot Node callers alive even if a proxy drops its socket
 * without settling axios. Abort cancels the transport; finally releases the timer on every path.
 * Node hosts also pass this controller to their agent to cancel sockets still negotiating CONNECT.
 */
export async function requestMetadata<T>(
  url: string,
  config: AxiosRequestConfig = {},
  controller = new AbortController()
): Promise<T> {
  const timer = setTimeout(
    () => controller.abort(new Error(`Metadata request timed out after ${METADATA_REQUEST_TIMEOUT_MS} ms.`)),
    METADATA_REQUEST_TIMEOUT_MS
  );
  try {
    const response = await axios.get<T>(url, {
      ...config,
      timeout: METADATA_REQUEST_TIMEOUT_MS,
      signal: controller.signal,
    });
    return response.data;
  } catch (error) {
    if (controller.signal.aborted) {
      throw controller.signal.reason;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
