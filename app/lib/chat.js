export const CHAT_STORAGE_KEY = 'serotonin.chat.settings.v1';

export const PROVIDERS = {
  ollama: {
    id: 'ollama',
    label: 'Ollama',
    description: 'Local models on localhost',
    needsKey: false,
    defaultModel: 'llama3.1',
    defaultBaseUrl: 'http://localhost:11434',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    description: 'OpenAI API key',
    needsKey: true,
    defaultModel: 'gpt-4o-mini',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    description: 'Anthropic API key',
    needsKey: true,
    defaultModel: 'claude-3-5-sonnet-latest',
  },
};

export const DEFAULT_SETTINGS = {
  provider: 'ollama',
  ollamaBaseUrl: PROVIDERS.ollama.defaultBaseUrl,
  ollamaModel: PROVIDERS.ollama.defaultModel,
  openaiModel: PROVIDERS.openai.defaultModel,
  openaiApiKey: '',
  anthropicModel: PROVIDERS.anthropic.defaultModel,
  anthropicApiKey: '',
};

export const MODEL_CATALOG = {
  ollama: [
    {
      label: 'Llama',
      options: [
        { value: 'llama3.3', label: 'Llama 3.3' },
        { value: 'llama3.2', label: 'Llama 3.2' },
        { value: 'llama3.1', label: 'Llama 3.1' },
      ],
    },
    {
      label: 'Qwen',
      options: [
        { value: 'qwen3', label: 'Qwen 3' },
        { value: 'qwen2.5', label: 'Qwen 2.5' },
        { value: 'qwen2.5-coder', label: 'Qwen 2.5 Coder' },
      ],
    },
    {
      label: 'Gemma',
      options: [
        { value: 'gemma3', label: 'Gemma 3' },
        { value: 'gemma2', label: 'Gemma 2' },
      ],
    },
    {
      label: 'DeepSeek',
      options: [
        { value: 'deepseek-r1', label: 'DeepSeek R1' },
        { value: 'deepseek-v3', label: 'DeepSeek V3' },
      ],
    },
    {
      label: 'MiniMax',
      options: [{ value: 'minimax-m1', label: 'MiniMax M1' }],
    },
    {
      label: 'More',
      options: [
        { value: 'mistral', label: 'Mistral' },
        { value: 'mistral-nemo', label: 'Mistral Nemo' },
        { value: 'phi4', label: 'Phi-4' },
      ],
    },
  ],
  openai: [
    {
      label: 'Popular OpenAI models',
      options: [
        { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
        { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
        { value: 'gpt-4.1', label: 'GPT-4.1' },
        { value: 'o3-mini', label: 'o3-mini' },
      ],
    },
  ],
  anthropic: [
    {
      label: 'Popular Anthropic models',
      options: [
        { value: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' },
        { value: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
        { value: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet' },
      ],
    },
  ],
};

export const CHAT_MODE_PROMPTS = {
  chat: [
    'You are Serotonin Chat, a concise, helpful assistant.',
    'Answer directly, keep the tone practical, and focus on conversation.',
    'Do not claim to use tools or browse unless the user explicitly provides the context.',
  ].join(' '),
  agent: [
    'You are Serotonin Agent, a concise planning assistant.',
    'You do not have tool access in this version, so be explicit about limits.',
    'Be action-oriented, structured, and careful about assumptions.',
  ].join(' '),
};

export function cloneDefaultSettings() {
  return { ...DEFAULT_SETTINGS };
}

export function getProviderMeta(provider) {
  return PROVIDERS[provider] || PROVIDERS.ollama;
}

export function getActiveModel(settings) {
  const provider = settings?.provider || 'ollama';
  const meta = getProviderMeta(provider);

  if (provider === 'ollama') {
    return settings?.ollamaModel?.trim() || meta.defaultModel;
  }

  if (provider === 'anthropic') {
    return settings?.anthropicModel?.trim() || meta.defaultModel;
  }

  return settings?.openaiModel?.trim() || meta.defaultModel;
}

export function getModelCatalog(provider) {
  return MODEL_CATALOG[provider] || [];
}

export function isKnownModel(provider, model) {
  const value = (model || '').trim();
  if (!value) return false;
  return getModelCatalog(provider).some((group) => group.options.some((option) => option.value === value));
}

export function getModelKind(provider, model) {
  return isKnownModel(provider, model) ? 'preset' : 'custom';
}

export function getModelPresetValue(provider, model) {
  const value = (model || '').trim();
  if (!value) return '';
  return isKnownModel(provider, value) ? value : '__custom__';
}

export function getProviderKey(settings) {
  const provider = settings?.provider || 'ollama';
  if (provider === 'openai') return settings?.openaiApiKey?.trim() || '';
  if (provider === 'anthropic') return settings?.anthropicApiKey?.trim() || '';
  return '';
}

export function getOllamaBaseUrl(settings) {
  return (settings?.ollamaBaseUrl || PROVIDERS.ollama.defaultBaseUrl).trim().replace(/\/+$/, '') || PROVIDERS.ollama.defaultBaseUrl;
}

export function buildSystemPrompt(mode) {
  return CHAT_MODE_PROMPTS[mode] || CHAT_MODE_PROMPTS.chat;
}

export function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .map((message) => {
      const role = message?.role;
      const content = typeof message?.content === 'string' ? message.content : message?.content == null ? '' : String(message.content);

      if (!content.trim()) return null;
      if (role !== 'user' && role !== 'assistant') return null;

      return { role, content };
    })
    .filter(Boolean);
}

export function trimMessages(messages, { maxMessages = 24, maxChars = 12000 } = {}) {
  const normalized = normalizeMessages(messages);
  if (!normalized.length) return [];

  const selected = [];
  let charCount = 0;

  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    const item = normalized[index];
    const nextChars = charCount + item.content.length;
    if (selected.length >= maxMessages) break;
    if (nextChars > maxChars && selected.length > 0) break;
    selected.unshift(item);
    charCount = nextChars;
  }

  return selected;
}

export function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatInlineHtml(text) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br />');
}
