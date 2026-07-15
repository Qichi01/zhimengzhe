// 游戏场景
export interface Scene {
  id: string;
  content: string;        // 场景描述文字
  options: Option[];       // 玩家可选选项
  isEnding: boolean;       // 是否结局
  timestamp: number;
}

// 选项
export interface Option {
  label: string;    // A/B/C/D
  text: string;     // 选项内容
}

// 对话消息（发给 AI 的格式）
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// 主题
export interface Theme {
  id: string;
  name: string;
  bgGradient: string;       // 背景渐变
  textPrimary: string;      // 主文字颜色
  textSecondary: string;    // 次要文字颜色
  optionBg: string;         // 选项背景
  optionBorder: string;     // 选项边框
  optionHoverBg: string;    // 选项 hover 背景
  accentColor: string;      // 强调色
  glowColor: string;        // 光晕色
  borderRadius: string;     // 圆角
}

// 打字机速度
export type TypewriterSpeed = "slow" | "medium" | "fast";
