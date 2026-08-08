import React, { createContext, useContext, useLayoutEffect, useRef, useState } from 'react'

export type AppThemeName =
  | 'codex-black'
  | 'github-dark'
  | 'github-light'
  | 'vscode-dark'
  | 'vscode-light'
  | 'midnight'

export interface AppTheme {
  name: AppThemeName
  label: string
  dark: boolean
  colors: {
    background: string
    surface: string
    surfaceAlt: string
    border: string
    borderHover: string
    text: string
    textMuted: string
    textSecondary: string
    primary: string
    primaryHover: string
    primaryText: string
    danger: string
    dangerHover: string
    warning: string
    success: string
    accent: string
    accentHover: string
    workspace: string
    shadow: string
  }
}

export const APP_THEMES: Record<AppThemeName, AppTheme> = {
  'codex-black': {
    name: 'codex-black',
    label: 'Codex Black',
    dark: true,
    colors: {
      background: '#010101',
      surface: '#0d0d0f',
      surfaceAlt: '#121214',
      border: '#27272d',
      borderHover: '#3a3a42',
      text: '#f2f2f3',
      textMuted: '#92929d',
      textSecondary: '#b8b8c2',
      primary: '#2563eb',
      primaryHover: '#1d4ed8',
      primaryText: '#ffffff',
      danger: '#ef4444',
      dangerHover: '#dc2626',
      warning: '#f59e0b',
      success: '#10b981',
      accent: '#8b5cf6',
      accentHover: '#7c3aed',
      workspace: '#09090b',
      shadow: 'rgba(0, 0, 0, 0.55)',
    },
  },
  'github-dark': {
    name: 'github-dark',
    label: 'GitHub Dark',
    dark: true,
    colors: {
      background: '#0d1117',
      surface: '#161b22',
      surfaceAlt: '#1f2630',
      border: '#30363d',
      borderHover: '#484f58',
      text: '#f0f6fc',
      textMuted: '#8b949e',
      textSecondary: '#b1bac4',
      primary: '#1f6feb',
      primaryHover: '#388bfd',
      primaryText: '#ffffff',
      danger: '#f85149',
      dangerHover: '#ff7b72',
      warning: '#d29922',
      success: '#3fb950',
      accent: '#a371f7',
      accentHover: '#bc8cff',
      workspace: '#010409',
      shadow: 'rgba(1, 4, 9, 0.58)',
    },
  },
  'github-light': {
    name: 'github-light',
    label: 'GitHub Light',
    dark: false,
    colors: {
      background: '#ffffff',
      surface: '#f6f8fa',
      surfaceAlt: '#eef1f4',
      border: '#d0d7de',
      borderHover: '#afb8c1',
      text: '#1f2328',
      textMuted: '#656d76',
      textSecondary: '#57606a',
      primary: '#0969da',
      primaryHover: '#0550ae',
      primaryText: '#ffffff',
      danger: '#cf222e',
      dangerHover: '#a40e26',
      warning: '#9a6700',
      success: '#1a7f37',
      accent: '#8250df',
      accentHover: '#6639ba',
      workspace: '#f0f2f5',
      shadow: 'rgba(31, 35, 40, 0.14)',
    },
  },
  'vscode-dark': {
    name: 'vscode-dark',
    label: 'VS Code Dark',
    dark: true,
    colors: {
      background: '#181818',
      surface: '#1f1f1f',
      surfaceAlt: '#2b2b2b',
      border: '#3d3d3d',
      borderHover: '#5a5a5a',
      text: '#cccccc',
      textMuted: '#969696',
      textSecondary: '#b8b8b8',
      primary: '#0078d4',
      primaryHover: '#1c8ce3',
      primaryText: '#ffffff',
      danger: '#f14c4c',
      dangerHover: '#ff6b6b',
      warning: '#cca700',
      success: '#89d185',
      accent: '#c586c0',
      accentHover: '#d7a4d3',
      workspace: '#141414',
      shadow: 'rgba(0, 0, 0, 0.5)',
    },
  },
  'vscode-light': {
    name: 'vscode-light',
    label: 'VS Code Light',
    dark: false,
    colors: {
      background: '#ffffff',
      surface: '#f3f3f3',
      surfaceAlt: '#e8e8e8',
      border: '#d4d4d4',
      borderHover: '#b8b8b8',
      text: '#1e1e1e',
      textMuted: '#6a6a6a',
      textSecondary: '#4f4f4f',
      primary: '#0078d4',
      primaryHover: '#106ebe',
      primaryText: '#ffffff',
      danger: '#c50f1f',
      dangerHover: '#a80018',
      warning: '#8a6100',
      success: '#107c10',
      accent: '#5c2e91',
      accentHover: '#4a2478',
      workspace: '#ededed',
      shadow: 'rgba(0, 0, 0, 0.14)',
    },
  },
  midnight: {
    name: 'midnight',
    label: 'Midnight',
    dark: true,
    colors: {
      background: '#080d16',
      surface: '#101827',
      surfaceAlt: '#172235',
      border: '#26364f',
      borderHover: '#385074',
      text: '#eef4ff',
      textMuted: '#8391a7',
      textSecondary: '#a8b5c8',
      primary: '#3b82f6',
      primaryHover: '#60a5fa',
      primaryText: '#ffffff',
      danger: '#f87171',
      dangerHover: '#fb7185',
      warning: '#fbbf24',
      success: '#34d399',
      accent: '#a78bfa',
      accentHover: '#c4b5fd',
      workspace: '#050914',
      shadow: 'rgba(0, 0, 0, 0.58)',
    },
  },
}

const DEFAULT_THEME = APP_THEMES['codex-black']

interface AppThemeContextValue {
  theme: AppTheme
  setTheme: (theme: AppTheme) => void
  setThemeByName: (name: AppThemeName) => void
}

const AppThemeContext = createContext<AppThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  setThemeByName: () => {},
})

const cssVariableMap: Record<keyof AppTheme['colors'], string> = {
  background: '--bg',
  surface: '--surface',
  surfaceAlt: '--surface-alt',
  border: '--border',
  borderHover: '--border-hover',
  text: '--text',
  textMuted: '--text-muted',
  textSecondary: '--text-secondary',
  primary: '--primary',
  primaryHover: '--primary-hover',
  primaryText: '--primary-text',
  danger: '--danger',
  dangerHover: '--danger-hover',
  warning: '--warning',
  success: '--success',
  accent: '--accent',
  accentHover: '--accent-hover',
  workspace: '--workspace',
  shadow: '--shadow',
}

export interface AppThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: AppThemeName
  storageKey?: string
}

export function AppThemeProvider({
  children,
  defaultTheme = 'codex-black',
  storageKey = 'portfolio-app-theme',
}: AppThemeProviderProps) {
  const [themeName, setThemeName] = useState<AppThemeName>(() => {
    if (typeof window === 'undefined') return defaultTheme
    const saved = window.localStorage.getItem(storageKey) as AppThemeName | null
    return saved && APP_THEMES[saved] ? saved : defaultTheme
  })

  const theme = APP_THEMES[themeName] ?? APP_THEMES[defaultTheme] ?? DEFAULT_THEME

  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.appTheme = theme.name
    root.style.colorScheme = theme.dark ? 'dark' : 'light'

    ;(Object.keys(cssVariableMap) as Array<keyof AppTheme['colors']>).forEach((colorKey) => {
      root.style.setProperty(cssVariableMap[colorKey], theme.colors[colorKey])
    })

    // Temporary compatibility alias for old components. New code should use --workspace.
    root.style.setProperty('--canvas', theme.colors.workspace)

    document.body.style.background = theme.colors.background
    document.body.style.color = theme.colors.text
    window.localStorage.setItem(storageKey, theme.name)
  }, [storageKey, theme])

  const setTheme = (nextTheme: AppTheme) => setThemeName(nextTheme.name)
  const setThemeByName = (name: AppThemeName) => {
    if (APP_THEMES[name]) setThemeName(name)
  }

  return (
    <AppThemeContext.Provider value={{ theme, setTheme, setThemeByName }}>
      {children}
    </AppThemeContext.Provider>
  )
}

export function useAppTheme() {
  return useContext(AppThemeContext)
}

export interface AppThemeSelectorProps {
  align?: 'left' | 'right'
}

export function AppThemeSelector({ align = 'right' }: AppThemeSelectorProps) {
  const { theme, setTheme } = useAppTheme()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          minHeight: 30,
          padding: '5px 9px',
          background: 'var(--surface-alt)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          fontSize: 12,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 11,
            height: 11,
            borderRadius: 3,
            background: theme.colors.background,
            border: `1px solid ${theme.colors.borderHover}`,
            boxShadow: `inset 0 0 0 2px ${theme.colors.surface}`,
          }}
        />
        {theme.label}
        <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: 10 }}>▾</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Application theme"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            ...(align === 'right' ? { right: 0 } : { left: 0 }),
            zIndex: 10000,
            width: 205,
            maxHeight: 320,
            overflowY: 'auto',
            padding: 5,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 12px 30px var(--shadow)',
          }}
        >
          {(Object.values(APP_THEMES) as AppTheme[]).map((candidate) => {
            const active = candidate.name === theme.name
            return (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={active}
                key={candidate.name}
                onClick={() => {
                  setTheme(candidate)
                  setOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  gap: 9,
                  padding: '8px 9px',
                  background: active ? 'var(--primary)' : 'transparent',
                  color: active ? 'var(--primary-text)' : 'var(--text)',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(event) => {
                  if (!active) event.currentTarget.style.background = 'var(--surface-alt)'
                }}
                onMouseLeave={(event) => {
                  if (!active) event.currentTarget.style.background = 'transparent'
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    width: 24,
                    height: 18,
                    overflow: 'hidden',
                    flexShrink: 0,
                    borderRadius: 4,
                    border: `1px solid ${active ? 'rgba(255,255,255,.45)' : 'var(--border)'}`,
                  }}
                >
                  <span style={{ background: candidate.colors.background }} />
                  <span style={{ background: candidate.colors.surface }} />
                </span>
                <span style={{ flex: 1 }}>{candidate.label}</span>
                {active && <span aria-hidden="true">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
