// 효과음 합성(3D미술관_재설계 §2-5). 외부 소리 파일 없이 Web Audio로 만든다 — 저작권 문제가 없고 내려받을 것이 없다.
import type { SoundId } from './subjects';

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

// 이용자가 들어가기·모드·소리 버튼을 누른 뒤에만 켠다.
let ambienceNodes:OscillatorNode[]=[];
export function stopAmbience(){for(const n of ambienceNodes){try{n.stop();n.disconnect();}catch{ /* 이미 끝남 */ }}ambienceNodes=[];}
export function setAmbience(theme:'classic'|'block'|'forest'|'toy'){
 stopAmbience();const c=audio();if(!c||!master)return;
 const notes={classic:[130.81,196,261.63],block:[146.83,220,293.66],forest:[174.61,261.63,349.23],toy:[196,293.66,392]}[theme];
 for(const f of notes){const o=c.createOscillator(),g=c.createGain();o.type=theme==='block'?'triangle':'sine';o.frequency.value=f;g.gain.value=.012;o.connect(g).connect(master);o.onended=()=>g.disconnect();o.start();ambienceNodes.push(o);}
}
