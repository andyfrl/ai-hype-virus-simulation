import './styles/modal.css';
import mtugaQuotes from './data/quotes/mtuga.json';
import melonTuskQuotes from './data/quotes/melon_tusk.json';
import samusAltmanQuotes from './data/quotes/samus_altman.json';

interface CrewConfig {
  image: string;
  alt: string;
  quotes: string[];
}

const CREW_CONFIGS: Record<string, CrewConfig> = {
  mtuga:        { image: '/mtuga.jpeg',        alt: 'MtUGA',        quotes: mtugaQuotes },
  melon_tusk:   { image: '/melon_tusk.jpeg',   alt: 'Melon Tusk',   quotes: melonTuskQuotes },
  samus_altman: { image: '/samus_altman.jpeg', alt: 'Samus Altman', quotes: samusAltmanQuotes },
};

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

export function showCrewModal(crewId: string, onHire: () => void): void {
  const config = CREW_CONFIGS[crewId];
  if (!config) return;

  const overlay   = document.getElementById('crew-modal-overlay')!;
  const img       = document.getElementById('crew-modal-img') as HTMLImageElement;
  const chat      = document.getElementById('crew-chat')!;
  const btnHire   = document.getElementById('crew-btn-hire')!;
  const btnCancel = document.getElementById('crew-btn-cancel')!;

  img.src = config.image;
  img.alt = config.alt;

  const remaining = new Set<string>(config.quotes);
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
