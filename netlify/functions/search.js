const API_BASE = "https://api.thingiverse.com";

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed." });
  }

  const params = event.queryStringParameters || {};
  const query = (params.q || "").trim().slice(0, 100);
  const sort = ["relevant", "popular", "newest"].includes(params.sort) ? params.sort : "relevant";
  const page = Math.max(1, Math.min(100, Number.parseInt(params.page || "1", 10) || 1));
  const token = (process.env.THINGIVERSE_TOKEN || "").trim();

  if (!query) return json(400, { error: "Enter a search phrase." });
  if (!token) return json(500, { error: "THINGIVERSE_TOKEN is missing from Netlify environment variables." });

  const url = new URL(`/search/${encodeURIComponent(query)}`, API_BASE);
  url.searchParams.set("type", "things");
  url.searchParams.set("sort", sort);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", "12");

  try {
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });
    const responseText = await response.text();
    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      return json(502, {
        error: `Thingiverse returned a non-JSON response (HTTP ${response.status}); Cloudflare may be blocking this server.`,
        upstreamStatus: response.status
      });
    }

    if (!response.ok) {
      return json(response.status, {
        error: data.error || `Thingiverse API error (HTTP ${response.status}).`,
        upstreamStatus: response.status
      });
    }

    const models = (data.hits || data.things || data.results || []).map(item => ({
      id: String(item.id ?? item.thing_id ?? ""),
      name: item.name || item.title || "Untitled Thingiverse model",
      url: item.public_url || item.url || "",
      thumbnail: typeof item.thumbnail === "string" ? item.thumbnail : item.thumbnail?.url || item.thumbnail_url || "",
      creator: item.creator?.name || item.creator?.username || item.username || "Unknown creator",
      license: item.license?.name || item.license_name || (typeof item.license === "string" ? item.license : "")
    })).filter(model => model.id);

    return json(200, { total: data.total || models.length, models });
  } catch (error) {
    return json(502, { error: "Could not connect to Thingiverse.", details: error.message });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}
