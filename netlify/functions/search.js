export default async (req) => {
  const url = new URL(req.url);
  const query = url.searchParams.get("q");
  const page = url.searchParams.get("page") || "1";
  const sort = url.searchParams.get("sort") || "popular";

  if (!query) {
    return Response.json({ error: "Missing search query" }, { status: 400 });
  }

  const thingiverseUrl = `https://thingiverse.com{encodeURIComponent(query)}?type=things&sort=${sort}&page=${page}&per_page=12`;

  try {
    const response = await fetch(thingiverseUrl, {
      headers: {
        Authorization: `Bearer ${process.env.THINGIVERSE_TOKEN}`
      }
    });

    if (!response.ok) {
      return Response.json(
        { error: "Thingiverse API error" },
        { status: response.status }
      );
    }

    const data = await response.json();

    const models = (data.hits || []).map((item) => ({
      id: item.id,
      name: item.name,
      url: item.public_url,
      thumbnail: item.thumbnail,
      creator: item.creator?.name
    }));

    return Response.json({ total: data.total, models });
  } catch (error) {
    return Response.json({ error: "Server error" }, { status: 500 });
  }
};

// Optional: exposes the function at /api/search instead of /.netlify/functions/search
export const config = {
  path: "/api/search"
};
