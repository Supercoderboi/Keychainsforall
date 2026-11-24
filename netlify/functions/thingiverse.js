
const API_BASE = "https://api.thingiverse.com";

exports.handler = async (event) => {
    const token = process.env.THINGIVERSE_TOKEN;

    // Check for API token
    if (!token) {
        return json(500, {
            error: "THINGIVERSE_TOKEN is missing from Netlify environment variables."
        });
    }

    // Only allow GET requests
    if (event.httpMethod !== "GET") {
        return json(405, {
            error: "Method not allowed."
        });
    }

    const params = event.queryStringParameters || {};
    const query = params.query;
    const id = params.id;

    // Validate parameters
    if (!query && !id) {
        return json(400, {
            error: "Please provide a search query or model ID."
        });
    }

    // Build API endpoint
    let endpoint;

    if (id) {
        endpoint = `/things/${encodeURIComponent(id)}`;
    } else {
        endpoint = `/search/${encodeURIComponent(query)}`;
    }

    const url = new URL(endpoint, API_BASE);

    // Search parameters
    if (!id) {
        url.searchParams.set("type", "things");
        url.searchParams.set("per_page", "20");

        if (params.sort) {
            url.searchParams.set("sort", params.sort);
        }
    }

    try {
        const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Accept": "application/json"
            }
        });

        const responseText = await response.text();

        // Try parsing Thingiverse response
        let data;

        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            return json(502, {
                error: "Thingiverse returned a non-JSON response.",
                upstreamStatus: response.status,
                contentType: response.headers.get("content-type"),
                responsePreview: responseText.slice(0, 500)
            });
        }

        // Handle API errors
        if (!response.ok) {
            return json(response.status, {
                error: "Thingiverse API request failed.",
                upstreamStatus: response.status,
                details: data
            });
        }

        // Successful response
        return json(200, data);

    } catch (error) {
        return json(502, {
            error: "Could not connect to Thingiverse.",
            details: error.message
        });
    }
};


// Consistent JSON response helper
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
