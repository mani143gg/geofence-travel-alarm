var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  const nominatimCache = /* @__PURE__ */ new Map();
  const CACHE_TTL_MS = 30 * 60 * 1e3;
  async function fetchWithTimeout(url, headers, timeoutMs = 1800) {
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
      nominatimCache.set(url, {
        data,
        expiry: Date.now() + CACHE_TTL_MS
      });
      return res.json(data);
    } catch (error) {
      console.error("[Proxy Search Error]", error);
      return res.json([]);
    }
  });
  app.get("/api/reverse", async (req, res) => {
    try {
      const { lat, lon } = req.query;
      if (!lat || !lon) {
        return res.status(400).json({ error: "Both 'lat' and 'lon' query params are required" });
      }
      console.log(`[Proxy Reverse] Querying Nominatim for coordinates: [${lat}, ${lon}]`);
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
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
      nominatimCache.set(url, {
        data,
        expiry: Date.now() + CACHE_TTL_MS
      });
      return res.json(data);
    } catch (error) {
      console.error("[Proxy Reverse Error]", error);
      return res.status(500).json({ error: error.message || "Failed to reverse geocode" });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite middleware...");
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode serving static assets...");
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] GeoFence Alarm backend listening at http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start fullstack server", err);
});
//# sourceMappingURL=server.cjs.map
