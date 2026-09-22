// Small original, deterministic PCM cues. No external audio dependency.
import fs from 'node:fs';
const dir = new URL('../assets/resources/audio/', import.meta.url);
fs.mkdirSync(dir, { recursive: true });
const rate = 22050;
function cue(name, notes, duration, volume = 0.24) {
  const count = Math.ceil(rate * duration), out = Buffer.alloc(44 + count * 2);
  out.write('RIFF'); out.writeUInt32LE(36 + count * 2, 4); out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
  out.writeUInt32LE(rate, 24); out.writeUInt32LE(rate * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34);
  out.write('data', 36); out.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) {
    const t = i / rate; let value = 0;
    for (const [frequency, start, length] of notes) {
      const local = t - start;
      if (local < 0 || local > length) continue;
      const envelope = Math.min(1, local / 0.008) * Math.pow(1 - local / length, 2);
      value += Math.sin(local * frequency * Math.PI * 2) * envelope;
    }
    out.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(value * volume * 32767))), 44 + i * 2);
  }
  fs.writeFileSync(new URL(name + '.wav', dir), out);
}
cue('pluck', [[620, 0, 0.1], [930, 0.035, 0.12]], 0.17);
cue('scoop', [[440, 0, 0.16], [660, 0.07, 0.18], [880, 0.13, 0.2]], 0.34);
cue('merge', [[523, 0, 0.25], [659, 0.1, 0.25], [784, 0.2, 0.3], [1047, 0.3, 0.3]], 0.65);
cue('hit', [[160, 0, 0.08]], 0.09, 0.1);
cue('wave', [[220, 0, 0.3], [330, 0.1, 0.35], [440, 0.2, 0.4]], 0.65);
cue('lose', [[330, 0, 0.4], [294, 0.25, 0.4], [220, 0.5, 0.5]], 1.1);
