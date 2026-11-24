const API_BASE = "https://api.thingiverse.com";

const BROWSER_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Origin": "https://www.thingiverse.com",
    "Referer": "https://www.thingiverse.com/"
};

exports.handler = async (event) => {
    const token = (process.env.THINGIVERSE_TOKEN || "").trim();

    if (!token) {
        return json(500, { error: "THINGIVERSE_TOKEN is missing from Netlify environment variables." });
    }
    if (event.httpMethod !== "GET") {
        return json(405, { error: "Method not allowed." });
    }

    const params = event.queryStringParameters || {};
    const { query, id, files, sort, fileId } = params;

    // 1. Proxy STL binary for 3D Three.js viewport preview
    if (fileId) {
        try {
            const dlUrl = new URL(`/files/${encodeURIComponent(fileId)}/download`, API_BASE);
            dlUrl.searchParams.set("access_token", token);

            const dlRes = await fetch(dlUrl.toString(), {
                headers: {
                    ...BROWSER_HEADERS,
                    "Authorization": `Bearer ${token}`
                }
            });
            if (!dlRes.ok) {
                return json(dlRes.status, { error: `Could not fetch STL file (${dlRes.status}).` });
            }
            const buffer = Buffer.from(await dlRes.arrayBuffer());
            return {
                statusCode: 200,
                headers: {
                    "Content-Type": "application/octet-stream",
                    "Cache-Control": "public, max-age=3600"
                },
                body: buffer.toString("base64"),
                isBase64Encoded: true
            };
        } catch (err) {
            return json(502, { error: "Failed to proxy STL file.", details: err.message });
        }
    }

    // 2. Validate search / model ID
    if (!query && !id) {
        return json(400, { error: "Please provide a search query or model ID." });
    }

    let endpoint;
    if (id && files === "true") {
        endpoint = `/things/${encodeURIComponent(id)}/files`;
    } else if (id) {
        endpoint = `/things/${encodeURIComponent(id)}`;
    } else {
        endpoint = `/search/${encodeURIComponent(query)}`;
    }

    const url = new URL(endpoint, API_BASE);
    url.searchParams.set("access_token", token);

    if (!id) {
        url.searchParams.set("type", "things");
        url.searchParams.set("per_page", "20");
        if (sort) url.searchParams.set("sort", sort);
    }

    try {
        const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
                ...BROWSER_HEADERS,
                "Authorization": `Bearer ${token}`
            }
        });

        const responseText = await response.text();
        let data;

        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            return json(502, {
                error: `Cloudflare blocked the serverless IP (HTTP ${response.status}).`,
                upstreamStatus: response.status,
                responsePreview: responseText.slice(0, 200)
            });
        }

        if (!response.ok) {
            return json(response.status, {
                error: data.error || `Thingiverse API error (HTTP ${response.status}).`,
                upstreamStatus: response.status,
                details: data
            });
        }

        return json(200, data);
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
