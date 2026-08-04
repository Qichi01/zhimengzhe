// ============================================================
// 织梦者 V2.1 类型定义
// ============================================================

// -------------------- 基础类型（V1 保留） --------------------

// 游戏场景
export interface Scene {
  id: string;
  content: string;        // 场景描述文字
  options: Option[];       // 玩家可选选项
  isEnding: boolean;       // 是否结局
  timestamp: number;
  illustration?: SceneIllustration | null;
}

// AI 为关键场景生成的本地插图
export interface SceneIllustration {
  dataUrl: string;        // 本地持久化后的 data URL，不依赖第三方临时链接
  alt: string;
  model: string;
  generatedAt: string;
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
  bgGradient: string;
  textPrimary: string;
  textSecondary: string;
  optionBg: string;
  optionBorder: string;
  optionHoverBg: string;
  accentColor: string;
  glowColor: string;
  borderRadius: string;
}

// 打字机速度
export type TypewriterSpeed = "slow" | "medium" | "fast";

// -------------------- V2.1 新增类型 --------------------

// 游戏类型
export type GameType = "otome" | "mystery" | "other";

// 游戏状态
export type GameStatus = "active" | "completed" | "archived";

// 章节状态
export type ChapterStatus = "in_progress" | "completed";

// 角色重要度
export type CharacterRole = "protagonist" | "major" | "minor";

// 人物头像来源：AI 默认生成或用户本地上传
export type CharacterAvatarSource = "generated" | "uploaded";

// 存档类型
export type SaveType = "auto" | "manual";

// 会员计划
export type MembershipPlan = "free" | "monthly" | "quarterly";

// -------------------- 数据库实体类型 --------------------

// 游戏记录
export interface Game {
  id: string;
  user_id: string;
  title: string;
  type: GameType;
  setting: string;
  cover_color: string;
  status: GameStatus;
  last_played_at: string | null;
  created_at: string;
  updated_at: string;
}

// 章节
export interface Chapter {
  id: string;
  game_id: string;
  chapter_number: number;
  title: string | null;
  summary: string | null;
  status: ChapterStatus;
  created_at: string;
}

// 场景（完整对话记录）
export interface SceneRecord {
  id: string;
  chapter_id: string;
  game_id: string;
  content: string;
  options: Option[] | null;
  ai_raw_response: string | null;
  is_ending: boolean;
  order_index: number;
  created_at: string;
  illustration?: SceneIllustration | null;
}

// 存档
export interface Save {
  id: string;
  game_id: string;
  chapter_id: string | null;
  scene_index: number;
  label: string;
  save_type: SaveType;
  created_at: string;
}

// 人物头像资源（压缩后保存在 IndexedDB）
export interface CharacterAvatar {
  dataUrl: string;
  source: CharacterAvatarSource;
  generatedModel?: string;
  updatedAt: string;
}

// 角色
export interface Character {
  id: string;
  game_id: string;
  name: string;
  description: string | null;
  role: CharacterRole;
  first_appearance_chapter: number | null;
  avatar_color: string;
  avatar?: CharacterAvatar | null;
  created_at: string;
}

// 关系
export interface Relationship {
  id: string;
  game_id: string;
  character_id: string;
  relation_label: string;
  previous_label: string | null;
  updated_at: string;
  created_at: string;
}

// 线索
export interface Clue {
  id: string;
  game_id: string;
  content: string;
  note: string | null;
  map_id: string | null;
  created_at: string;
}

// 地图房间
export interface MapRoom {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  connections: string[];
}

// 地图布局数据
export interface MapLayoutData {
  rooms: MapRoom[];
}

// 场景布局图
export interface GameMap {
  id: string;
  game_id: string;
  chapter_id: string | null;
  title: string;
  layout_data: MapLayoutData;
  svg_content: string | null;
  created_at: string;
}

// -------------------- 用户资料类型 --------------------

// 用户会员资料（Supabase user_profiles 表）
export interface UserProfile {
  id: string;           // = auth.users.id
  email: string | null;
  membership_plan: MembershipPlan;
  membership_expires_at: string | null;
  free_trial_used: number;   // 已用免费体验次数
  created_at: string;
  updated_at: string;
}

// -------------------- AI 响应解析类型 --------------------

// AI 响应中可能包含的附加信息
export interface ParsedAIResponse {
  content: string;              // 场景描述
  options: Option[];            // 选项
  isEnding: boolean;            // 是否结局
  chapterMarker?: {             // 章节标记
    number: number;
    title: string;
  };
  relationshipUpdates?: RelationshipUpdate[];  // 关系更新（乙游）
  sceneLayout?: SceneLayoutData;                // 场景布局（悬疑）
  illustrationSuggested: boolean;               // AI 是否判断为关键视觉场景
}

// 关系更新指令
export interface RelationshipUpdate {
  characterName: string;
  description?: string;
  relationLabel: string;
  action: "new" | "change";
}

// 场景布局指令
export interface SceneLayoutData {
  locationName: string;
  rooms: MapRoom[];
  keyItems: string[];
}

// -------------------- 记忆压缩类型 --------------------

// 上下文构建配置
export interface ContextConfig {
  maxRecentScenes: number;      // 当前章节保留的最近对话轮数
  chapterSummaryMaxLen: number; // 章节摘要最大字数
}
