"use client";

import type { CSSProperties } from "react";
import type { Option } from "@/types";
import { themes } from "@/lib/themes";

interface OptionButtonsProps {
  /** 当前可选的选项列表 */
  options: Option[];
  /** 选中某个选项时的回调 */
  onChoose: (option: Option) => void;
  /** 当前主题 id，用于取主题色 */
  themeId: string;
  /** 是否禁用所有按钮 */
  disabled?: boolean;
}

/**
 * 选项按钮组件：根据主题色渲染按钮，hover 时放大并发光，从下方淡入。
 * 主题色通过内联 style 注入（包括供 hover 规则使用的 CSS 变量）。
 */
export default function OptionButtons({
  options,
  onChoose,
  themeId,
  disabled = false,
}: OptionButtonsProps) {
  const theme = themes[themeId] ?? themes["dream-light"];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "100%",
        maxWidth: "680px",
        margin: "0 auto",
      }}
    >
      {options.map((option, index) => {
        const style: CSSProperties = {
          background: theme.optionBg,
          border: `1px solid ${theme.optionBorder}`,
          borderRadius: theme.borderRadius,
          color: theme.textPrimary,
          padding: "14px 20px",
          textAlign: "left",
          fontSize: "16px",
          lineHeight: 1.6,
          width: "100%",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          // 从下方淡入，逐个错开
          animation: `optionFadeInUp 0.45s ease ${index * 0.12}s both`,
          // 注入主题色变量，供 globals.css 中的 hover 规则使用
          ["--opt-hover-bg" as keyof CSSProperties]: theme.optionHoverBg,
          ["--opt-glow" as keyof CSSProperties]: theme.glowColor,
          ["--opt-accent" as keyof CSSProperties]: theme.accentColor,
        };

        return (
          <button
            key={`${option.label}-${index}`}
            type="button"
            className="option-button"
            disabled={disabled}
            onClick={() => onChoose(option)}
            style={style}
          >
            <span style={{ fontWeight: 700, marginRight: "8px" }}>
              {option.label}.
            </span>
            <span>{option.text}</span>
          </button>
        );
      })}
    </div>
  );
}
