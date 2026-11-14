// Spoken lines through the browser's own speech voices (nothing downloaded): villains taunting you, the
// radio DJs, heroes calling out their ultimate. Every line also shows as a caption, so it works with the
// sound off or when this browser has no voices. Turn the voices off in Settings ▸ Spoken lines.
import { G } from '../core/game.js';
import { clamp } from '../core/util.js';

// who sounds like what: preferred voice names (the first one this computer has wins), pitch and speed
const CAST = {
  kurozan: { voice: ['Ralph', 'Fred', 'Daniel', 'Alex'], pitch: 0.2, rate: 0.82, color: '#ff6a3c' },
  vektor: { voice: ['Zarvox', 'Trinoids', 'Fred', 'Alex'], pitch: 0.7, rate: 1.05, color: '#ff2a4f' },
  shade: { voice: ['Whisper', 'Moira', 'Tessa', 'Samantha'], pitch: 0.9, rate: 0.85, color: '#b48cff' },
  crew: { voice: ['Trinoids', 'Zarvox', 'Fred'], pitch: 0.5, rate: 1.1, color: '#ff8a3c' },
  hero: { voice: ['Daniel', 'Alex', 'Samantha'], pitch: 1, rate: 1.15, color: '#ffd34d' },
};

export class Voice {
  constructor() {
    this.ok = typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
    this.voices = []; this.capT = 0; this.el = null;
    if (this.ok) { const load = () => { try { this.voices = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang)); } catch { this.voices = []; } }; load(); speechSynthesis.addEventListener?.('voiceschanged', load); }
  }
  pick(names) {
    if (!this.voices.length) return null;
    for (const n of names || []) { const v = this.voices.find((x) => x.name.startsWith(n)); if (v) return v; }
    return this.voices.find((x) => x.localService) || this.voices[0];
  }
  // who: a CAST key or a display name; o: { voice, pitch, rate, color, name, quiet (do not cut off a line already playing), noCaption }
  say(who, text, o = {}) {
    const c = CAST[who] || {}, name = o.name || (CAST[who] ? null : who);
    if (!o.noCaption) this.caption(name, text, o.color || c.color);
    this.last = { who, text };
    if (!this.ok || !G.settings.voices || !(G.settings.volume > 0)) return;
    try {
      if (o.quiet && speechSynthesis.speaking) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text), v = this.pick(o.voice || c.voice);
      if (v) u.voice = v;
      u.pitch = o.pitch ?? c.pitch ?? 1; u.rate = o.rate ?? c.rate ?? 1; u.volume = clamp(G.settings.volume * 1.2, 0, 1);
      speechSynthesis.speak(u);
    } catch { /* speech not available here */ }
  }
  // a hero calls out their ultimate by name
  shout(H, slot) {
    if (!H || slot !== 'ult') return;
    const m = (H.moves || []).find((x) => x[0].startsWith('R ')); if (!m) return;
    this.say('hero', m[0].slice(2) + '!', { quiet: true, noCaption: true });
  }
  caption(name, text, color) {
    if (!this.el) { this.el = document.createElement('div'); this.el.id = 'caption'; document.body.appendChild(this.el); }
    this.el.innerHTML = ''; if (name) { const b = document.createElement('b'); b.textContent = name; if (color) b.style.color = color; this.el.append(b, ' '); }
    this.el.append(`“${text}”`); this.el.classList.add('on'); this.capT = clamp(1.6 + text.length * 0.06, 2.5, 6);
  }
  update(dt) { if (this.capT > 0) { this.capT -= dt; if (this.capT <= 0 && this.el) this.el.classList.remove('on'); } }
}
