import './styles/modal.css';

let allQuotes: string[] = [];

fetch('/mtuga_quotes.txt')
  .then(r => r.text())
  .then(text => {
    allQuotes = text.split(/\n\n+/).map(q => q.trim()).filter(Boolean);
  })
  .catch(console.error);

function nextQuote(remaining: Set<string>): string | null {
  if (remaining.size === 0) return null;
  const pool = [...remaining];
  const pick = pool[Math.floor(Math.random() * pool.length)];
  remaining.delete(pick);
  return pick;
}

function makeSpeechBubble(text: string): HTMLElement {
  const bubble = document.createElement('div');
  bubble.className = 'speech-bubble';
  const p = document.createElement('p');
  p.className = 'bubble-text';
  p.textContent = text;
  bubble.appendChild(p);
  return bubble;
}

function makeTypingBubble(): HTMLElement {
  const bubble = document.createElement('div');
  bubble.className = 'typing-bubble';
  bubble.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
  return bubble;
}

export function showMtugaModal(onHire: () => void): void {
  const overlay    = document.getElementById('mtuga-modal-overlay')!;
  const chat       = document.getElementById('mtuga-chat')!;
  const btnHire    = document.getElementById('mtuga-btn-hire')!;
  const btnCancel  = document.getElementById('mtuga-btn-cancel')!;

  const remaining = new Set<string>(allQuotes);
  let timer: ReturnType<typeof setTimeout> | null = null;

  function scheduleNext(): void {
    const typing = makeTypingBubble();
    chat.appendChild(typing);
    chat.scrollTop = chat.scrollHeight;

    timer = setTimeout(() => {
      typing.remove();
      const quote = nextQuote(remaining);
      if (!quote) return;
      chat.appendChild(makeSpeechBubble(quote));
      chat.scrollTop = chat.scrollHeight;
      scheduleNext();
    }, 10000);
  }

  chat.innerHTML = '';
  const first = nextQuote(remaining);
  if (first) chat.appendChild(makeSpeechBubble(first));
  scheduleNext();
  overlay.classList.add('visible');

  const close = () => {
    if (timer) clearTimeout(timer);
    overlay.classList.remove('visible');
  };

  btnHire.onclick   = () => { close(); onHire(); };
  btnCancel.onclick = close;
  overlay.onclick   = (e) => { if (e.target === overlay) close(); };
}
