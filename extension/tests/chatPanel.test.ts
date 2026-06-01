import { describe, it, expect, vi } from 'vitest';
import { createChatPanel } from '../src/content/chatPanel';

function makeHost(): ShadowRoot {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host.attachShadow({ mode: 'open' });
}

describe('chatPanel', () => {
  it('renders an input and send button, fires onSend with text', () => {
    const root = makeHost();
    const onSend = vi.fn();
    const panel = createChatPanel();
    panel.attach(root, { onSend, onClose: () => {} });

    const input = root.querySelector('.tb-chat-input') as HTMLInputElement;
    const btn = root.querySelector('.tb-chat-send') as HTMLButtonElement;
    input.value = 'why 把?';
    btn.click();
    expect(onSend).toHaveBeenCalledWith('why 把?');
    expect(input.value).toBe('');
    panel.detach();
  });

  it('renders user and assistant turns via appendHistory', () => {
    const root = makeHost();
    const panel = createChatPanel();
    panel.attach(root, { onSend: () => {}, onClose: () => {} });
    panel.appendHistory({ role: 'user', content: 'q?' });
    panel.appendHistory({ role: 'assistant', content: 'a.' });
    const turns = root.querySelectorAll('.tb-chat-turn');
    expect(turns).toHaveLength(2);
    expect(turns[0]?.textContent).toContain('q?');
    expect(turns[1]?.textContent).toContain('a.');
    panel.detach();
  });

  it('streamAssistant accumulates chunks into one assistant turn', async () => {
    const root = makeHost();
    const panel = createChatPanel();
    panel.attach(root, { onSend: () => {}, onClose: () => {} });
    async function* gen(): AsyncGenerator<string> {
      yield 'Hel';
      yield 'lo.';
    }
    await panel.streamAssistant(gen());
    const turns = root.querySelectorAll('.tb-chat-turn.assistant');
    expect(turns).toHaveLength(1);
    expect(turns[0]?.textContent).toContain('Hello.');
    panel.detach();
  });
});
