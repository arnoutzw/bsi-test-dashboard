// GET /api/events — List webhook events from bsi-devops

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestGet({ env }) {
  const events = await env.BSI_DASHBOARD.get('events:log', 'json');
  return Response.json(events || [], { headers: CORS_HEADERS });
}
