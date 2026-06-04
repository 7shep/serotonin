'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CHAT_STORAGE_KEY,
  DEFAULT_SETTINGS,
  PROVIDERS,
  cloneDefaultSettings,
  formatInlineHtml,
  getActiveModel,
  getModelCatalog,
  getOllamaBaseUrl,
  getProviderKey,
  getProviderMeta,
  trimMessages,
} from './lib/chat';

/* Quick-start chips (kept from the design — the user liked these). */
const CHIPS = [
  { id: 'inbox', t: 'Summarize my inbox', icon: 'mail', cls: 'acc' },
  { id: 'pr', t: 'Review this PR', icon: 'code', cls: 'mnt' },
  { id: 'research', t: 'Research a topic', icon: 'globe', cls: 'mnt' },
  { id: 'week', t: 'Plan my week', icon: 'calendar', cls: 'acc' },
];

/* Static tool list shown in the sidebar (capabilities of Agent mode). */
const TOOLS = [
  { id: 'web', label: 'Web search', icon: 'globe' },
  { id: 'shell', label: 'Shell', icon: 'terminal' },
  { id: 'files', label: 'Files', icon: 'doc' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
];

const ICONS = {
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  tools: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2-2z" />,
  search: <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></>,
  terminal: <><polyline points="4 7 9 12 4 17" /><line x1="12" y1="17" x2="20" y2="17" /></>,
  send: <><line x1="12" y1="19" x2="12" y2="5" /><polyline points="6 11 12 5 18 11" /></>,
  stop: <rect x="7" y="7" width="10" height="10" rx="2" />,
  chevDown: <polyline points="6 9 12 15 18 9" />,
  chevRight: <polyline points="9 6 15 12 9 18" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  doc: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  code: <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>,
  paperclip: <path d="M21.4 11.05 12.25 20.2a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.2 9.19a1 1 0 0 1-1.41-1.41l8.48-8.49" />,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" /></>,
  more: <><circle cx="12" cy="5" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="19" r="1.4" /></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  check: <polyline points="20 6 9 17 4 12" />,
  globe: <><circle cx="12" cy="12" r="9" /><line x1="3" y1="12" x2="21" y2="12" /><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3 7 12 13 21 7" /></>,
  bolt: <polygon points="13 2 3 14 11 14 11 22 21 10 13 10 13 2" />,
  alert: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="7" x2="12" y2="13" /><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" /></>,
  x: <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>,
};

function Icon({ name, size = 18, stroke = 1.7, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

/* geometric "happy molecule" mark */
function SeroGlyph({ size = 68 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <g stroke="var(--line-hi)" strokeWidth="2" strokeLinecap="round">
        <line x1="32" y1="32" x2="32" y2="12" />
        <line x1="32" y1="32" x2="14" y2="44" />
        <line x1="32" y1="32" x2="50" y2="44" />
        <line x1="14" y1="44" x2="32" y2="12" />
      </g>
      <circle cx="32" cy="32" r="6.5" fill="var(--mint)" />
      <circle cx="32" cy="12" r="4.5" fill="var(--accent)" />
      <circle cx="14" cy="44" r="4" fill="var(--accent)" />
      <circle cx="50" cy="44" r="4" fill="var(--mint)" />
      <circle cx="32" cy="32" r="11.5" stroke="var(--mint)" strokeWidth="1.5" opacity="0.4" />
    </svg>
  );
}

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function setProviderModel(setSettings, provider, value) {
  setSettings((prev) => {
    if (provider === 'openai') return { ...prev, openaiModel: value };
    if (provider === 'anthropic') return { ...prev, anthropicModel: value };
    return { ...prev, ollamaModel: value };
  });
}

function useIsMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function loadSettings() {
  if (typeof window === 'undefined') return cloneDefaultSettings();

  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return cloneDefaultSettings();

    const parsed = JSON.parse(raw);
    return {
      ...cloneDefaultSettings(),
      ...parsed,
      provider: PROVIDERS[parsed?.provider] ? parsed.provider : DEFAULT_SETTINGS.provider,
    };
  } catch {
    return cloneDefaultSettings();
  }
}

function paraHtml(text, trailingCursor) {
  return `${formatInlineHtml(text)}${trailingCursor ? '<span class="cursor"></span>' : ''}`;
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };
  return (
    <span className="cp" role="button" tabIndex={0} aria-label="Copy code" onClick={copy}>
      <Icon name={copied ? 'check' : 'copy'} size={14} />
    </span>
  );
}

/* Renders streamed assistant content: plain paragraphs + fenced code blocks. */
function MessageContent({ content, streaming }) {
  if (!content && streaming) {
    return (
      <div className="typing" aria-label="Assistant is thinking">
        <i />
        <i />
        <i />
      </div>
    );
  }

  const segments = content.split(/```([\s\S]*?)```/g);

  return segments.map((segment, index) => {
    if (index % 2 === 1) {
      const trimmed = segment.replace(/^\n+|\n+$/g, '');
      const firstBreak = trimmed.indexOf('\n');
      const firstLine = (firstBreak === -1 ? trimmed : trimmed.slice(0, firstBreak)).trim();
      const hasLang = firstLine.length > 0 && firstLine.length <= 20 && !/\s/.test(firstLine);
      const lang = hasLang ? firstLine : '';
      const code = hasLang ? trimmed.slice(firstBreak + 1) : trimmed;

      return (
        <div className="code-block" key={`code-${index}`}>
          <div className="hd">
            <span className="dots">
              <i style={{ background: 'var(--accent)' }} />
              <i style={{ background: 'var(--mint)' }} />
              <i style={{ background: 'var(--line-hi)' }} />
            </span>
            {lang || 'code'}
            <CopyButton value={code} />
          </div>
          <pre>{code}</pre>
        </div>
      );
    }

    if (!segment.trim()) return null;

    const paragraphs = segment.split(/\n{2,}/).filter((p) => p.trim());
    return paragraphs.map((paragraph, pIndex) => (
      <p
        className="para"
        key={`p-${index}-${pIndex}`}
        dangerouslySetInnerHTML={{
          __html: paraHtml(
            paragraph,
            streaming && index === segments.length - 1 && pIndex === paragraphs.length - 1,
          ),
        }}
      />
    ));
  });
}

function Message({ message }) {
  const isUser = message.role === 'user';
  const error = message.status === 'error';
  const streaming = message.status === 'streaming';

  if (isUser) {
    return (
      <div className="row user">
        <span className="ava">SO</span>
        <div className="body">
          <div className="who-name">
            <b>You</b>
          </div>
          <div className="bubble">
            <p dangerouslySetInnerHTML={{ __html: paraHtml(message.content, false) }} />
          </div>
        </div>
      </div>
    );
  }

  const modeLabel = message.meta?.modeLabel === 'agent' ? 'agent run' : 'chat';

  return (
    <div className={cx('row ai', error && 'error')}>
      <span className="ava" />
      <div className="body">
        <div className="who-name">
          <b>Serotonin</b> · {error ? 'error' : modeLabel}
        </div>
        <MessageContent content={message.content} streaming={streaming} />
      </div>
    </div>
  );
}

function Sidebar({
  threadTitle,
  hasThread,
  openNav,
  setOpenNav,
  onNewChat,
  onOpenSettings,
  provider,
}) {
  const toggle = (key) => setOpenNav((prev) => (prev === key ? null : key));

  return (
    <aside className="side">
      <div className="brand">
        <span className="logo" />
        <span className="word">
          serotonin<span className="u">_</span>
        </span>
      </div>

      <div className="newchat" role="button" tabIndex={0} onClick={onNewChat}>
        <span className="plus">+</span> New chat <span className="kbd">⌘N</span>
      </div>

      <div className="navlabel">workspace</div>
      <nav className="nav">
        <div className={cx('item', openNav === 'chats' && 'active')} onClick={() => toggle('chats')}>
          <Icon name="chat" size={16} /> Chats
          <Icon name="chevRight" size={14} className={cx('chev', openNav === 'chats' && 'open')} />
        </div>
        {openNav === 'chats' && (
          <div className="sub">
            {hasThread ? (
              <div className="s active">
                <span className="dot" />
                {threadTitle}
              </div>
            ) : (
              <div className="empty">No chats yet — start one above.</div>
            )}
          </div>
        )}

        <div className={cx('item', openNav === 'tools' && 'active')} onClick={() => toggle('tools')}>
          <Icon name="tools" size={16} /> Tools
          <Icon name="chevRight" size={14} className={cx('chev', openNav === 'tools' && 'open')} />
        </div>
        {openNav === 'tools' && (
          <div className="sub">
            {TOOLS.map((tool) => (
              <div className="s disabled" key={tool.id} title="Available to agents">
                <Icon name={tool.icon} size={14} />
                {tool.label}
              </div>
            ))}
          </div>
        )}
      </nav>

      <div className="side-foot">
        <span className="avatar">sk</span>
        <span className="who">
          Sam Okafor
          <small>{provider.label} · self-hosted</small>
        </span>
        <button className="gear" type="button" onClick={onOpenSettings} aria-label="Open settings">
          <Icon name="gear" size={15} />
        </button>
      </div>
    </aside>
  );
}

function Hero({ provider, activeModel, onPrompt }) {
  return (
    <div className="hero">
      <div className="glyph">
        <SeroGlyph size={68} />
      </div>
      <div className="title">
        <span className="a">sero</span>
        <span className="b">tonin</span>
      </div>
      <div className="tag">Your agents, running happily at home.</div>
      <div className="status">
        <span className="live" /> {provider.label} · {activeModel} · ready
      </div>
      <div className="chips">
        {CHIPS.map((chip) => (
          <div className={cx('chip', chip.cls)} key={chip.id} onClick={() => onPrompt(chip.t)}>
            <Icon name={chip.icon} size={15} /> {chip.t}
          </div>
        ))}
      </div>
    </div>
  );
}

function Composer({
  draft,
  setDraft,
  isSending,
  onSend,
  onStop,
  mode,
  setMode,
  activeModel,
  provider,
  setSettings,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = 'auto';
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 160)}px`;
  }, [draft]);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  const toolsDisabled = mode === 'chat';
  const toolTitle = toolsDisabled ? 'Tools need Agent mode' : null;

  return (
    <div className="composer-wrap">
      <div className="composer">
        <div className="input-row">
          <textarea
            ref={inputRef}
            className="input"
            rows={1}
            value={draft}
            placeholder="Ask Serotonin to build, fetch, or fix something…"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <ModelSelect
            variant="pill"
            direction="up"
            provider={provider}
            activeModel={activeModel}
            setSettings={setSettings}
          />
        </div>

        <div className="comp-foot">
          <button className="tool" type="button" title={toolTitle || 'Web search'} disabled={toolsDisabled}>
            <Icon name="search" size={15} />
          </button>
          <button className="tool" type="button" title={toolTitle || 'Shell'} disabled={toolsDisabled}>
            <Icon name="terminal" size={15} />
          </button>
          <button className="tool" type="button" title="Attach">
            <Icon name="paperclip" size={15} />
          </button>

          <div className="seg" role="radiogroup" aria-label="Chat mode">
            <div className={cx('opt', mode === 'agent' && 'on')} onClick={() => setMode('agent')}>
              Agent
            </div>
            <div className={cx('opt', mode === 'chat' && 'on')} onClick={() => setMode('chat')}>
              Chat
            </div>
          </div>

          {isSending ? (
            <button className="send stop" type="button" onClick={onStop} aria-label="Stop generating">
              <Icon name="stop" size={16} />
            </button>
          ) : (
            <button className="send" type="button" onClick={onSend} disabled={!draft.trim()} aria-label="Send">
              <Icon name="send" size={17} />
            </button>
          )}
        </div>
      </div>

      <div className={cx('mode-cap', mode)}>
        {mode === 'agent' ? (
          <>
            <Icon name="bolt" size={13} /> <b>Agent</b> · uses tools and runs multi-step tasks
          </>
        ) : (
          <>
            <Icon name="chat" size={13} /> <b>Chat</b> · fast, direct conversation — no tools
          </>
        )}
      </div>
    </div>
  );
}

function SettingsDrawer({ settings, setSettings, open, onClose }) {
  const provider = getProviderMeta(settings.provider);
  const providerKey = getProviderKey(settings);
  const activeModel = getActiveModel(settings);
  const modelCatalog = getModelCatalog(settings.provider);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const update = (field, value) => setSettings((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="settings-overlay" onMouseDown={onClose}>
      <aside className="settings-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="settings-head">
          <div>
            <div className="settings-kicker">Provider settings</div>
            <h2>Live chat providers</h2>
          </div>
          <button className="icbtn" type="button" onClick={onClose} aria-label="Close settings">
            <Icon name="x" size={15} />
          </button>
        </div>

        <div className="settings-note">
          Settings are saved only in your browser. API keys are never sent anywhere except the request to your
          selected provider.
        </div>

        <div className="settings-provider-list">
          {Object.values(PROVIDERS).map((entry) => {
            const active = entry.id === settings.provider;
            return (
              <button
                key={entry.id}
                type="button"
                className={cx('settings-provider', active && 'active')}
                onClick={() => update('provider', entry.id)}
              >
                <div>
                  <b>{entry.label}</b>
                  <span>{entry.description}</span>
                </div>
                <Icon name="chevRight" size={14} />
              </button>
            );
          })}
        </div>

        <div className="settings-card">
          <div className="settings-card-head">
            <div>
              <b>{provider.label}</b>
              <span>Active provider</span>
            </div>
            <span className="settings-active-pill">{activeModel}</span>
          </div>

          <label className="field">
            <span>Model</span>
            <input
              type="text"
              value={activeModel}
              onChange={(event) => setProviderModel(setSettings, provider.id, event.target.value)}
              list="model-options"
              placeholder={provider.defaultModel}
              autoComplete="off"
            />
            <datalist id="model-options">
              {modelCatalog.map((group) =>
                group.options.map((option) => <option key={option.value} value={option.value} />),
              )}
            </datalist>
          </label>

          {settings.provider === 'ollama' && (
            <label className="field">
              <span>Ollama base URL</span>
              <input
                type="url"
                value={settings.ollamaBaseUrl}
                onChange={(event) => update('ollamaBaseUrl', event.target.value)}
                placeholder="http://localhost:11434"
              />
            </label>
          )}

          {settings.provider === 'openai' && (
            <label className="field">
              <span>OpenAI API key</span>
              <input
                type="password"
                value={settings.openaiApiKey}
                onChange={(event) => update('openaiApiKey', event.target.value)}
                placeholder="sk-..."
                autoComplete="off"
              />
            </label>
          )}

          {settings.provider === 'anthropic' && (
            <label className="field">
              <span>Anthropic API key</span>
              <input
                type="password"
                value={settings.anthropicApiKey}
                onChange={(event) => update('anthropicApiKey', event.target.value)}
                placeholder="sk-ant-..."
                autoComplete="off"
              />
            </label>
          )}

          <div className="settings-footnote">
            {settings.provider === 'ollama' ? (
              <span>
                Ollama runs locally. The default URL is <code>{getOllamaBaseUrl(settings)}</code>.
              </span>
            ) : (
              <span>The current API key is {providerKey ? 'present' : 'missing'}.</span>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

/* Pill-style model selector with an anchored dropdown (opens up by the
   composer, down by the topbar badge). */
function ModelSelect({ variant = 'pill', direction = 'up', provider, activeModel, mode, setSettings }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const catalog = getModelCatalog(provider.id);
  const pick = (value) => {
    setProviderModel(setSettings, provider.id, value);
    setOpen(false);
  };

  return (
    <div className={cx('model-select', direction === 'down' && 'down')} ref={wrapRef}>
      {variant === 'badge' ? (
        <button className={cx('badge btn', open && 'open')} type="button" onClick={() => setOpen((o) => !o)} title="Choose a model">
          {mode} · {activeModel}
        </button>
      ) : (
        <button className={cx('model', open && 'open')} type="button" onClick={() => setOpen((o) => !o)} title="Choose a model">
          <span className="dotm" />
          <span className="name">{activeModel}</span>
          <Icon name="chevDown" size={12} className="mchev" />
        </button>
      )}

      {open && (
        <div className="model-menu" role="listbox" aria-label="Model">
          <div className="mm-title">Model</div>
          <div className="mm-scroll">
            {catalog.map((group) => (
              <div className="mm-group" key={group.label}>
                <div className="mm-glabel">{group.label}</div>
                {group.options.map((option) => {
                  const active = option.value === activeModel;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={cx('mm-item', active && 'active')}
                      onClick={() => pick(option.value)}
                    >
                      <span className="mm-item-name">{option.label}</span>
                      <span className="mm-item-tag">{option.value}</span>
                      {active && <Icon name="check" size={14} className="mm-item-check" />}
                    </button>
                  );
                })}
              </div>
            ))}
            {catalog.length === 0 && <div className="mm-empty">No preset models.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  const mounted = useIsMounted();
  const [settings, setSettings] = useState(() => cloneDefaultSettings());
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState('agent');
  const [messages, setMessages] = useState([]);
  const [view, setView] = useState('home');
  const [openNav, setOpenNav] = useState('chats');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorBanner, setErrorBanner] = useState('');
  const threadRef = useRef(null);
  const abortRef = useRef(null);
  const messageIdRef = useRef(0);

  useEffect(() => {
    if (!mounted) return;
    setSettings(loadSettings());
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(settings));
  }, [mounted, settings]);

  useEffect(() => {
    if (view !== 'chat' || !threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, view]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const provider = useMemo(() => getProviderMeta(settings.provider), [settings.provider]);
  const activeModel = useMemo(() => getActiveModel(settings), [settings]);
  const providerKey = useMemo(() => getProviderKey(settings), [settings]);
  const providerNotice = useMemo(() => {
    if (settings.provider === 'ollama' && !settings.ollamaBaseUrl.trim()) {
      return 'Set an Ollama base URL before sending.';
    }
    if (provider.needsKey && !providerKey) {
      return `${provider.label} needs an API key. Open settings to add one.`;
    }
    return '';
  }, [provider, providerKey, settings.ollamaBaseUrl, settings.provider]);

  const threadTitle = useMemo(() => {
    const firstUserMessage = messages.find((message) => message.role === 'user');
    if (!firstUserMessage) return 'New chat';
    const firstLine = firstUserMessage.content.split('\n')[0].trim();
    return firstLine.length > 42 ? `${firstLine.slice(0, 39)}…` : firstLine;
  }, [messages]);

  const updateAssistantMessage = (id, updater) => {
    setMessages((prev) => prev.map((message) => (message.id === id ? updater(message) : message)));
  };

  const runRequest = async (conversation, userText) => {
    const providerSettings = settings;
    const controller = new AbortController();
    abortRef.current = controller;

    const userMessage = { id: ++messageIdRef.current, role: 'user', content: userText };
    const assistantId = ++messageIdRef.current;
    const assistantMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      meta: { providerLabel: provider.label, modeLabel: mode },
    };

    const requestMessages = trimMessages([...conversation, userMessage], { maxMessages: 24, maxChars: 12000 });

    setMessages([...conversation, userMessage, assistantMessage]);
    setView('chat');
    setErrorBanner('');
    setIsSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          provider: providerSettings.provider,
          model: activeModel,
          mode,
          settings: providerSettings,
          messages: requestMessages,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || `Request failed with status ${response.status}.`);
      }

      if (!response.body) throw new Error('The provider returned no response stream.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        updateAssistantMessage(assistantId, (message) => ({ ...message, content: assistantText }));
      }

      assistantText += decoder.decode();
      updateAssistantMessage(assistantId, (message) => ({ ...message, content: assistantText, status: 'done' }));
    } catch (error) {
      if (controller.signal.aborted) {
        updateAssistantMessage(assistantId, (message) => ({
          ...message,
          content: message.content || 'Response cancelled.',
          status: 'done',
        }));
      } else {
        const text = error instanceof Error ? error.message : 'Something went wrong.';
        setErrorBanner(text);
        updateAssistantMessage(assistantId, (item) => ({ ...item, content: text, status: 'error' }));
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsSending(false);
    }
  };

  const sendMessage = async (text = draft) => {
    const cleaned = text.trim();
    if (!cleaned || isSending) return;
    setDraft('');
    await runRequest(messages, cleaned);
  };

  const stopSending = () => abortRef.current?.abort();

  const resetChat = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setDraft('');
    setView('home');
    setErrorBanner('');
    setIsSending(false);
  };

  /* ⌘N / Ctrl+N → new chat */
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        resetChat();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSettings = () => setSettingsOpen(true);

  return (
    <div className="sero" data-theme="dark">
      <Sidebar
        threadTitle={threadTitle}
        hasThread={view === 'chat' && messages.length > 0}
        openNav={openNav}
        setOpenNav={setOpenNav}
        onNewChat={resetChat}
        onOpenSettings={openSettings}
        provider={provider}
      />

      <main className="main">
        {view === 'home' ? (
          <div className="topbar">
            <div className="sess">
              New session <Icon name="chevDown" size={13} />
            </div>
          </div>
        ) : (
          <div className="topbar chat">
            <span className="ctitle">{threadTitle}</span>
            <ModelSelect
              variant="badge"
              direction="down"
              provider={provider}
              activeModel={activeModel}
              mode={mode}
              setSettings={setSettings}
            />
            <div className="tright">
              <button className="icbtn" type="button" aria-label="Share">
                <Icon name="share" size={15} />
              </button>
              <button className="icbtn" type="button" aria-label="More">
                <Icon name="more" size={15} />
              </button>
            </div>
          </div>
        )}

        {view === 'home' ? (
          <Hero provider={provider} activeModel={activeModel} onPrompt={sendMessage} />
        ) : (
          <div className="thread" ref={threadRef}>
            <div className="inner">
              {messages.map((message) => (
                <Message key={message.id} message={message} />
              ))}
            </div>
          </div>
        )}

        {errorBanner && (
          <div className="banner">
            <Icon name="alert" size={14} />
            <span>{errorBanner}</span>
          </div>
        )}

        {providerNotice && <div className="notice">{providerNotice}</div>}

        <Composer
          draft={draft}
          setDraft={setDraft}
          isSending={isSending}
          onSend={() => sendMessage()}
          onStop={stopSending}
          mode={mode}
          setMode={setMode}
          activeModel={activeModel}
          provider={provider}
          setSettings={setSettings}
        />
      </main>

      <SettingsDrawer
        settings={settings}
        setSettings={setSettings}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
