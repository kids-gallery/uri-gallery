// 효과음 합성(3D미술관_재설계 §2-5). 외부 소리 파일 없이 Web Audio로 만든다 — 저작권 문제가 없고 내려받을 것이 없다.
import type { SoundId } from './subjects';
import { SCORES, type Note } from './music';
import type { ThemeId } from './themes';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) { enabled = on; if(!on)stopAmbience(); }
export function soundEnabled() { return enabled; }

function audio(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
      // 화면을 숨기면 음악과 효과음을 멈춘다. 돌아오면 이어서 난다
      document.addEventListener('visibilitychange', () => { if (document.hidden) void ctx?.suspend(); else if (enabled) void ctx?.resume(); });
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noise(c: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const len = c.sampleRate * 2;
  noiseBuf = c.createBuffer(1, len, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function env(g: GainNode, t0: number, a: number, peak: number, hold: number, r: number) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.setValueAtTime(peak, t0 + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + hold + r);
}

function tone(c: AudioContext, type: OscillatorType, f0: number, f1: number, t0: number, dur: number, peak = 0.3, out?: AudioNode) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  env(g,t0, Math.min(0.02, dur / 4), peak, dur * 0.4, dur * 0.6);
  o.connect(g).connect(out ?? master!);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noiseBurst(c: AudioContext, t0: number, dur: number, filter: BiquadFilterType, f0: number, f1: number, peak = 0.3, q = 1) {
  const s = c.createBufferSource();
  s.buffer = noise(c);
  const f = c.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  const g = c.createGain();
  env(g,t0, Math.min(0.05, dur / 5), peak, dur * 0.3, dur * 0.7);
  s.connect(f).connect(g).connect(master!);
  s.start(t0, Math.random());
  s.stop(t0 + dur + 0.05);
}

/** 으르렁(호랑이 · 사자 · 공룡): 낮은 톱니파 + 잡음, 떨림을 더해 "어흥" */
function roar(c: AudioContext, t: number) {
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 1.1);
  const lfo = c.createOscillator();
  lfo.frequency.value = 22;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 18;
  lfo.connect(lfoGain).connect(o.frequency);
  const shaper = c.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const x = (i / 128) - 1; curve[i] = Math.tanh(x * 3); }
  shaper.curve = curve;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(900, t);
  lp.frequency.exponentialRampToValueAtTime(300, t + 1.2);
  const g = c.createGain();
  env(g,t, 0.08, 0.45, 0.6, 0.6);
  o.connect(shaper).connect(lp).connect(g).connect(master!);
  o.start(t); lfo.start(t);
  o.stop(t + 1.4); lfo.stop(t + 1.4);
  noiseBurst(c, t, 1.2, 'bandpass', 500, 160, 0.35, 1.4);
}

export function play(id: SoundId) {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + 0.01;
  switch (id) {
    case 'roar': roar(c, t); break;
    case 'bark':
      for (const dt of [0, 0.28]) { tone(c, 'square', 520, 300, t + dt, 0.13, 0.18); noiseBurst(c, t + dt, 0.1, 'bandpass', 1200, 700, 0.15, 2); }
      break;
    case 'hop':
      for (const dt of [0, 0.22, 0.44]) tone(c, 'sine', 260, 620, t + dt, 0.14, 0.25);
      break;
    case 'whoosh':
      noiseBurst(c, t, 1.8, 'bandpass', 220, 2600, 0.4, 0.8);
      tone(c, 'sine', 70, 45, t, 1.6, 0.25);
      break;
    case 'flap':
      for (let i = 0; i < 6; i++) noiseBurst(c, t + i * 0.12, 0.07, 'highpass', 1800, 2400, 0.22);
      break;
    case 'float':
      tone(c, 'sine', 520, 700, t, 0.9, 0.18); tone(c, 'sine', 780, 1050, t + 0.1, 0.9, 0.1);
      break;
    case 'vroom':
      {
        const o = c.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(65, t); o.frequency.linearRampToValueAtTime(150, t + 0.6); o.frequency.linearRampToValueAtTime(95, t + 1.4);
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
        const g = c.createGain(); env(g,t, 0.05, 0.3, 0.9, 0.5);
        o.connect(lp).connect(g).connect(master); o.start(t); o.stop(t + 1.6);
      }
      break;
    case 'bubble':
      for (let i = 0; i < 6; i++) { const f = 320 + Math.random() * 300; tone(c, 'sine', f, f * 2.6, t + i * 0.13 + Math.random() * 0.05, 0.09, 0.22); }
      break;
    case 'sparkle':
      [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(c, 'triangle', f, f, t + i * 0.08, 0.25, 0.14));
      break;
    case 'tune':
      [523, 659, 784, 659, 1047].forEach((f, i) => tone(c, 'square', f, f, t + i * 0.16, 0.14, 0.08));
      break;
    case 'tada':
      [523, 659, 784, 1047].forEach((f) => tone(c, 'triangle', f, f, t, 0.7, 0.12));
      break;
  }
}

/** 오디오 가이드(브라우저 음성, 팀 D42와 같은 방식). 다시 부르면 앞 문장을 멈추고 새로 읽는다. */
export function speak(text: string): boolean {
  try {
    const ss = window.speechSynthesis;
    if (!ss) return false;
    ss.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = 0.95;
    const ko = ss.getVoices().find((v) => v.lang.startsWith('ko'));
    if (ko) u.voice = ko;
    ss.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking() { try { window.speechSynthesis?.cancel(); } catch { /* 없음 */ } }

// 모드별 배경 음악(마스터플랜 3-3 #137). 이용자가 들어가기·모드·소리 버튼을 누른 뒤에만 켠다.
const LOOKAHEAD = 1.2, MUSIC_LEVEL = 0.8;
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
/** 음색마다 배음[배수, 세기], 파형, 전체 세기, 올림 초, 내림 초. pluck은 누른 뒤 저절로 사라지는 소리다 */
const VOICES: Record<Note['voice'], { parts: [number, number][]; wave: OscillatorType; level: number; attack: number; release: number; pluck?: boolean; vibrato?: boolean }> = {
  organ: { parts: [[1, 1], [2, 0.5], [3, 0.18]], wave: 'sine', level: 0.15, attack: 0.18, release: 0.5 },
  pad: { parts: [[1, 1], [2, 0.2]], wave: 'sine', level: 0.1, attack: 0.7, release: 0.9 },
  flute: { parts: [[1, 1], [2, 0.12]], wave: 'triangle', level: 0.3, attack: 0.07, release: 0.18, vibrato: true },
  marimba: { parts: [[1, 1], [4, 0.25]], wave: 'sine', level: 0.7, attack: 0.004, release: 0.45, pluck: true },
  bell: { parts: [[1, 1], [3, 0.28], [5.04, 0.1]], wave: 'sine', level: 0.42, attack: 0.003, release: 1.1, pluck: true },
  bass: { parts: [[1, 1]], wave: 'triangle', level: 0.3, attack: 0.008, release: 0.6, pluck: true },
};

/** 음 하나를 합성한다. OfflineAudioContext로도 돌려 소리 크기를 잴 수 있다 */
export function playNote(c: BaseAudioContext, out: AudioNode, n: Note, t0: number, beat: number) {
  const v = VOICES[n.voice], f = hz(n.midi), peak = v.level * n.vel;
  const hold = v.pluck ? 0 : Math.max(0, n.len * beat - v.attack), end = t0 + v.attack + hold + v.release;
  const g = c.createGain();
  g.connect(out);
  env(g, t0, v.attack, peak, hold, v.release);
  const lfo = v.vibrato ? c.createOscillator() : null, depth = lfo ? c.createGain() : null;
  if (lfo && depth) { lfo.frequency.value = 5; depth.gain.value = f * 0.004; lfo.connect(depth); lfo.start(t0); lfo.stop(end); }
  v.parts.forEach(([ratio, level], i) => {
    const o = c.createOscillator(), pg = c.createGain();
    o.type = i === 0 ? v.wave : 'sine';
    o.frequency.value = f * ratio;
    if (depth) depth.connect(o.frequency);
    pg.gain.value = level;
    o.connect(pg).connect(g);
    o.start(t0);
    o.stop(end);
    if (i === 0) o.onended = () => g.disconnect();
  });
}

let music: { timer: ReturnType<typeof setInterval>; nodes: AudioNode[]; bus: GainNode } | null = null;
export function stopAmbience() {
  if (!music) return;
  const { timer, nodes, bus } = music;
  music = null;
  clearInterval(timer);
  if (ctx) bus.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
  setTimeout(() => { for (const n of nodes) { try { n.disconnect(); } catch { /* 이미 끊김 */ } } }, 800);
}
export function setAmbience(theme: ThemeId) {
  stopAmbience();
  const c = audio();
  if (!c || !master) return;
  const score = SCORES[theme], beat = 60 / score.bpm;
  const bus = c.createGain(), delay = c.createDelay(1), feedback = c.createGain();
  bus.gain.value = MUSIC_LEVEL;
  delay.delayTime.value = score.echo.time;
  feedback.gain.value = score.echo.feedback;
  bus.connect(master);
  bus.connect(delay).connect(feedback).connect(delay);
  delay.connect(master);
  let at = c.currentTime + 0.15, i = 0;
  const tick = () => {
    for (;;) {
      const n = score.notes[i]!, when = at + n.at * beat;
      if (when > c.currentTime + LOOKAHEAD) return;
      if (when >= c.currentTime) playNote(c, bus, n, when, beat); // 지난 음은 건너뛴다(탭이 잠시 느려졌을 때)
      if (++i === score.notes.length) { i = 0; at += score.beats * beat; }
    }
  };
  tick();
  music = { timer: setInterval(tick, 300), nodes: [bus, delay, feedback], bus };
}
