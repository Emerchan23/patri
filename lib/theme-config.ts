export type ThemeColor = "blue" | "green" | "red" | "orange" | "purple" | "slate"

export interface ThemeConfig {
  name: string
  label: string
  primary: string // HSL value
  ring: string // HSL value
}

export const themes: Record<ThemeColor, ThemeConfig> = {
  blue: {
    name: "blue",
    label: "Azul (Padrao)",
    primary: "222.2 47.4% 11.2%",
    ring: "222.2 84% 4.9%",
  },
  green: {
    name: "green",
    label: "Verde (Natureza)",
    primary: "142.1 76.2% 36.3%",
    ring: "142.1 76.2% 36.3%",
  },
  red: {
    name: "red",
    label: "Vermelho (Alerta)",
    primary: "346.8 77.2% 49.8%",
    ring: "346.8 77.2% 49.8%",
  },
  orange: {
    name: "orange",
    label: "Laranja (Energia)",
    primary: "24.6 95% 53.1%",
    ring: "24.6 95% 53.1%",
  },
  purple: {
    name: "purple",
    label: "Roxo (Criativo)",
    primary: "262.1 83.3% 57.8%",
    ring: "262.1 83.3% 57.8%",
  },
  slate: {
    name: "slate",
    label: "Cinza (Neutro)",
    primary: "215.4 16.3% 46.9%",
    ring: "215.4 16.3% 46.9%",
  },
}
