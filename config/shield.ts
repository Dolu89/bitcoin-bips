import env from '#start/env'
import { defineConfig } from '@adonisjs/shield'

/**
 * The Umami analytics origin, derived from the configured script URL, so the CSP can
 * allow both the tracker `<script>` and its `/api/send` beacon. Null in development or
 * when `UMAMI_SCRIPT_URL` is unset (analytics is production-only anyway).
 */
const umamiOrigin = (() => {
  const url = env.get('UMAMI_SCRIPT_URL')
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
})()

/**
 * Security configuration using Shield.
 * Provides protection against common web vulnerabilities like CSRF,
 * XSS, clickjacking, and other security threats.
 */
const shieldConfig = defineConfig({
  /**
   * Content Security Policy (enforced). Was validated in report-only first, then switched
   * to enforce. Adding a new third-party script/style/font/endpoint means updating the
   * matching directive below, or the browser will block it. Set `reportOnly: true` to
   * debug a new resource without blocking.
   */
  csp: {
    enabled: true,

    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],

      /**
       * `'unsafe-eval'` is required by Alpine's default build, which compiles `x-*`
       * expressions through the Function constructor. `@nonce` whitelists the inline
       * pre-paint theme script in the layout. The Umami origin serves the tracker script.
       */
      scriptSrc: ["'self'", "'unsafe-eval'", '@nonce', ...(umamiOrigin ? [umamiOrigin] : [])],

      /**
       * `'unsafe-inline'` covers the per-project `style="--brand:…"` attribute and the
       * webfont stylesheet `@import`; the fonts host serves that stylesheet.
       */
      styleSrc: ["'self'", "'unsafe-inline'", 'https://api.fonts.coollabs.io'],
      fontSrc: ["'self'", 'https://api.fonts.coollabs.io', 'https://cdn.fonts.coollabs.io'],

      /** Specs embed remote `<img>` (e.g. mediawiki); keep image sources permissive. */
      imgSrc: ["'self'", 'data:', 'https:'],

      /**
       * `'self'` = search/history fragment fetches; `npub.cash` = the Lightning donate
       * flow (LNURL-pay); the Umami origin receives the analytics beacon.
       */
      connectSrc: ["'self'", 'https://npub.cash', ...(umamiOrigin ? [umamiOrigin] : [])],
    },

    reportOnly: false,
  },

  /**
   * Configure CSRF protection options. Refer documentation
   * to learn more
   */
  csrf: {
    /**
     * Enable CSRF protection.
     * Protects against Cross-Site Request Forgery attacks.
     */
    enabled: true,

    /**
     * Routes that should be excluded from CSRF protection.
     * Useful for webhooks or API endpoints that use other auth methods.
     */
    exceptRoutes: [],

    /**
     * Enable XSRF-TOKEN cookie for JavaScript frameworks.
     * When enabled, the CSRF token is available to client-side code.
     */
    enableXsrfCookie: false,

    /**
     * HTTP methods that require CSRF token validation.
     * GET, HEAD, and OPTIONS are safe methods and don't need protection.
     */
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  },

  /**
   * Control how your website should be embedded inside
   * iFrames
   */
  xFrame: {
    /**
     * Enable X-Frame-Options header.
     * Helps prevent clickjacking attacks.
     */
    enabled: true,

    /**
     * Frame embedding policy.
     * It can block all framing with 'DENY' or allow same-origin framing
     * with 'SAMEORIGIN'.
     */
    action: 'DENY',
  },

  /**
   * Force browser to always use HTTPS
   */
  hsts: {
    /**
     * Enable HTTP Strict Transport Security.
     * Tells browsers to always use HTTPS for this site.
     */
    enabled: true,

    /**
     * How long browsers should remember to use HTTPS (one year, the recommended minimum).
     */
    maxAge: '1 year',

    /**
     * Apply the policy to every subdomain too. Safe here: it only covers children of the
     * host serving the header (e.g. `*.bips.xyz`), all of which are HTTPS.
     */
    includeSubDomains: true,
  },

  /**
   * Disable browsers from sniffing the content type of a
   * response and always rely on the "content-type" header.
   */
  contentTypeSniffing: {
    /**
     * Enable X-Content-Type-Options: nosniff header.
     * Prevents MIME type sniffing which can lead to security vulnerabilities.
     */
    enabled: true,
  },
})

export default shieldConfig
