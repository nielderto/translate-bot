export function observeCaptions(
  container: HTMLElement,
  onChange: (text: string) => void,
): () => void {
  let pending: ReturnType<typeof setTimeout> | null = null;
  let lastEmitted: string | null = null;

  const emit = (): void => {
    pending = null;
    const segs = container.querySelectorAll('.ytp-caption-segment');
    const text = Array.from(segs)
      .map((s) => s.textContent ?? '')
      .join('')
      .trim();
    if (text !== lastEmitted) {
      lastEmitted = text;
      onChange(text);
    }
  };

  const observer = new MutationObserver(() => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(emit, 30);
  });

  observer.observe(container, { childList: true, subtree: true, characterData: true });
  return () => {
    observer.disconnect();
    if (pending) clearTimeout(pending);
  };
}
