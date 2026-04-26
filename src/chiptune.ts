let audioCtx: AudioContext | null = null

function ctx(): AudioContext | null {
  try {
    if (!audioCtx) {
      audioCtx = new AudioContext()
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume()
    }
    return audioCtx
  } catch {
    return null
  }
}

function beep(ac: AudioContext, hz: number, start: number, dur: number, vol = 0.05) {
  try {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(hz, start)
    gain.gain.setValueAtTime(vol, start)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.start(start)
    osc.stop(start + dur + 0.01)
  } catch {
    // audio not available
  }
}

/** Three ascending notes — NES "item get" feel */
export function playItemGet() {
  const ac = ctx()
  if (!ac) return
  const t = ac.currentTime
  beep(ac, 523, t, 0.08)         // C5
  beep(ac, 659, t + 0.08, 0.08)  // E5
  beep(ac, 784, t + 0.16, 0.14)  // G5
}

/** Single soft blip — added to wishlist */
export function playWanted() {
  const ac = ctx()
  if (!ac) return
  const t = ac.currentTime
  beep(ac, 440, t, 0.06, 0.04)   // A4
  beep(ac, 587, t + 0.06, 0.08, 0.04) // D5
}

/** Descending two-note blip — removed/unmarked */
export function playUnmark() {
  const ac = ctx()
  if (!ac) return
  const t = ac.currentTime
  beep(ac, 392, t, 0.05, 0.04)        // G4
  beep(ac, 262, t + 0.05, 0.07, 0.03) // C4
}
