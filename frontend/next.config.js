/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Proxy all /api/* requests to the FastAPI backend.
   * This keeps the browser on the same origin, which is required for
   * the HttpOnly + SameSite=Strict JWT cookie to be sent automatically.
   */
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL;

    if (!backendUrl) {
      // In development without a backend URL, let Next.js handle /api routes
      // (useful if you run a local mock). In production this must be set.
      console.warn(
        "[next.config.js] BACKEND_URL is not set. " +
          "/api/* requests will not be proxied to FastAPI."
      );
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },

  /**
   * Strict mode surfaces double-render issues in development —
   * leave enabled so we catch them early.
   */
  reactStrictMode: true,
};

module.exports = nextConfig;
