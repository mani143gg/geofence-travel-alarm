import type { VercelRequest, VercelResponse } from "@vercel/node";

const cache = new Map();

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {

  try {

    const { q, lat, lon } = req.query;

    if (!q) {
      return res.status(400).json({
        error: "Query required"
      });
    }

    let url =
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        String(q)
      )}&limit=6`;

    if (lat && lon) {
      url += `&lat=${lat}&lon=${lon}`;
    }

    const cached = cache.get(url);

    if (cached) {
      return res.json(cached);
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "GeoFenceTravelAlarm/1.0",
        "Accept-Language": "en"
      }
    });

    const data = await response.json();

    cache.set(url, data);

    return res.json(data);

  } catch (e: any) {

    return res.status(500).json({
      error: e.message
    });

  }

}
