import { useCallback, useRef } from 'react'
import type { SoundEvent } from './useChessGame'

/**
 * 使用 Web Audio API 生成无需外部资源的落子、吃子、将军和终局音效。
 *
 * @param enabled 是否允许播放声音。
 * @returns 音效播放函数。
 */
export function useSound(enabled: boolean) {
  const contextRef = useRef<AudioContext | null>(null)

  return useCallback(
    (event: SoundEvent) => {
      if (!enabled) return
      try {
        const AudioContextClass = window.AudioContext ?? window.webkitAudioContext
        if (!AudioContextClass) return
        const context = contextRef.current ?? new AudioContextClass()
        contextRef.current = context
        if (context.state === 'suspended') void context.resume()

        const patterns: Record<SoundEvent, Array<{ frequency: number; delay: number; duration: number }>> = {
          move: [{ frequency: 180, delay: 0, duration: 0.07 }],
          capture: [
            { frequency: 150, delay: 0, duration: 0.06 },
            { frequency: 105, delay: 0.055, duration: 0.09 },
          ],
          check: [
            { frequency: 520, delay: 0, duration: 0.07 },
            { frequency: 680, delay: 0.075, duration: 0.1 },
          ],
          finish: [
            { frequency: 392, delay: 0, duration: 0.12 },
            { frequency: 523, delay: 0.12, duration: 0.12 },
            { frequency: 659, delay: 0.24, duration: 0.24 },
          ],
        }

        for (const tone of patterns[event]) {
          const oscillator = context.createOscillator()
          const gain = context.createGain()
          oscillator.type = event === 'move' ? 'triangle' : 'sine'
          oscillator.frequency.setValueAtTime(tone.frequency, context.currentTime + tone.delay)
          gain.gain.setValueAtTime(0.0001, context.currentTime + tone.delay)
          gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + tone.delay + 0.008)
          gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + tone.delay + tone.duration)
          oscillator.connect(gain)
          gain.connect(context.destination)
          oscillator.start(context.currentTime + tone.delay)
          oscillator.stop(context.currentTime + tone.delay + tone.duration + 0.02)
        }
      } catch {
        // 音频是增强体验，浏览器策略拒绝时静默降级。
      }
    },
    [enabled],
  )
}
