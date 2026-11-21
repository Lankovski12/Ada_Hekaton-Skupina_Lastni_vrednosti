// Zvoki igre, ustvarjeni v brskalniku (Web Audio) – brez zvočnih datotek in licenc.
// Brskalnik dovoli zvok šele po kliku, zato pokličemo unlock() ob gumbu »Poleti«.

const KEY = 'zrak-zvok'

class Sound {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private blowGain: GainNode | null = null
  private rainGain: GainNode | null = null
  private windGain: GainNode | null = null
  private musicTimer: number | undefined
  private noiseBuf: AudioBuffer | null = null
  enabled = true

  constructor() {
    try {
      this.enabled = localStorage.getItem(KEY) !== 'off'
    } catch {
      /* ignoriraj */
    }
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.enabled ? 0.6 : 0
      this.master.connect(this.ctx.destination)
      this.noiseBuf = this.makeNoise()
      this.blowGain = this.loop(900, 0.8)
      this.rainGain = this.loop(3500, 0.4, 'highpass')
      this.windGain = this.loop(400, 1.2)
    }
    void this.ctx.resume()
  }

  setEnabled(on: boolean) {
    this.enabled = on
    try {
      localStorage.setItem(KEY, on ? 'on' : 'off')
    } catch {
      /* ignoriraj */
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? 0.6 : 0, this.ctx.currentTime, 0.05)
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  /** Neprekinjen šum skozi filter (piš, dež, veter); glasnost uravnavamo z vrnjenim GainNode. */
  private loop(freq: number, q: number, type: BiquadFilterType = 'bandpass'): GainNode {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.value = 0
    src.connect(f).connect(g).connect(this.master!)
    src.start()
    return g
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.25, slideTo?: number) {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const t = ctx.currentTime + start
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.connect(g).connect(this.master)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  private whoosh(dur = 0.7, from = 300, to = 2500, vol = 0.5) {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.noiseBuf) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = 1.5
    f.frequency.setValueAtTime(from, t)
    f.frequency.exponentialRampToValueAtTime(to, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.3)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.connect(f).connect(g).connect(this.master)
    src.start(t)
    src.stop(t + dur)
  }

  private set(g: GainNode | null, v: number) {
    if (g && this.ctx) g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.08)
  }

  // --- dogodki ---
  blow(on: boolean) {
    this.set(this.blowGain, on ? 0.35 : 0)
  }
  rain(on: boolean) {
    this.set(this.rainGain, on ? 0.25 : 0)
  }
  wind(on: boolean) {
    this.set(this.windGain, on ? 0.5 : 0)
  }
  boost() {
    this.whoosh(0.8, 250, 3000, 0.6)
    this.tone(523, 0, 0.12, 'triangle', 0.18)
    this.tone(784, 0.08, 0.2, 'triangle', 0.18)
  }
  rainStart() {
    ;[659, 784, 988].forEach((f, i) => this.tone(f, i * 0.07, 0.25, 'sine', 0.2))
  }
  smoke() {
    this.tone(220, 0, 0.35, 'sawtooth', 0.12, 110)
    this.tone(160, 0.12, 0.35, 'square', 0.08, 90)
  }
  pop() {
    this.tone(880, 0, 0.12, 'sine', 0.25, 1320)
  }
  question() {
    ;[523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.08, 0.2, 'triangle', 0.2))
  }
  correct() {
    ;[523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, i * 0.07, 0.3, 'triangle', 0.22))
  }
  wrong() {
    this.tone(392, 0, 0.25, 'triangle', 0.2)
    this.tone(330, 0.18, 0.35, 'triangle', 0.2)
  }
  tick(urgent: boolean) {
    this.tone(urgent ? 1200 : 900, 0, 0.06, 'square', 0.08)
  }
  end(good: boolean) {
    const notes = good ? [523, 659, 784, 1047, 784, 1047] : [523, 494, 440, 392]
    notes.forEach((f, i) => this.tone(f, i * 0.14, 0.3, 'triangle', 0.22))
  }

  /** Nežna glasba v ozadju: pentatonski arpeggio, ki se ponavlja. */
  music(on: boolean) {
    window.clearInterval(this.musicTimer)
    if (!on) return
    const scale = [392, 440, 523, 587, 659, 784, 880]
    let step = 0
    this.musicTimer = window.setInterval(() => {
      const base = [0, 2, 4, 2, 1, 3, 5, 3][step % 8]!
      this.tone(scale[base]!, 0, 0.35, 'sine', 0.05)
      if (step % 4 === 0) this.tone(scale[base]! / 2, 0, 0.6, 'triangle', 0.04)
      step++
    }, 280)
  }

  stopAll() {
    this.music(false)
    this.blow(false)
    this.rain(false)
    this.wind(false)
  }
}

export const sound = new Sound()
