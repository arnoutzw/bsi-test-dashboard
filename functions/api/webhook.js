// POST /api/webhook — GitHub webhook handler for bsi-devops
// Tracks manifest changes and commit events

const ALLOWED_ORIGINS = ['https://blacksphereindustries.nl', 'https://www.blacksphereindustries.nl'];
function getCorsHeaders(request) {
  const origin = request?.headers?.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.pages.dev');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Hub-Signature-256',
  };
}

export async function onRequestOptions({ request }) {
  return new Response(null, { headers: getCorsHeaders(request) });
}

async function verifySignature(request, secret) {
  if (!secret) return true; // Skip verification if no secret configured
  const signature = request.headers.get('X-Hub-Signature-256');
  if (!signature) return false;

  const body = await request.clone().text();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const digest = 'sha256=' + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return digest === signature;
}

export async function onRequestPost({ request, env }) {
  // Verify GitHub webhook signature
  const secret = env.WEBHOOK_SECRET || '';
  if (secret && !(await verifySignature(request, secret))) {
    return Response.json({ error: 'Invalid signature' }, { status: 401, headers: getCorsHeaders(request) });
  }

  const event = request.headers.get('X-GitHub-Event');
  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: getCorsHeaders(request) });
  }

  // Only process push events to default branch
  if (event !== 'push') {
    return Response.json({ ok: true, skipped: 'Not a push event' }, { headers: getCorsHeaders(request) });
  }

  const ref = payload.ref || '';
  if (!ref.endsWith('/main') && !ref.endsWith('/master')) {
    return Response.json({ ok: true, skipped: 'Not default branch' }, { headers: getCorsHeaders(request) });
  }

  // Check if release-manifest.json was modified
  const commits = payload.commits || [];
  const manifestChanged = commits.some(c =>
    (c.modified || []).includes('release-manifest.json') ||
    (c.added || []).includes('release-manifest.json')
  );

  // Build event entry
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: manifestChanged ? 'manifest-update' : 'push',
    repo: payload.repository?.full_name || 'unknown',
    ref: ref,
    commitHash: payload.head_commit?.id?.substring(0, 7) || 'unknown',
    commitMessage: payload.head_commit?.message?.split('\n')[0] || '',
    author: payload.head_commit?.author?.name || 'unknown',
    manifestChanged,
  };

  // If manifest changed, try to fetch and store the new manifest
  if (manifestChanged && payload.repository) {
    try {
      const owner = payload.repository.owner?.login || payload.repository.owner?.name;
      const repo = payload.repository.name;
      const resp = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/release-manifest.json`,
        { headers: { 'Accept': 'application/vnd.github.v3.raw', 'User-Agent': 'BSI-Test-Dashboard' } }
      );
      if (resp.ok) {
        const manifest = await resp.json();
        if (manifest.version) {
          logEntry.version = manifest.version;
          // Store manifest snapshot
          const existing = await env.BSI_DASHBOARD.get(`manifests:${manifest.version}`);
          if (!existing) {
            await env.BSI_DASHBOARD.put(`manifests:${manifest.version}`, JSON.stringify(manifest));
            // Update manifest index
            const mIndex = await env.BSI_DASHBOARD.get('manifests:index', 'json') || { versions: [] };
            if (!mIndex.versions.find(v => v.version === manifest.version)) {
              mIndex.versions.unshift({
                version: manifest.version,
                date: manifest.date || null,
                repoCount: manifest.repos ? Object.keys(manifest.repos).length : 0,
              });
              await env.BSI_DASHBOARD.put('manifests:index', JSON.stringify(mIndex));
            }
          }
        }
      }
    } catch (e) {
      logEntry.fetchError = e.message;
    }
  }

  // Append to event log (keep last 100 events)
  const eventLog = await env.BSI_DASHBOARD.get('events:log', 'json') || [];
  eventLog.unshift(logEntry);
  if (eventLog.length > 100) eventLog.length = 100;
  await env.BSI_DASHBOARD.put('events:log', JSON.stringify(eventLog));

  return Response.json({ ok: true, event: logEntry }, { status: 200, headers: getCorsHeaders(request) });
}
