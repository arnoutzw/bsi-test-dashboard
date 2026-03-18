// GET /api/manifests — List manifest versions
// GET /api/manifests?version=1.2.9 — Get specific manifest

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const version = url.searchParams.get('version');

  if (version) {
    const manifest = await env.BSI_DASHBOARD.get(`manifests:${version}`, 'json');
    if (!manifest) {
      return Response.json({ error: 'Manifest not found' }, { status: 404, headers: CORS_HEADERS });
    }
    return Response.json(manifest, { headers: CORS_HEADERS });
  }

  const index = await env.BSI_DASHBOARD.get('manifests:index', 'json');
  return Response.json(index || { versions: [] }, { headers: CORS_HEADERS });
}
