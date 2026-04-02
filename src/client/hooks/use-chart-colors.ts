import { useEffect, useState } from 'react'

export function useChartColors() {
  const [colors, setColors] = useState({
    chart1: '',
    chart2: '',
    chart3: '',
    chart4: '',
    chart5: '',
    primary: '',
    success: '',
    warning: '',
    destructive: '',
    border: '',
    mutedForeground: '',
    foreground: '',
    background: '',
  })

  useEffect(() => {
    const updateColors = () => {
      const root = document.documentElement
      const computedStyle = getComputedStyle(root)

      const getVar = (name: string) => {
        const value = computedStyle.getPropertyValue(name).trim()
        if (value.startsWith('oklch') || value.startsWith('oklab') || value.startsWith('hsl') || value.startsWith('rgb')) {
          return value
        }
        if (value.startsWith('var(')) {
          const innerVar = value.match(/var\((--[^)]+)\)/)?.[1]
          if (innerVar) {
            return computedStyle.getPropertyValue(innerVar).trim()
          }
        }
        return value
      }

      setColors({
        chart1: getVar('--chart-1'),
        chart2: getVar('--chart-2'),
        chart3: getVar('--chart-3'),
        chart4: getVar('--chart-4'),
        chart5: getVar('--chart-5'),
        primary: getVar('--primary'),
        success: getVar('--success'),
        warning: getVar('--warning'),
        destructive: getVar('--destructive'),
        border: getVar('--border'),
        mutedForeground: getVar('--muted-foreground'),
        foreground: getVar('--foreground'),
        background: getVar('--background'),
      })
    }

    updateColors()

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class' || mutation.attributeName === 'style') {
          updateColors()
        }
      })
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    })

    return () => observer.disconnect()
  }, [])

  return colors
}

export function useColor(varName: string) {
  const [color, setColor] = useState('')

  useEffect(() => {
    const updateColor = () => {
      const root = document.documentElement
      const computedStyle = getComputedStyle(root)
      let value = computedStyle.getPropertyValue(varName).trim()

      if (value.startsWith('var(')) {
        const innerVar = value.match(/var\((--[^)]+)\)/)?.[1]
        if (innerVar) {
          value = computedStyle.getPropertyValue(innerVar).trim()
        }
      }

      setColor(value)
    }

    updateColor()

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class' || mutation.attributeName === 'style') {
          updateColor()
        }
      })
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    })

    return () => observer.disconnect()
  }, [varName])

  return color
}
