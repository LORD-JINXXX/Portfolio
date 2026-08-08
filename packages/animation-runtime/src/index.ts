import type { AnimationConfig, AnimationTrigger } from '@platform/contracts'

export interface AnimationPreset {
  type: string
  label: string
  icon: string
  category: 'Entrance' | 'Hover' | 'Continuous' | 'Text' | 'Mouse' | 'Background' | 'Scroll'
  trigger: AnimationTrigger
  defaultDuration: number
  easing: string
  description: string
  defaultParams?: Record<string, unknown>
}

/**
 * Single production animation registry. Studio exposes this list, validation checks it,
 * and runtime-renderer executes the same names. A preset must not be added here until
 * the runtime implementation exists.
 */
export const ANIMATION_PRESETS: AnimationPreset[] = [
  { type: 'fade', label: 'Fade', icon: '◌', category: 'Entrance', trigger: 'load', defaultDuration: 700, easing: 'ease-out', description: 'Fade into view' },
  { type: 'fade-up', label: 'Fade Up', icon: '↑', category: 'Entrance', trigger: 'scroll', defaultDuration: 800, easing: 'ease-out', description: 'Fade while moving upward' },
  { type: 'fade-down', label: 'Fade Down', icon: '↓', category: 'Entrance', trigger: 'scroll', defaultDuration: 800, easing: 'ease-out', description: 'Fade while moving downward' },
  { type: 'fade-left', label: 'Fade Left', icon: '←', category: 'Entrance', trigger: 'scroll', defaultDuration: 800, easing: 'ease-out', description: 'Fade from the right' },
  { type: 'fade-right', label: 'Fade Right', icon: '→', category: 'Entrance', trigger: 'scroll', defaultDuration: 800, easing: 'ease-out', description: 'Fade from the left' },
  { type: 'zoom-in', label: 'Zoom In', icon: '⊕', category: 'Entrance', trigger: 'scroll', defaultDuration: 700, easing: 'ease-out', description: 'Scale into view' },
  { type: 'blur-in', label: 'Blur In', icon: '◍', category: 'Entrance', trigger: 'scroll', defaultDuration: 850, easing: 'ease-out', description: 'Resolve from blur' },
  { type: 'reveal', label: 'Reveal', icon: '▰', category: 'Entrance', trigger: 'scroll', defaultDuration: 900, easing: 'ease-out', description: 'Clip reveal' },
  { type: 'flip-x', label: 'Flip X', icon: '↕', category: 'Entrance', trigger: 'scroll', defaultDuration: 800, easing: 'ease-out', description: '3D flip on X axis' },
  { type: 'flip-y', label: 'Flip Y', icon: '↔', category: 'Entrance', trigger: 'scroll', defaultDuration: 800, easing: 'ease-out', description: '3D flip on Y axis' },
  { type: 'float', label: 'Float', icon: '≈', category: 'Continuous', trigger: 'continuous', defaultDuration: 3200, easing: 'ease-in-out', description: 'Soft continuous floating' },
  { type: 'spin', label: 'Spin', icon: '↻', category: 'Continuous', trigger: 'continuous', defaultDuration: 6000, easing: 'linear', description: 'Continuous rotation' },
  { type: 'orbit', label: 'Orbit', icon: '◎', category: 'Continuous', trigger: 'continuous', defaultDuration: 9000, easing: 'linear', description: 'Continuous orbital rotation' },
  { type: 'glitch', label: 'Glitch', icon: 'ϟ', category: 'Text', trigger: 'hover', defaultDuration: 500, easing: 'linear', description: 'Short glitch effect' },
  { type: 'typewriter', label: 'Typewriter', icon: '⌨', category: 'Text', trigger: 'load', defaultDuration: 1800, easing: 'linear', description: 'Typewriter reveal' },
  { type: 'tilt-3d', label: '3D Tilt', icon: '◇', category: 'Mouse', trigger: 'hover', defaultDuration: 250, easing: 'ease-out', description: 'Tilt on hover' },
  { type: 'scale-hover', label: 'Scale', icon: '↗', category: 'Hover', trigger: 'hover', defaultDuration: 220, easing: 'ease-out', description: 'Scale slightly on hover' },
  { type: 'aurora', label: 'Aurora', icon: '≋', category: 'Background', trigger: 'continuous', defaultDuration: 12000, easing: 'linear', description: 'Moving gradient background' },
  { type: 'parallax-y', label: 'Parallax Y', icon: '⇅', category: 'Scroll', trigger: 'scroll', defaultDuration: 1000, easing: 'linear', description: 'Vertical parallax movement', defaultParams: { strength: 0.18 } },
  { type: 'parallax-x', label: 'Parallax X', icon: '⇄', category: 'Scroll', trigger: 'scroll', defaultDuration: 1000, easing: 'linear', description: 'Horizontal parallax movement', defaultParams: { strength: 0.18 } },
]

const ENTRANCE_TYPES = new Set(['fade', 'fade-up', 'fade-down', 'fade-left', 'fade-right', 'zoom-in', 'blur-in', 'reveal', 'flip-x', 'flip-y'])
const INTERACTIVE_TYPES = new Set(['glitch', 'tilt-3d', 'scale-hover'])

export function getAllowedAnimationTriggers(type: string): AnimationTrigger[] {
  if (ENTRANCE_TYPES.has(type)) return ['load', 'scroll']
  if (INTERACTIVE_TYPES.has(type)) return ['hover', 'tap']
  const preset = ANIMATION_PRESETS.find((item) => item.type === type)
  return preset ? [preset.trigger] : []
}

export const ANIMATION_CATEGORIES = Array.from(new Set(ANIMATION_PRESETS.map((item) => item.category)))
export const SUPPORTED_RUNTIME_ANIMATIONS = ANIMATION_PRESETS.map((item) => item.type)

export function createAnimationFromPreset(type: string): AnimationConfig | undefined {
  const preset = ANIMATION_PRESETS.find((item) => item.type === type)
  if (!preset) return undefined
  return { type: preset.type, trigger: preset.trigger, duration: preset.defaultDuration, easing: preset.easing, params: preset.defaultParams }
}

export interface ComputedAnimation {
  opacity?: number
  transform?: string
  filter?: string
  clipPath?: string
  background?: string
}

export function computeAnimationState(config: AnimationConfig, progress: number): ComputedAnimation {
  const p = Math.max(0, Math.min(1, progress))
  const eased = ease(p, config.easing || 'ease-out')
  switch (config.type) {
    case 'fade': return { opacity: eased }
    case 'fade-up': return { opacity: eased, transform: `translateY(${(1 - eased) * 48}px)` }
    case 'fade-down': return { opacity: eased, transform: `translateY(${(eased - 1) * 48}px)` }
    case 'fade-left': return { opacity: eased, transform: `translateX(${(1 - eased) * 48}px)` }
    case 'fade-right': return { opacity: eased, transform: `translateX(${(eased - 1) * 48}px)` }
    case 'zoom-in': return { opacity: eased, transform: `scale(${0.86 + eased * 0.14})` }
    case 'blur-in': return { opacity: eased, filter: `blur(${(1 - eased) * 18}px)` }
    case 'reveal': return { clipPath: `inset(0 ${(1 - eased) * 100}% 0 0)` }
    case 'flip-x': return { opacity: eased, transform: `perspective(900px) rotateX(${(1 - eased) * 70}deg)` }
    case 'flip-y': return { opacity: eased, transform: `perspective(900px) rotateY(${(1 - eased) * 70}deg)` }
    case 'float': return { transform: `translateY(${Math.sin(eased * Math.PI * 2) * 10}px)` }
    case 'spin':
    case 'orbit': return { transform: `rotate(${eased * 360}deg)` }
    case 'parallax-y': return { transform: `translateY(${(eased - 0.5) * Number(config.params?.strength ?? 40)}px)` }
    case 'parallax-x': return { transform: `translateX(${(eased - 0.5) * Number(config.params?.strength ?? 40)}px)` }
    case 'aurora': return { background: `linear-gradient(${eased * 360}deg,#7c3aed,#22d3ee,#0ea5e9,#7c3aed)` }
    case 'scale-hover': return { transform: `scale(${1 + eased * 0.035})` }
    case 'tilt-3d': return { transform: `perspective(800px) rotateX(${eased * 3}deg) rotateY(${-eased * 3}deg)` }
    case 'glitch': return { transform: `translate(${Math.sin(eased * 31) * 3}px,${Math.cos(eased * 23) * 2}px)` }
    case 'typewriter': return { opacity: eased }
    default: return { opacity: eased }
  }
}

export function isAnimationSupported(type: string): boolean {
  return SUPPORTED_RUNTIME_ANIMATIONS.includes(type)
}

function ease(value: number, type: string): number {
  switch (type) {
    case 'linear': return value
    case 'ease-in': return value * value
    case 'ease-out': return value * (2 - value)
    case 'ease-in-out': return value < 0.5 ? 2 * value * value : -1 + (4 - 2 * value) * value
    case 'spring': return 1 - Math.cos(value * Math.PI * 3) * Math.exp(-value * 3)
    default: return value * (2 - value)
  }
}
