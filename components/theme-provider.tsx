"use client"

import * as React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { themes, type ThemeColor } from "@/lib/theme-config"
import useSWR from "swr"
import { fetcher } from "@/lib/api-client"

interface ThemeContextType {
  theme: ThemeColor
  setTheme: (theme: ThemeColor) => void
  sidebarColor: "light" | "dark" | "navy" | "slate"
  setSidebarColor: (color: "light" | "dark" | "navy" | "slate") => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeColor>("blue")
  const [sidebarColor, setSidebarColor] = useState<"light" | "dark" | "navy" | "slate">("dark")
  const { data: settings } = useSWR("/configuracoes/sistema", fetcher)

  // Load from server setting when available
  useEffect(() => {
    if (settings) {
      if (settings.themeColor) setTheme(settings.themeColor as ThemeColor)
      if (settings.sidebarColor) setSidebarColor(settings.sidebarColor as "light" | "dark" | "navy" | "slate")
    }
  }, [settings])

  // Apply theme to CSS variables
  useEffect(() => {
    const root = document.documentElement
    const themeConfig = themes[theme]
    
    if (themeConfig) {
      root.style.setProperty("--primary", themeConfig.primary)
      root.style.setProperty("--ring", themeConfig.ring)
      root.style.setProperty("--chart-1", themeConfig.primary)
    }
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, sidebarColor, setSidebarColor }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
