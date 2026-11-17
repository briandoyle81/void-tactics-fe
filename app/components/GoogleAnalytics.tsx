import Script from "next/script";

/**
 * Google's tag, on every page (website and game client), from one of:
 *  - NEXT_PUBLIC_GTM_ID (GTM-XXXXXXX): a Google Tag Manager container, the
 *    snippet Google's "Install manually" step gives. GA4 and any other tags
 *    are then set up inside Tag Manager.
 *  - NEXT_PUBLIC_GA_MEASUREMENT_ID (G-XXXXXXXXXX): GA4 directly (gtag.js).
 * Use one, not both: each would count every page view. Renders nothing when
 * neither is set (local dev, previews).
 *
 * GA4's enhanced measurement records the App Router's client-side
 * navigations as page views ("page changes based on browser history
 * events", on by default), so no route listener is needed. Product
 * analytics stay in PostHog; this is for traffic and search.
 */
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID?.trim();
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

export function GoogleAnalytics() {
  if (GTM_ID && /^GTM-[A-Z0-9]+$/.test(GTM_ID)) {
    return (
      <>
        <Script src={`https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`} strategy="afterInteractive" />
        <Script id="gtm-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());`}
        </Script>
      </>
    );
  }
  if (GA_MEASUREMENT_ID && /^G-[A-Z0-9]+$/.test(GA_MEASUREMENT_ID)) {
    return (
      <>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`}
        </Script>
      </>
    );
  }
  return null;
}
