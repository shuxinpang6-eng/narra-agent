/* ============================================================
 * 研途 GradMate · Cloudflare Worker 中转代理
 * 作用：①保管智谱 API Key（不暴露在前端）②解决浏览器跨域 CORS
 * 部署方法（Cloudflare 控制台，免费）：
 *   1. 登录 dash.cloudflare.com → Workers 和 Pages → 创建 Worker
 *   2. 把本文件全部内容粘贴进去 → 部署
 *   3. 设置 → 变量和机密 → 添加"机密"：名称 ZHIPU_API_KEY，值 = 你的智谱 API Key
 *   4. 右上角复制 worker 的 URL（形如 https://xxx.workers.dev）填进网页 ⚙️ 设置
 * ============================================================ */

const UPSTREAM = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

export default {
  async fetch(request, env) {
    // 预检请求（浏览器跨域时会先发 OPTIONS）
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    try {
      const body = await request.json();
      const { messages, model } = body;
      if (!Array.isArray(messages) || messages.length === 0) {
        return new Response(JSON.stringify({ error: 'messages 不能为空' }), {
          status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }

      const apiKey = env.ZHIPU_API_KEY;
      if (!apiKey) {
        return new Response(JSON.stringify({ error: '服务端未配置 ZHIPU_API_KEY' }), {
          status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }

      const resp = await fetch(UPSTREAM, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model: model || 'glm-4-flash',
          messages,
          temperature: 0.6,
          stream: false
        })
      });

      const data = await resp.json();
      return new Response(JSON.stringify(data), {
        status: resp.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: '代理内部错误: ' + String(e) }), {
        status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }
  }
};
