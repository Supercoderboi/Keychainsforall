const THINGIVERSE_PUBLIC_TOKEN = "51533209463d211498753322a718e5e2";

async function fetchThingiverseJson(netlifyParams, directPath, directParams = {}) {
  // 1. Try Netlify proxy first
  const proxyRes = await fetch(`/.netlify/functions/thingiverse?${new URLSearchParams(netlifyParams)}`);
  if (proxyRes.ok) return await proxyRes.json();

  // 2. If Cloudflare blocked Netlify's AWS IP (502/403), fetch directly from user's browser
  const directUrl = new URL(directPath, "https://api.thingiverse.com");
  directUrl.searchParams.set("access_token", THINGIVERSE_PUBLIC_TOKEN);
  Object.entries(directParams).forEach(([k, v]) => { if (v) directUrl.searchParams.set(k, v); });

  const directRes = await fetch(directUrl.toString(), {
    headers: { "Authorization": `Bearer ${THINGIVERSE_PUBLIC_TOKEN}` }
  });
  const data = await directRes.json();
  if (!directRes.ok) throw new Error(data.error || `Thingiverse error (${directRes.status})`);
  return data;
}
