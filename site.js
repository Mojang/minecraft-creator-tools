window.creatorToolsSite = {
  // Real MCTools app version, stamped at release time by gulp updateVersions
  // (see app/gulpfile.js). Keep this placeholder in sync with the pattern in
  // src/core/Constants.ts so the same stamping regex updates both. Used to tag
  // auto-captured 1DS telemetry (which bypasses the TypeScript TelemetryService)
  // with a queryable app version.
  version: "0.20.0",
  termsOfUseUrl: "https://minecraft.net/eula",
  privacyUrl: "https://go.microsoft.com/fwlink/?linkid=521839",
  trademarksUrl: "https://www.microsoft.com/trademarks",
};

var siteConsent = null;

window.getUserConsentDetails = function () {
  if (siteConsent) {
    return siteConsent.getConsent();
  }

  return {
    Required: true,
    Analytics: true,
    SocialMedia: false,
    Advertising: false,
  };
};

if (WcpConsent) {
  WcpConsent.init("en-US", "cookie-banner", function (err, _siteConsent) {
    if (err != undefined) {
      return err;
    } else {
      siteConsent = _siteConsent;

      if (oneDS && oneDS.ApplicationInsights && !navigator.globalPrivacyControl) {
        const analytics = new oneDS.ApplicationInsights();

        // Stamp every telemetry envelope — including auto-captured web analytics
        // rows (ms_web_pageview, ms_web_clienterror, ms_web_pageaction, etc.) that
        // never pass through the TypeScript TelemetryService — with the real MCTools
        // app version. The value lands in the envelope's custom properties (part C /
        // "data"), matching where TelemetryService puts mctoolsVersion for custom
        // events, so both are queryable the same way.
        //
        // Fill-only: custom TelemetryService envelopes already carry mctoolsVersion
        // from the content-hashed application bundle, which is authoritative. site.js
        // is served unhashed and can be cached across releases, so never overwrite a
        // version that is already present — only fill it in for auto-captured rows.
        //
        // IMPORTANT: register this BEFORE initialize(). With pageView auto-capture
        // enabled, the 1DS Web Analytics plugin captures the initial Ms.Web.PageView
        // and flushes its initialization queue synchronously during initialize(); an
        // initializer added afterward would miss that first envelope, leaving
        // page-view/session version analytics incomplete. The SDK stores initializers
        // registered pre-initialization and applies them to that first envelope.
        var registerVersionInitializer = function () {
          if (typeof analytics.addTelemetryInitializer !== "function") {
            return false;
          }

          analytics.addTelemetryInitializer(function (envelope) {
            try {
              var mctoolsVersion = window.creatorToolsSite && window.creatorToolsSite.version;

              if (mctoolsVersion) {
                envelope.data = envelope.data || {};

                if (!envelope.data.mctoolsVersion) {
                  envelope.data.mctoolsVersion = mctoolsVersion;
                }
              }
            } catch (e) {
              // Never let telemetry tagging break the app or drop the event.
            }

            return true;
          });

          return true;
        };

        var versionInitializerRegistered = registerVersionInitializer();

        analytics.initialize(
          {
            instrumentationKey: "1e1425454dbc4c25b1be2762598df0b6-7f4669a7-d9f8-4e51-9bba-266dcfc0dc00-7638",
            disableCookiesUsage:
              !siteConsent ||
              !siteConsent.getConsent ||
              (siteConsent.isConsentRequired && !siteConsent.getConsent().Analytics),
            propertyConfiguration: {
              gpcDataSharingOptIn: false,
              callback: {
                userConsentDetails: window.getUserConsentDetails,
              },
            },
            webAnalyticsConfiguration: {
              autoCapture: {
                scroll: true,
                pageView: true,
                onLoad: true,
                onUnload: true,
                click: true,
                scroll: true,
                resize: true,
                jsError: true,
              },
            },
          },
          []
        );

        // Fallback for SDK builds that only expose addTelemetryInitializer AFTER
        // initialize(): still tag subsequent envelopes rather than none. (The very
        // first page view is only guaranteed to be tagged via the pre-initialize
        // registration above.)
        if (!versionInitializerRegistered) {
          registerVersionInitializer();
        }

        // Expose the 1DS instance globally for the Telemetry service
        window.oneDSInstance = analytics;
      }
    }
  });
}

window.manageConsent = function () {
  if (siteConsent && siteConsent.isConsentRequired) {
    siteConsent.manageConsent();
  }
};
