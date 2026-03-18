// GET /api/runs — List all test runs (summary index)
// POST /api/runs — Submit a new test run

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestGet({ env }) {
  const index = await env.BSI_DASHBOARD.get('runs:index', 'json');
  return Response.json(index || { lastUpdated: null, runs: [] }, { headers: CORS_HEADERS });
}

export async function onRequestPost({ request, env }) {
  let run;
  try {
    run = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS_HEADERS });
  }

  // Validate required fields
  const required = ['timestamp', 'totalPass', 'totalFail', 'totalTests', 'suites'];
  for (const field of required) {
    if (run[field] === undefined) {
      return Response.json({ error: `Missing required field: ${field}` }, { status: 400, headers: CORS_HEADERS });
    }
  }

  // Generate ID if not provided
  if (!run.id) {
    const ts = run.timestamp.replace(/[:.]/g, '-');
    const version = run.manifestVersion || 'unknown';
    const mode = run.mode || 'unknown';
    run.id = `${ts}_v${version}_${mode}`;
  }

  // Compute pass rate if not provided
  if (run.passRate === undefined && run.totalTests > 0) {
    run.passRate = Math.round((run.totalPass / run.totalTests) * 1000) / 10;
  }

  // Enrich suite data
  if (run.suites) {
    for (const suite of run.suites) {
      if (suite.pass === undefined) suite.pass = suite.tests.filter(t => t.status === 'pass').length;
      if (suite.fail === undefined) suite.fail = suite.tests.filter(t => t.status === 'fail').length;
      if (suite.skip === undefined) suite.skip = suite.tests.filter(t => t.status === 'skip').length;
      if (suite.totalTests === undefined) suite.totalTests = suite.tests.length;
    }
  }

  // Store full run
  await env.BSI_DASHBOARD.put(`runs:${run.id}`, JSON.stringify(run));

  // Update index
  const index = await env.BSI_DASHBOARD.get('runs:index', 'json') || { lastUpdated: null, runs: [] };
  const summary = {
    id: run.id,
    timestamp: run.timestamp,
    version: run.manifestVersion || 'unknown',
    mode: run.mode || 'unknown',
    totalPass: run.totalPass,
    totalFail: run.totalFail,
    totalSkip: run.totalSkip || 0,
    totalTests: run.totalTests,
    passRate: run.passRate,
    elapsed: run.elapsed || 0,
  };

  // Prepend new run (most recent first), prevent duplicates
  index.runs = index.runs.filter(r => r.id !== run.id);
  index.runs.unshift(summary);
  index.lastUpdated = new Date().toISOString();
  await env.BSI_DASHBOARD.put('runs:index', JSON.stringify(index));

  // Snapshot manifest if provided and version is new
  if (run.manifest && run.manifestVersion) {
    const existing = await env.BSI_DASHBOARD.get(`manifests:${run.manifestVersion}`);
    if (!existing) {
      await env.BSI_DASHBOARD.put(`manifests:${run.manifestVersion}`, JSON.stringify(run.manifest));

      // Update manifest index
      const mIndex = await env.BSI_DASHBOARD.get('manifests:index', 'json') || { versions: [] };
      if (!mIndex.versions.find(v => v.version === run.manifestVersion)) {
        mIndex.versions.unshift({
          version: run.manifestVersion,
          date: run.manifestDate || run.manifest.date || null,
          repoCount: run.manifest.repos ? Object.keys(run.manifest.repos).length : 0,
        });
        await env.BSI_DASHBOARD.put('manifests:index', JSON.stringify(mIndex));
      }
    }
  }

  return Response.json({ ok: true, id: run.id }, { status: 201, headers: CORS_HEADERS });
}
