// Higgsfield API helper for making the game's artwork (run with Node, not part of the game).
// The key never lives in this folder: it is read from two environment variables you set yourself,
//   HF_API_KEY_ID      the key ID from https://console.higgsfield.ai
//   HF_API_KEY_SECRET  its secret
// On Windows, `setx` saves them for your user; this script also reads them from there, so a
// terminal opened before you set them still works.
//
//   node tools/higgsfield.mjs check                         is the key accepted? (free: asks about a request that does not exist)
//   node tools/higgsfield.mjs image "<prompt>" out.jpg      one Soul picture, saved to out.jpg (spends Higgsfield credits)
//   node tools/higgsfield.mjs video <image-url> "<prompt>" out.mp4 [6|10]
//                                                           a still brought to life (Hailuo 2.3 image-to-video, 768p,
//                                                           6 or 10 s); the image must be at a public URL (spends credits)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const BASE = 'https://api.higgsfield.ai';

function fromWindowsUser(name) {
  if (process.platform !== 'win32') return '';
  try { return execFileSync('powershell.exe', ['-NoProfile', '-Command', `[Environment]::GetEnvironmentVariable('${name}','User')`], { encoding: 'utf8' }).trim(); } catch { return ''; }
}
function creds() {
  const id = process.env.HF_API_KEY_ID || fromWindowsUser('HF_API_KEY_ID');
  const secret = process.env.HF_API_KEY_SECRET || fromWindowsUser('HF_API_KEY_SECRET');
  if (!id || !secret) {
    console.error(`Missing ${!id ? 'HF_API_KEY_ID' : ''}${!id && !secret ? ' and ' : ''}${!secret ? 'HF_API_KEY_SECRET' : ''}. Set them with setx (see the top of this file).`);
    process.exit(2);
  }
  return { Authorization: `Key ${id}:${secret}`, 'Content-Type': 'application/json' };
}

async function check() {
  const res = await fetch(`${BASE}/requests/${randomUUID()}/status`, { headers: creds() });
  if (res.status === 401 || res.status === 403) { console.log(`REJECTED (${res.status}): Higgsfield did not accept the key ID and secret.`); process.exit(1); }
  console.log(`CONNECTED: the key was accepted (a made-up request came back ${res.status}, as expected).`);
}

async function image(prompt, out) {
  if (!prompt || !out) { console.error('Usage: node tools/higgsfield.mjs image "<prompt>" out.jpg'); process.exit(2); }
  const h = creds();
  const sub = await fetch(`${BASE}/higgsfield-ai/soul/v2/standard`, { method: 'POST', headers: h, body: JSON.stringify({ prompt }) });
  const job = await sub.json().catch(() => ({}));
  if (!sub.ok || !job.request_id) { console.error(`Submit failed (${sub.status}):`, JSON.stringify(job)); process.exit(1); }
  console.log(`Queued ${job.request_id}`);
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const st = await (await fetch(`${BASE}/requests/${job.request_id}/status`, { headers: h })).json();
    if (st.status === 'completed') {
      const url = st.images && st.images[0] && st.images[0].url; if (!url) { console.error('Completed with no image:', JSON.stringify(st)); process.exit(1); }
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      // name the file by what it really is (Soul returns PNG): out.jpg becomes out.png if needed
      const ext = buf[0] === 0x89 && buf[1] === 0x50 ? '.png' : buf[0] === 0xff && buf[1] === 0xd8 ? '.jpg' : buf.slice(8, 12).toString() === 'WEBP' ? '.webp' : '';
      const file = ext && !out.toLowerCase().endsWith(ext) ? out.replace(/\.[a-z0-9]+$/i, '') + ext : out;
      fs.writeFileSync(file, buf);
      console.log(`Saved ${file}`); return;
    }
    if (['failed', 'nsfw', 'canceled'].includes(st.status)) { console.error(`Ended: ${st.status}`); process.exit(1); }
  }
  console.error('Still not done after 6 minutes; check the Higgsfield console.'); process.exit(1);
}

async function video(imageUrl, prompt, out, duration = 6) {
  if (!imageUrl || !prompt || !out) { console.error('Usage: node tools/higgsfield.mjs video <image-url> "<prompt>" out.mp4 [6|10]'); process.exit(2); }
  const h = { ...creds(), 'Idempotency-Key': randomUUID() };
  const sub = await fetch(`${BASE}/minimax/hailuo-2.3/standard/image-to-video`, { method: 'POST', headers: h, body: JSON.stringify({ image_url: imageUrl, prompt, duration: +duration === 10 ? 10 : 6 }) });
  const job = await sub.json().catch(() => ({}));
  if (!sub.ok || !job.request_id) { console.error(`Submit failed (${sub.status}):`, JSON.stringify(job)); process.exit(1); }
  console.log(`Queued ${job.request_id}`);
  // poll: 2 s at first, growing to 10 s (video takes a few minutes)
  for (let wait = 2000, t = 0; t < 900000; t += wait, wait = Math.min(10000, wait * 1.5)) {
    await new Promise((r) => setTimeout(r, wait + Math.random() * 500));
    const st = await (await fetch(`${BASE}/requests/${job.request_id}/status`, { headers: creds() })).json();
    if (st.status === 'completed') {
      const url = st.video && st.video.url; if (!url) { console.error('Completed with no video:', JSON.stringify(st)); process.exit(1); }
      fs.writeFileSync(out, Buffer.from(await (await fetch(url)).arrayBuffer())); console.log(`Saved ${out}`); return;
    }
    if (['failed', 'nsfw', 'canceled'].includes(st.status)) { console.error(`Ended: ${st.status}`, JSON.stringify(st)); process.exit(1); }
  }
  console.error('Still not done after 15 minutes; check the Higgsfield console.'); process.exit(1);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'check') await check();
else if (cmd === 'image') await image(args[0], args[1]);
else if (cmd === 'video') await video(args[0], args[1], args[2], args[3]);
else console.log('Commands: check | image "<prompt>" out.jpg | video <image-url> "<prompt>" out.mp4 [6|10]');
