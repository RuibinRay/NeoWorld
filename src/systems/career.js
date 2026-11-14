// Optional career progression. Rank in each line of work comes from how many jobs you have
// completed; every rank adds 10% pay in that line.
import { G } from '../core/game.js';

const TRACKS = {
  pilot: { name: 'pilot', stats: ['fares', 'cargo'] },
  courier: { name: 'courier', stats: ['deliveries', 'droneDrops'] },
  kitchen: { name: 'line cook', stats: ['shifts'] },
  mechanic: { name: 'technician', stats: ['repairs'] },
  racer: { name: 'racer', stats: ['races', 'gp', 'slalom'] },
};
const STEPS = [0, 3, 8, 16, 30], TITLES = ['Trainee', 'Licensed', 'Senior', 'Expert', 'Master'];

export const Career = {
  count(track) { return TRACKS[track].stats.reduce((a, k) => a + (G.state.stats[k] || 0), 0); },
  rank(track) { const c = this.count(track); let r = 0; for (let i = 0; i < STEPS.length; i++) if (c >= STEPS[i]) r = i; return r; },
  mult(track) { return 1 + 0.1 * this.rank(track); },
  title(track) { return `${TITLES[this.rank(track)]} ${TRACKS[track].name}`; },
  // Count a finished job; announces a promotion when a threshold is crossed.
  add(track, stat, n = 1) {
    const before = this.rank(track); G.state.stats[stat] = (G.state.stats[stat] || 0) + n;
    const after = this.rank(track);
    if (after > before) { G.ui.flash(`PROMOTED: ${this.title(track).toUpperCase()}`, 3); G.ui.toast(`You are now a ${this.title(track)}. Pay in this line of work: +${after * 10}%.`, 'good'); }
  },
  summary() { return Object.keys(TRACKS).map((t) => `${this.title(t)} (${this.count(t)})`).join(' · '); },
};
