const DEFAULT_AUDIO_SETTINGS = {
  masterVolume: 80,
  musicVolume: 45,
  sfxVolume: 70,
  voiceVolume: 60,
  musicEnabled: true,
  sfxEnabled: true,
  voiceEnabled: true,
  reducedMotion: false,
  theme: "dark",
  musicTrack: "echoes_of_void",
  onboardingCompleted: false,
};

export const MENU_MUSIC_TRACKS = [
  { id: "echoes_of_void", title: "Echoes of the Void", src: "/assets/audio/menu_echoes_of_void.wav" },
  { id: "steppe_afterglow", title: "Steppe Afterglow", src: "/assets/audio/menu_steppe_afterglow.wav" },
  { id: "celestial_drift", title: "Celestial Drift", src: "/assets/audio/menu_celestial_drift.wav" },
];

const SOUND_LIBRARY = {
  click: [420, 0.045, "square"],
  move: [520, 0.08, "sine"],
  capture: [180, 0.14, "sawtooth"],
  ultimate: [720, 0.22, "triangle"],
  victory: [660, 0.28, "sine"],
  defeat: [130, 0.26, "sawtooth"],
  joined: [880, 0.16, "triangle"],
  invite: [740, 0.12, "sine"],
};

let settings = { ...DEFAULT_AUDIO_SETTINGS };
let audioContext = null;
let musicAudio = null;
let musicTrackId = "";

function getContext() {
  if (!audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return null;
    }
    audioContext = new AudioContext();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => undefined);
  }
  return audioContext;
}

function volume(kind) {
  const master = clamp(settings.masterVolume) / 100;
  const channel = clamp(kind === "music" ? settings.musicVolume : kind === "voice" ? settings.voiceVolume : settings.sfxVolume) / 100;
  return master * channel;
}

function clamp(value) {
  return Math.max(0, Math.min(100, Number(value ?? 0)));
}

function stopMusic() {
  if (!musicAudio) return;
  musicAudio.pause();
  musicAudio.currentTime = 0;
  musicAudio = null;
  musicTrackId = "";
}

function selectedMusicTrack() {
  return MENU_MUSIC_TRACKS.find((track) => track.id === settings.musicTrack) || MENU_MUSIC_TRACKS[0];
}

function applyMusicVolume() {
  if (musicAudio) {
    musicAudio.volume = Math.min(0.72, volume("music") * 0.55);
  }
}

function ensureMusic() {
  if (!settings.musicEnabled || volume("music") <= 0) {
    return;
  }
  const track = selectedMusicTrack();
  if (!musicAudio || musicTrackId !== track.id) {
    stopMusic();
    musicAudio = new Audio(track.src);
    musicAudio.loop = true;
    musicAudio.preload = "auto";
    musicTrackId = track.id;
  }
  applyMusicVolume();
  musicAudio.play().catch(() => undefined);
}

export function configureAudio(nextSettings = {}) {
  settings = { ...DEFAULT_AUDIO_SETTINGS, ...(nextSettings || {}) };
  if (!settings.musicEnabled || volume("music") <= 0) {
    stopMusic();
  } else if (musicAudio && musicTrackId === selectedMusicTrack().id) {
    applyMusicVolume();
  } else {
    stopMusic();
  }
}

export function playSound(name) {
  ensureMusic();
  if (!settings.sfxEnabled || volume("sfx") <= 0) {
    return;
  }
  const context = getContext();
  if (!context) {
    return;
  }
  const [frequency, duration, type] = SOUND_LIBRARY[name] || SOUND_LIBRARY.click;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume("sfx") * 0.12, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration);
}

export function speakLine(text) {
  if (!settings.voiceEnabled || volume("voice") <= 0 || !window.speechSynthesis) {
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.volume = Math.min(1, volume("voice"));
  utterance.rate = 0.92;
  utterance.pitch = 0.85;
  window.speechSynthesis.speak(utterance);
}

export function audioSettingsDefaults() {
  return { ...DEFAULT_AUDIO_SETTINGS };
}
