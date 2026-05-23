export default async function handler(req: any, res: any) {

  try {

    const q = req.query.q;

    if (!q) {

      return res.status(400).json({
        error: "query required"
      });

    }

    const url =
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "GeoFenceTravelAlarm/1.0",
        "Accept-Language": "en"
      }
    });

    const data = await response.json();

    return res.status(200).json(data);

  } catch (e: any) {

    return res.status(500).json({
      error: e.message
    });

  }

}
