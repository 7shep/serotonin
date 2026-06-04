import { buildSystemPrompt, getActiveModel, getOllamaBaseUrl, getProviderKey, getProviderMeta, trimMessages } from '../../lib/chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(message, status = 400, extra = {}) {
  return Response.json({ error: message, ...extra }, { status });
}

function getProviderRequestConfig({ provider, model, settings }) {
  const providerMeta = getProviderMeta(provider);
  const activeModel = model?.trim() || getActiveModel(settings);

  if (provider === 'ollama') {
    const baseUrl = getOllamaBaseUrl(settings);
    return {
      providerMeta,
      activeModel,
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      url: `${baseUrl}/api/chat`,
      body: {
        model: activeModel,
        messages: [],
        stream: true,
      },
    };
  }

  if (provider === 'openai') {
    const apiKey = getProviderKey(settings);
    return {
      providerMeta,
      activeModel,
      apiKey,
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      url: 'https://api.openai.com/v1/chat/completions',
      body: {
        model: activeModel,
        messages: [],
        stream: true,
      },
    };
  }

  if (provider === 'anthropic') {
    const apiKey = getProviderKey(settings);
    return {
      providerMeta,
      activeModel,
      apiKey,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      url: 'https://api.anthropic.com/v1/messages',
      body: {
        model: activeModel,
        max_tokens: 2048,
        messages: [],
        system: '',
        stream: true,
      },
    };
  }

  return null;
}

async function readErrorText(response) {
  try {
    const text = await response.text();
    if (!text) return '';
    const parsed = JSON.parse(text);
    return parsed?.error?.message || parsed?.error || text;
  } catch {
    return '';
  }
}

async function streamOllama(response, push) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Ollama response did not include a stream.');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (line) {
        const parsed = JSON.parse(line);
        const content = parsed?.message?.content;
        if (content) push(content);
      }

      newlineIndex = buffer.indexOf('\n');
    }
  }

  if (buffer.trim()) {
    const parsed = JSON.parse(buffer.trim());
    const content = parsed?.message?.content;
    if (content) push(content);
  }
}

async function streamOpenAI(response, push) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('OpenAI response did not include a stream.');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n');
    buffer = events.pop() || '';

    for (const line of events) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;

      const parsed = JSON.parse(data);
      const delta = parsed?.choices?.[0]?.delta?.content;
      if (delta) push(delta);
    }
  }

  if (buffer.trim()) {
    const trimmed = buffer.trim();
    if (trimmed.startsWith('data:')) {
      const data = trimmed.slice(5).trim();
      if (data && data !== '[DONE]') {
        const parsed = JSON.parse(data);
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (delta) push(delta);
      }
    }
  }
}

async function streamAnthropic(response, push) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Anthropic response did not include a stream.');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n');
    buffer = events.pop() || '';

    for (const line of events) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;

      const parsed = JSON.parse(data);
      const delta = parsed?.delta?.text || (parsed?.type === 'content_block_delta' ? parsed?.delta?.text : '');
      if (delta) push(delta);
    }
  }

  if (buffer.trim()) {
    const trimmed = buffer.trim();
    if (trimmed.startsWith('data:')) {
      const data = trimmed.slice(5).trim();
      if (data && data !== '[DONE]') {
        const parsed = JSON.parse(data);
        const delta = parsed?.delta?.text || (parsed?.type === 'content_block_delta' ? parsed?.delta?.text : '');
        if (delta) push(delta);
      }
    }
  }
}

async function collectAndStream(provider, upstreamResponse, push) {
  if (provider === 'ollama') {
    await streamOllama(upstreamResponse, push);
    return;
  }

  if (provider === 'openai') {
    await streamOpenAI(upstreamResponse, push);
    return;
  }

  if (provider === 'anthropic') {
    await streamAnthropic(upstreamResponse, push);
  }
}

export async function POST(request) {
  let payload;

  try {
    payload = await request.json();
  } catch {
    return jsonError('Request body must be valid JSON.', 400);
  }

  const provider = payload?.provider || 'ollama';
  const mode = payload?.mode === 'agent' ? 'agent' : 'chat';
  const settings = payload?.settings || {};
  const model = typeof payload?.model === 'string' ? payload.model : '';
  const messages = trimMessages(payload?.messages, { maxMessages: 24, maxChars: 12000 });
  const systemPrompt = buildSystemPrompt(mode);

  if (!messages.length) {
    return jsonError('At least one user message is required.', 400);
  }

  const requestConfig = getProviderRequestConfig({ provider, model, settings });
  if (!requestConfig) {
    return jsonError(`Unsupported provider: ${provider}`, 400);
  }

  if ((provider === 'openai' || provider === 'anthropic') && !requestConfig.apiKey) {
    return jsonError(`Missing ${requestConfig.providerMeta.label} API key.`, 400);
  }

  const upstreamBody =
    provider === 'anthropic'
      ? {
          ...requestConfig.body,
          system: systemPrompt,
          messages: messages.map((message) => ({ role: message.role, content: message.content })),
        }
      : {
          ...requestConfig.body,
          messages:
            provider === 'ollama'
              ? [{ role: 'system', content: systemPrompt }, ...messages.map((message) => ({ role: message.role, content: message.content }))]
              : [{ role: 'system', content: systemPrompt }, ...messages.map((message) => ({ role: message.role, content: message.content }))],
        };

  let upstream;
  try {
    upstream = await fetch(requestConfig.url, {
      method: 'POST',
      headers: requestConfig.headers,
      body: JSON.stringify(upstreamBody),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Provider request failed.';
    return jsonError(`${requestConfig.providerMeta.label} connection failed: ${message}`, 502);
  }

  if (!upstream.ok) {
    const errorText = await readErrorText(upstream);
    return jsonError(errorText || `${requestConfig.providerMeta.label} request failed with status ${upstream.status}.`, upstream.status);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const push = (text) => {
        if (text) controller.enqueue(encoder.encode(text));
      };

      try {
        await collectAndStream(provider, upstream, push);
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
