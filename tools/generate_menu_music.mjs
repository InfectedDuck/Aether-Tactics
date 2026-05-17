import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sampleRate = 22050;
const tau = Math.PI * 2;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "frontend", "public", "assets", "audio");
fs.mkdirSync(out, { recursive: true });

const semitones = { C: -9, "C#": -8, D: -7, "D#": -6, E: -5, F: -4, "F#": -3, G: -2, "G#": -1, A: 0, "A#": 1, B: 2 };

function freq(name) {
  const pitch = name.slice(0, -1);
  const octave = Number(name.at(-1));
  return 440 * (2 ** ((semitones[pitch] + (octave - 4) * 12) / 12));
}

function env(t, start, duration, attack = 0.08, release = 0.35) {
  const local = t - start;
  if (local < 0 || local > duration) return 0;
  if (local < attack) return local / Math.max(attack, 0.001);
  if (local > duration - release) return Math.max(0, (duration - local) / Math.max(release, 0.001));
  return 1;
}

function softSine(f, t) {
  return Math.sin(tau * f * t) + 0.35 * Math.sin(tau * f * 2 * t + 0.4) + 0.12 * Math.sin(tau * f * 3 * t + 1.2);
}

function pluck(f, t, start, duration) {
  const local = t - start;
  if (local < 0 || local > duration) return 0;
  const envelope = Math.exp(-local * 5.4) * Math.min(1, local / 0.012);
  return envelope * (Math.sin(tau * f * t) + 0.45 * Math.sin(tau * f * 2.01 * t) + 0.22 * Math.sin(tau * f * 3.02 * t));
}

function writeWav(filename, samples) {
  const channels = 1;
  const bytesPerSample = 2;
  const dataSize = samples.length * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  let offset = 44;
  for (const sample of samples) {
    const left = Math.round(Math.max(-1, Math.min(1, sample)) * 32767);
    buffer.writeInt16LE(left, offset);
    offset += 2;
  }
  fs.writeFileSync(path.join(out, filename), buffer);
}

function renderTrack(filename, chords, melody, bass, tempo, bars, padGain, pluckGain, bassGain) {
  const secondsPerBeat = 60 / tempo;
  const duration = bars * 4 * secondsPerBeat;
  const total = Math.floor(duration * sampleRate);
  const samples = new Array(total).fill(0);
  const chordSpan = duration / chords.length;
  for (let i = 0; i < total; i += 1) {
    const t = i / sampleRate;
    const chordIndex = Math.min(chords.length - 1, Math.floor(t / chordSpan));
    const chordStart = chordIndex * chordSpan;
    const chord = chords[chordIndex];
    const padEnv = env(t, chordStart, chordSpan + 0.08, 1.4, 1.8);
    const pulse = 0.78 + 0.22 * Math.sin(tau * (1 / (secondsPerBeat * 8)) * t);
    let value = 0;
    for (const note of chord) value += (padGain * padEnv * pulse * softSine(freq(note), t)) / chord.length;
    for (const [startBeat, note] of melody) value += pluckGain * pluck(freq(note), t, startBeat * secondsPerBeat, secondsPerBeat * 2.2);
    for (const [startBeat, note] of bass) value += bassGain * env(t, startBeat * secondsPerBeat, secondsPerBeat * 1.65, 0.05, 0.42) * Math.sin(tau * freq(note) * t);
    value += 0.012 * Math.sin(tau * 0.07 * t) * Math.sin(tau * 220 * t);
    const fade = Math.max(0, Math.min(1, i / (sampleRate * 1.4), (total - i) / (sampleRate * 1.4)));
    samples[i] = value * fade;
  }
  const delay = Math.floor(0.38 * sampleRate);
  const delayed = samples.slice();
  for (let i = delay; i < total; i += 1) delayed[i] += samples[i - delay] * 0.18;
  let peak = 0.01;
  for (const sample of delayed) peak = Math.max(peak, Math.abs(sample));
  writeWav(filename, delayed.map((sample) => sample * (0.74 / peak)));
}

renderTrack("menu_echoes_of_void.wav", [["D3", "A3", "C4", "F4"], ["A2", "E3", "G3", "C4"], ["A#2", "F3", "A3", "D4"], ["C3", "G3", "A#3", "E4"]], [[0, "A4"], [2.5, "C5"], [5, "F4"], [7.5, "E4"], [10, "G4"], [13, "A4"], [18, "C5"], [22, "D5"], [26, "A4"], [29, "G4"], [34, "F4"], [38, "E4"], [45, "A4"], [50, "C5"], [56, "G4"]], [[0, "D2"], [8, "A1"], [16, "A#1"], [24, "C2"], [32, "D2"], [40, "A1"], [48, "A#1"], [56, "C2"]], 76, 16, 0.22, 0.13, 0.11);
renderTrack("menu_steppe_afterglow.wav", [["E3", "B3", "D4", "G4"], ["G3", "D4", "F4", "A4"], ["D3", "A3", "C4", "F4"], ["A2", "E3", "G3", "B3"]], [[0, "B4"], [3, "D5"], [6, "G4"], [9, "A4"], [12, "F4"], [16, "E4"], [21, "G4"], [25, "B4"], [32, "D5"], [36, "B4"], [42, "A4"], [48, "G4"], [53, "F4"], [58, "E4"]], [[0, "E2"], [8, "G2"], [16, "D2"], [24, "A1"], [32, "E2"], [40, "G2"], [48, "D2"], [56, "A1"]], 82, 16, 0.19, 0.12, 0.1);
renderTrack("menu_celestial_drift.wav", [["C3", "G3", "B3", "E4"], ["F3", "C4", "E4", "A4"], ["D3", "A3", "C4", "G4"], ["G2", "D3", "F3", "B3"]], [[0, "E5"], [4, "B4"], [7, "G4"], [12, "A4"], [15, "C5"], [20, "B4"], [24, "E5"], [30, "D5"], [34, "C5"], [40, "A4"], [46, "B4"], [51, "G4"], [56, "E4"]], [[0, "C2"], [8, "F2"], [16, "D2"], [24, "G1"], [32, "C2"], [40, "F2"], [48, "D2"], [56, "G1"]], 72, 16, 0.21, 0.1, 0.09);

console.log("Generated 3 menu music loops in frontend/public/assets/audio");
