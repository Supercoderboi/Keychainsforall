
const API_BASE = "https://api.thingiverse.com";

exports.handler = async (event) => {
    const token = process.env.THINGIVERSE_TOKEN;

    if (!token) {
        return json(500, {
            error: "THINGIVERSE_TOKEN is missing from Netlify environment variables."
        });
    }

    if (event.httpMethod !== "GET") {
        return json(405, { error: "Method not allowed." });
    }

    const params = event.queryStringParameters || {};
    const query = params.query;
    const id = params.id;

    if (!query && !id) {
        return json(400, {
            error: "Provide either a search query or a model ID."
        });
    }

    let endpoint;

    if (id) {
        endpoint = `/things/${encodeURIComponent(id)}`;
    } else {
        endpoint = `/search/${encodeURIComponent(query)}`;
    }

    const url = new URL(API_BASE + endpoint);

    if (!id) {
        url.searchParams.set("type", "things");
        url.searchParams.set("per_page", "20");

        if (params.sort) {
            url.searchParams.set("sort", params.sort);
        }
    }

    try {
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json"
            }
        });

        const text = await response.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            return json(502, {
                error: "Thingiverse returned a non-JSON response.",
                status: response.status
            });
        }

        if (!response.ok) {
            return json(response.status, {
                error: data.error || data.detail || "Thingiverse API request failed.",
                details: data
            });
        }

        return json(200, data);

    } catch (error) {
        return json(502, {
            error: "Could not connect to Thingiverse.",
            details: error.message
        });
    }
};

function json(statusCode, body) {
    return {
        statusCode,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify(body)
    };
}
