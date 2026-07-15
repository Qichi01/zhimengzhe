import type { Theme } from "@/types";

export const themes: Record<string, Theme> = {
  "dream-light": {
    id: "dream-light",
    name: "梦境柔光",
    bgGradient: "radial-gradient(ellipse at 50% 40%, #2e2b4e 0%, #1e1b2e 70%)",
    textPrimary: "#e8d5f5",
    textSecondary: "#d5b8f5",
    optionBg: "rgba(200, 170, 255, 0.1)",
    optionBorder: "rgba(200, 170, 255, 0.25)",
    optionHoverBg: "rgba(200, 170, 255, 0.2)",
    accentColor: "#c8aaff",
    glowColor: "rgba(200, 170, 255, 0.3)",
    borderRadius: "12px",
  },
  "dark-noir": {
    id: "dark-noir",
    name: "暗夜哥特",
    bgGradient: "radial-gradient(ellipse at 50% 30%, #1a1a2e 0%, #0a0a0f 70%)",
    textPrimary: "#e0d5c8",
    textSecondary: "#c8b4a0",
    optionBg: "rgba(200, 180, 160, 0.1)",
    optionBorder: "rgba(200, 180, 160, 0.2)",
    optionHoverBg: "rgba(200, 180, 160, 0.18)",
    accentColor: "#c8b4a0",
    glowColor: "rgba(200, 180, 160, 0.25)",
    borderRadius: "4px",
  },
};

export const defaultTheme = themes["dream-light"];
