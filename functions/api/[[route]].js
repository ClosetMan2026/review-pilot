import worker from '../../src/index.js';

const UPSTREAM_WORKER_URL = 'https://review-pilot.momogeman1009.workers.dev';

export async function onRequest(context) {
  // 1. Pages環境でD1 (env.DB) が利用可能な場合は直接Workerロジックを実行
  if (context.env && context.env.DB) {
    try {
      return await worker.fetch(context.request, context.env, context);
    } catch (err) {
      console.error('Direct worker execution error:', err);
    }
  }

  // 2. D1未バインド環境（または直接実行例外時）は本番Workerへプロキシ連携
  try {
    const url = new URL(context.request.url);
    const upstreamUrl = new URL(url.pathname + url.search, UPSTREAM_WORKER_URL);

    // リクエストヘッダーの複製
    const proxyHeaders = new Headers(context.request.headers);
    proxyHeaders.set('X-Forwarded-Host', url.host);
    proxyHeaders.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

    const proxyRequestInit = {
      method: context.request.method,
      headers: proxyHeaders,
      redirect: 'manual'
    };

    // GET/HEAD以外でボディが存在する場合は転送
    if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
      proxyRequestInit.body = await context.request.arrayBuffer();
    }

    const upstreamResponse = await fetch(upstreamUrl.toString(), proxyRequestInit);

    // レスポンスヘッダーの複製
    const responseHeaders = new Headers(upstreamResponse.headers);

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: 'Proxy Gateway Error: ' + err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
