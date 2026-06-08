function renderMarkdown(text: string): string {
  const esc = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return esc
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-•] (.+)/gm, '• $1')
    .replace(/\n/g, '<br>');
}

const CSS = `
  @keyframes tb-panel-in {
    from { opacity: 0; transform: translateX(-50%) translateY(8px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .tb-chat-panel {
    position: absolute; left: 50%; bottom: calc(8% + 96px);
    transform: translateX(-50%);
    width: 480px; max-width: 80%;
    background: rgba(10,10,10,0.88);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: #fff;
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; padding: 12px;
    font-family: system-ui, -apple-system, sans-serif; font-size: 14px;
    display: flex; flex-direction: column; gap: 8px;
    pointer-events: auto;
    animation: tb-panel-in 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
  }
  .tb-chat-history { max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
  .tb-chat-turn { padding: 6px 8px; border-radius: 4px; line-height: 1.5; }
  .tb-chat-turn.user { white-space: pre-wrap; }
  .tb-chat-turn.assistant { white-space: normal; }
  .tb-chat-turn.assistant strong { color: #e2c97e; }
  .tb-chat-turn.assistant em { color: #a8d8a8; font-style: italic; }
  .tb-chat-turn.user { background: rgba(255,255,255,0.08); }
  .tb-chat-turn.assistant { background: rgba(255,255,255,0.04); }
  .tb-chat-row { display: flex; gap: 6px; }
  .tb-chat-input { flex: 1; padding: 6px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.4); color: #fff; }
  .tb-chat-send, .tb-chat-close { padding: 6px 10px; border-radius: 4px; border: none; background: rgba(255,255,255,0.15); color: #fff; cursor: pointer; }
  .tb-chat-send:hover, .tb-chat-close:hover { background: rgba(255,255,255,0.25); }
  .tb-chat-header { display: flex; justify-content: flex-end; }
`;

export type TurnRole = 'user' | 'assistant';

export interface ChatPanelHandlers {
  onSend: (text: string) => void;
  onClose: () => void;
}

export interface ChatPanel {
  attach: (shadowRoot: ShadowRoot, handlers: ChatPanelHandlers) => void;
  appendHistory: (turn: { role: TurnRole; content: string }) => HTMLDivElement;
  streamAssistant: (iterable: AsyncIterable<string>) => Promise<void>;
  detach: () => void;
}

export function createChatPanel(): ChatPanel {
  let panel: HTMLDivElement | null = null;
  let history: HTMLDivElement | null = null;
  let input: HTMLInputElement | null = null;

  const panelObj: ChatPanel = {
    attach(shadowRoot: ShadowRoot, { onSend, onClose }: ChatPanelHandlers): void {
      const style = document.createElement('style');
      style.textContent = CSS;

      panel = document.createElement('div');
      panel.className = 'tb-chat-panel';
      // Swallow keyboard and scroll events so YouTube shortcuts/controls don't fire while the panel is open.
      for (const ev of ['keydown', 'keyup', 'keypress'] as const) {
        panel.addEventListener(ev, (e) => e.stopPropagation());
      }
      panel.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });

      const header = document.createElement('div');
      header.className = 'tb-chat-header';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'tb-chat-close';
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', () => onClose());
      header.appendChild(closeBtn);

      history = document.createElement('div');
      history.className = 'tb-chat-history';

      const row = document.createElement('div');
      row.className = 'tb-chat-row';
      input = document.createElement('input');
      input.className = 'tb-chat-input';
      input.placeholder = 'Ask about this line…';
      const sendBtn = document.createElement('button');
      sendBtn.className = 'tb-chat-send';
      sendBtn.textContent = 'Send';

      const send = (): void => {
        if (!input) return;
        const v = input.value.trim();
        if (!v) return;
        input.value = '';
        onSend(v);
      };
      sendBtn.addEventListener('click', send);
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') send();
      });
      row.append(input, sendBtn);

      panel.append(header, history, row);
      shadowRoot.append(style, panel);
      input.focus();
    },

    appendHistory({ role, content }: { role: TurnRole; content: string }): HTMLDivElement {
      const turn = document.createElement('div');
      turn.className = `tb-chat-turn ${role}`;
      turn.textContent = content;
      if (history) {
        history.appendChild(turn);
        history.scrollTop = history.scrollHeight;
      }
      return turn;
    },

    async streamAssistant(iterable: AsyncIterable<string>): Promise<void> {
      const turn = panelObj.appendHistory({ role: 'assistant', content: '' });
      let full = '';
      for await (const chunk of iterable) {
        full += chunk;
        turn.innerHTML = renderMarkdown(full);
        if (history) history.scrollTop = history.scrollHeight;
      }
    },

    detach(): void {
      panel?.remove();
      panel = null;
      history = null;
      input = null;
    },
  };

  return panelObj;
}
