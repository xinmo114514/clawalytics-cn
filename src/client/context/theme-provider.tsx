import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { getCookie, setCookie, removeCookie } from '@/lib/cookies'

export type ColorTheme = 'blue' | 'purple' | 'green' | 'orange' | 'pink' | 'windows'
type Theme = 'dark' | 'light' | 'system'
type ResolvedTheme = Exclude<Theme, 'system'>

const DEFAULT_THEME = 'system'
const DEFAULT_COLOR_THEME: ColorTheme = 'windows'
const THEME_COOKIE_NAME = 'vite-ui-theme'
const COLOR_THEME_COOKIE_NAME = 'vite-ui-color-theme'
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

const DEFAULT_WINDOWS_COLOR = {
  light: 'oklch(0.55 0.2 265)',
  dark: 'oklch(0.55 0.2 265)',
}

export const colorThemes: { value: ColorTheme; zh: string; en: string }[] = [
  { value: 'windows', zh: '跟随 Windows', en: 'Windows' },
  { value: 'blue', zh: '蓝色', en: 'Blue' },
  { value: 'purple', zh: '紫色', en: 'Purple' },
  { value: 'green', zh: '绿色', en: 'Green' },
  { value: 'orange', zh: '橙色', en: 'Orange' },
  { value: 'pink', zh: '粉色', en: 'Pink' },
]

const windowsColorCSSVars = {
  light: '--windows-accent',
  dark: '--windows-accent-dark',
}

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  defaultColorTheme?: ColorTheme
  storageKey?: string
}

type ThemeProviderState = {
  defaultTheme: Theme
  defaultColorTheme: ColorTheme
  resolvedTheme: ResolvedTheme
  theme: Theme
  setTheme: (theme: Theme) => void
  resetTheme: () => void
  colorTheme: ColorTheme
  setColorTheme: (colorTheme: ColorTheme) => void
  resetColorTheme: () => void
}

const initialState: ThemeProviderState = {
  defaultTheme: DEFAULT_THEME,
  defaultColorTheme: DEFAULT_COLOR_THEME,
  resolvedTheme: 'light',
  theme: DEFAULT_THEME,
  setTheme: () => null,
  resetTheme: () => null,
  colorTheme: DEFAULT_COLOR_THEME,
  setColorTheme: () => null,
  resetColorTheme: () => null,
}

const ThemeContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME,
  defaultColorTheme = DEFAULT_COLOR_THEME,
  storageKey = THEME_COOKIE_NAME,
  ...props
}: ThemeProviderProps) {
  const [theme, _setTheme] = useState<Theme>(
    () => (getCookie(storageKey) as Theme) || defaultTheme
  )

  const [colorTheme, _setColorTheme] = useState<ColorTheme>(() => {
    const savedColor = getCookie(COLOR_THEME_COOKIE_NAME) as ColorTheme
    return colorThemes.some((c) => c.value === savedColor)
      ? savedColor
      : defaultColorTheme
  })

  const resolvedTheme = useMemo((): ResolvedTheme => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    }
    return theme as ResolvedTheme
  }, [theme])

  useEffect(() => {
    const root = window.document.documentElement
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = (currentResolvedTheme: ResolvedTheme) => {
      root.classList.remove('light', 'dark')
      root.classList.add(currentResolvedTheme)
    }

    const handleChange = () => {
      if (theme === 'system') {
        const systemTheme = mediaQuery.matches ? 'dark' : 'light'
        applyTheme(systemTheme)
      }
    }

    applyTheme(resolvedTheme)

    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, resolvedTheme])

  useEffect(() => {
    const root = window.document.documentElement
    colorThemes.forEach((c) => root.classList.remove(`color-${c.value}`))
    root.classList.add(`color-${colorTheme}`)

    if (colorTheme === 'windows') {
      const isDark = resolvedTheme === 'dark'
      const cssVar = windowsColorCSSVars[isDark ? 'dark' : 'light']
      const computedColor = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim() || DEFAULT_WINDOWS_COLOR[isDark ? 'dark' : 'light']
      root.style.setProperty('--primary', computedColor)
      root.style.setProperty('--primary-foreground', isDark ? 'oklch(0.985 0.003 247.858)' : 'oklch(0.18 0.005 285)')
      root.style.setProperty('--ring', computedColor)
    }
  }, [colorTheme, resolvedTheme])

  const setTheme = (theme: Theme) => {
    setCookie(storageKey, theme, THEME_COOKIE_MAX_AGE)
    _setTheme(theme)
  }

  const resetTheme = () => {
    removeCookie(storageKey)
    _setTheme(DEFAULT_THEME)
  }

  const setColorTheme = (colorTheme: ColorTheme) => {
    setCookie(COLOR_THEME_COOKIE_NAME, colorTheme, THEME_COOKIE_MAX_AGE)
    _setColorTheme(colorTheme)
  }

  const resetColorTheme = () => {
    removeCookie(COLOR_THEME_COOKIE_NAME)
    _setColorTheme(DEFAULT_COLOR_THEME)
  }

  const contextValue = {
    defaultTheme,
    defaultColorTheme,
    resolvedTheme,
    resetTheme,
    theme,
    setTheme,
    colorTheme,
    setColorTheme,
    resetColorTheme,
  }

  return (
    <ThemeContext value={contextValue} {...props}>
      {children}
    </ThemeContext>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)

  if (!context) throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
