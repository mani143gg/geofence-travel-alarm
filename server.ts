import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for JSON
  app.use(express.json());

  // Memory caching for Nominatim to prevent rate-limiting and hanging queries
  const nominatimCache = new Map<string, { data: any; expiry: number }>();
  const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes memory TTL

  // Helper function to fetch with a timeout
  async function fetchWithTimeout(url: string, headers: any, timeoutMs = 1800) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  }

  // Nominatim Search Proxy (Bypasses CORS & forces correct User-Agent)
  app.get("/api/search", async (req, res) => {
    try {
      const { q, lat, lon } = req.query;
      if (!q || typeof q !== "string") {
        return res.status(400).json({ error: "Search query 'q' is required" });
      }

      console.log(`[Proxy Search] Querying Nominatim for: "${q}" with bias [${lat}, ${lon}]`);
      let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=6`;
      
      if (lat && lon) {
        url += `&lat=${lat}&lon=${lon}`;
      }

      // Check Cache
      const cached = nominatimCache.get(url);
      if (cached && cached.expiry > Date.now()) {
        console.log(`[Cache Hit] Returning cached search for: ${url}`);
        return res.json(cached.data);
      }

      const response = await fetchWithTimeout(url, {
        "User-Agent": "GeoFenceTravelAlarm/1.0 (commuter-applet; mani@airtory.com)",
        "Accept-Language": "en"
      }, 1800);

      if (!response.ok) {
        throw new Error(`Nominatim returned status: ${response.status}`);
      }

      const data = await response.json();
      
      // Store in Cache
      nominatimCache.set(url, {
        data,
        expiry: Date.now() + CACHE_TTL_MS
      });

      return res.json(data);
    } catch (error: any) {
      console.error("[Proxy Search Error]", error);
      // Return empty array instead of 500 so frontend handles it gracefully without breaking the flow
      return res.json([]);
    }
  });

  // Nominatim Reverse Geocode Proxy
  app.get("/api/reverse", async (req, res) => {
    try {
      const { lat, lon } = req.query;
      if (!lat || !lon) {
        return res.status(400).json({ error: "Both 'lat' and 'lon' query params are required" });
      }

      console.log(`[Proxy Reverse] Querying Nominatim for coordinates: [${lat}, ${lon}]`);
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;

      // Check Cache
      const cached = nominatimCache.get(url);
      if (cached && cached.expiry > Date.now()) {
        console.log(`[Cache Hit] Returning cached reverse geocode for: ${url}`);
        return res.json(cached.data);
      }

      const response = await fetchWithTimeout(url, {
        "User-Agent": "GeoFenceTravelAlarm/1.0 (commuter-applet; mani@airtory.com)",
        "Accept-Language": "en"
      }, 1500);

      if (!response.ok) {
        throw new Error(`Nominatim returned status: ${response.status}`);
      }

      const data = await response.json();

      // Store in Cache
      nominatimCache.set(url, {
        data,
        expiry: Date.now() + CACHE_TTL_MS
      });

      return res.json(data);
    } catch (error: any) {
      console.error("[Proxy Reverse Error]", error);
      return res.status(500).json({ error: error.message || "Failed to reverse geocode" });
    }
  });

  // Setup Vite/Static Middlewares
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode serving static assets...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] GeoFence Alarm backend listening at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start fullstack server", err);
});
