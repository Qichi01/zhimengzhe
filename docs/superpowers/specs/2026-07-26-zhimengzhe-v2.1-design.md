# 织梦者 V2.1 设计文档

> **日期**: 2026-07-26
> **状态**: 已确认，待实施
> **版本**: V2.1（V1 已上线，本次为重大升级）

---

## 0. 版本说明

| 版本 | 内容 | 状态 |
|------|------|------|
| V1 | MVP：单次游戏 + BYOK + 爱发电 | 已上线 (2026-07-16) |
| **V2.1** | **本次：全栈升级 Supabase + 用户系统 + 游戏空间 + 星图 + 类型系统** | **设计中** |
| V2.2 | 后续：3D星图 + 分支树 + 场景渲染图 + 更多模型 | 规划中 |

**版本管理约定：**
- 每个功能模块开发完成后，在 `docs/changelog/` 下记录变更
- 每次 push 前 commit message 标注模块名，如 `feat(starmap): 2D星图组件`
- 重大节点打 git tag，如 `v2.1.0-starmap`、`v2.1.0-auth`

---

## 1. 核心决策摘要

| 维度 | V1 | V2.1 |
|------|-----|------|
| 架构 | 纯前端 + Edge API | Next.js 全栈 + Supabase |
| 数据存储 | localStorage | Supabase PostgreSQL (RLS) |
| 用户系统 | 无 | Supabase Auth（邮箱魔法链接） |
| 游戏管理 | 单次游戏 | 游戏空间（最多5个游戏） |
| 章节系统 | 无 | 星图章节（2D星图 + AI自动分章） |
| 存档 | 无 | 自动存档 + 手动存档（分页展示） |
| 记忆管理 | 全量对话 | 记忆压缩（章节摘要 + 最近对话） |
| 游戏类型 | 无 | 乙游/悬疑/其他（类型专属功能） |
| 人物系统 | 无 | 关系图（定性关系，非数值） |
| 线索系统 | 无 | 线索板笔记本 + 场景布局图 |
| 付费 | 爱发电打赏式 | 会员计划（代付API费用） |
| 免费体验 | 3次 | 10轮（确保能看到星图） |
| 埋点 | 无 | Vercel Analytics + Umami |
| 背景 | 静态渐变 | Canvas星空粒子动效 |

---

## 2. 技术架构

### 2.1 技术栈

- **前端**: Next.js 14 (App Router) + TypeScript + Tailwind CSS v4
- **状态管理**: Zustand（UI状态）+ Supabase Client（数据持久化）
- **后端**: Supabase (PostgreSQL + Auth + RLS)
- **AI**: DeepSeek API（系统Key + 用户Key双通道）
- **部署**: Vercel
- **分析**: Vercel Analytics + Umami Cloud

### 2.2 项目结构

```
src/
├── app/
│   ├── /                     ← 游戏空间页（首页）
│   ├── /game/[id]            ← 游戏入口页（晨光风格菜单）
│   ├── /play/[id]            ← 阅读器页面
│   ├── /settings             ← 设置页
│   ├── /membership           ← 会员计划页
│   ├── /auth/login           ← 登录页
│   └── /api/
│       ├── chat/route.ts     ← DeepSeek 流式代理（保留）
│       ├── compress/route.ts ← 记忆压缩 API
│       └── relationship/route.ts ← 关系图解析 API
├── components/
│   ├── StarfieldBackground.tsx   ← 星空粒子背景
│   ├── GameSpace/                ← 游戏空间组件
│   │   ├── GameCard.tsx
│   │   └── CreateGameModal.tsx
│   ├── GameMenu/                 ← 游戏入口页组件
│   │   ├── GameMenu.tsx
│   │   ├── SaveList.tsx
│   │   └── StoryReview.tsx
│   ├── StarMap/                  ← 星图组件
│   │   ├── StarMap.tsx
│   │   └── StarNode.tsx
│   ├── RelationshipGraph/        ← 关系图组件
│   │   ├── RelationshipGraph.tsx
│   │   └── CharacterPanel.tsx
│   ├── ClueBoard/                ← 线索板组件
│   │   ├── ClueNotebook.tsx
│   │   └── MapView.tsx
│   ├── StoryReader.tsx           ← 核心阅读器（重构）
│   ├── TypewriterText.tsx
│   └── OptionButtons.tsx
├── lib/
│   ├── supabase/client.ts        ← Supabase 客户端
│   ├── supabase/queries.ts       ← 数据库查询封装
│   ├── themes.ts
│   ├── parser.ts                 ← AI 响应解析（扩展）
│   ├── memory.ts                 ← 记忆压缩逻辑
│   └── analytics.ts              ← 埋点工具
├── stores/
│   ├── authStore.ts              ← 认证状态
│   ├── gameStore.ts              ← 游戏状态（重构）
│   └── userStore.ts              ← 用户设置状态
└── types/
    └── index.ts                  ← 类型定义（扩展）
```

---

## 3. 数据模型（Supabase）

### 3.1 表结构

```sql
-- 用户（Supabase Auth 自带 auth.users）

-- 游戏表
games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',  -- 'otome' | 'mystery' | 'other'
  setting TEXT NOT NULL,
  cover_color TEXT DEFAULT '#c8aaff',
  status TEXT DEFAULT 'active',        -- 'active' | 'completed' | 'archived'
  last_played_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)

-- 章节表
chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE NOT NULL,
  chapter_number INT NOT NULL,
  title TEXT,
  summary TEXT,                        -- 压缩摘要
  status TEXT DEFAULT 'in_progress',   -- 'in_progress' | 'completed'
  created_at TIMESTAMPTZ DEFAULT now()
)

-- 场景表（存完整对话）
scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE NOT NULL,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  options JSONB,                       -- [{label, text}]
  ai_raw_response TEXT,                -- AI原始回复（含关系更新等）
  is_ending BOOLEAN DEFAULT false,
  order_index INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
)

-- 存档表
saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES chapters(id),
  scene_index INT NOT NULL,
  label TEXT NOT NULL,                 -- 'auto' | 用户自定义名称
  save_type TEXT DEFAULT 'manual',     -- 'auto' | 'manual'
  created_at TIMESTAMPTZ DEFAULT now()
)

-- 角色表（关系图）
characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  role TEXT DEFAULT 'minor',           -- 'protagonist' | 'major' | 'minor'
  first_appearance_chapter INT,
  avatar_color TEXT DEFAULT '#c8aaff',
  created_at TIMESTAMPTZ DEFAULT now()
)

-- 关系表
relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE NOT NULL,
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE NOT NULL,
  relation_label TEXT NOT NULL,        -- '道侣' | '友人' | '敌对' | '师徒' 等
  previous_label TEXT,                 -- 变化前的关系
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
)

-- 线索表（悬疑）
clues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  note TEXT,                            -- 用户手动备注
  map_id UUID REFERENCES maps(id),     -- 关联的地图（可选）
  created_at TIMESTAMPTZ DEFAULT now()
)

-- 地图表（悬疑）
maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES chapters(id),
  title TEXT NOT NULL,
  layout_data JSONB NOT NULL,           -- {rooms: [{name, x, y, w, h, connections: []}]}
  svg_content TEXT,                     -- 渲染后的SVG
  created_at TIMESTAMPTZ DEFAULT now()
)
```

### 3.2 RLS 策略

所有表均启用 Row Level Security：

```sql
-- games: 用户只能 CRUD 自己的游戏
CREATE POLICY "games_owner" ON games
  FOR ALL USING (user_id = auth.uid());

-- chapters/scenes/saves/characters/relationships/clues/maps:
-- 通过 game_id 关联验证
CREATE POLICY "chapters_via_game" ON chapters
  FOR ALL USING (
    game_id IN (SELECT id FROM games WHERE user_id = auth.uid())
  );
-- 其他表同理
```

---

## 4. 用户系统

### 4.1 登录方案

**Supabase Auth + 邮箱魔法链接**

- 用户输入邮箱 → Supabase 发送登录链接邮件 → 点击链接即登录
- 无需密码，无需注册流程
- 首次登录自动创建用户记录
- Token 存 cookie，Supabase SDK 自动管理刷新

### 4.2 未登录用户体验

- 可访问首页，看到产品介绍 + 星空背景
- 点击「创建游戏」或「开始体验」→ 弹出登录引导
- 登录后跳回原页面继续操作

### 4.3 认证状态管理

```typescript
// authStore.ts
interface AuthState {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}
```

使用 Supabase `onAuthStateChange` 监听登录状态变化。

---

## 5. 游戏空间页（首页）

### 5.1 布局

```
┌──────────────────────────────────────────┐
│  [星空背景动效 - Canvas 全屏]               │
│                                          │
│  织梦者                         [设置][👤] │
│  ──────────────────────────────────────  │
│                                          │
│  我的梦境                                 │
│                                          │
│  ┌────────┐ ┌────────┐ ┌────────┐       │
│  │ 失忆公主 │ │ 古堡探秘 │ │  + 新建 │       │
│  │ 乙游·3章 │ │ 悬疑·1章 │ │  游戏  │       │
│  │ 2小时前  │ │ 昨天    │ │        │       │
│  └────────┘ └────────┘ └────────┘       │
│                                          │
│  最多可创建 5 个游戏                       │
└──────────────────────────────────────────┘
```

### 5.2 游戏卡片

- 显示：标题、类型标签、章节数、上次游玩时间
- 卡片有星空边框微光效果
- 点击卡片 → 进入游戏入口页 `/game/[id]`
- 长按或右键 → 删除游戏（需确认）

### 5.3 新建游戏弹窗

```
┌─────────────────────────────┐
│  创建新梦境               ✕  │
│  ─────────────────────────  │
│                             │
│  游戏类型                    │
│  ┌─────┐┌─────┐┌─────┐     │
│  │ 乙游 ││ 悬疑 ││ 其他 │     │
│  └─────┘└─────┘└─────┘     │
│                             │
│  故事设定                    │
│  ┌─────────────────────────┐│
│  │ 例如：你是一名失忆的公主  ││
│  │ ，在梦中寻找记忆...       ││
│  └─────────────────────────┘│
│                             │
│         [开始编织梦境]       │
└─────────────────────────────┘
```

- 游戏类型三选一，默认选中「乙游」
- 输入设定后点击创建 → 创建游戏记录 → 跳转游戏入口页
- 已有 5 个游戏时，「+ 新建」按钮禁用，提示「已达到上限」

---

## 6. 游戏入口页（晨光风格）

### 6.1 布局

```
┌──────────────────────────────────────────┐
│  [星空背景 - 较稀疏]                       │
│                                          │
│                                          │
│            ✦ 失忆公主的梦境 ✦              │
│           （游戏标题 + 氛围光晕）           │
│                                          │
│            ◆ 新的开始                      │
│            ◆ 读取存档                      │
│            ◆ 剧情回顾                      │
│            ◆ 人物关系图     ← 乙游专属      │
│            ◆ 线索板         ← 悬疑专属      │
│            ◆ 返回空间                      │
│                                          │
└──────────────────────────────────────────┘
```

### 6.2 菜单项逻辑

| 菜单项 | 显示条件 | 功能 |
|--------|----------|------|
| 继续旅程 | 有存档时显示 | 从最近存档继续游戏 |
| 新的开始 | 始终显示 | 清空进度从头开始（需确认） |
| 读取存档 | 有存档时显示 | 存档列表页（自动/手动分Tab） |
| 剧情回顾 | 有已完成章节时显示 | 查看任意章节完整内容 |
| 人物关系图 | 乙游类型 + 有角色数据时显示 | 力导向关系图 |
| 线索板 | 悬疑类型时显示 | 线索笔记本 + 地图查看 |
| 返回空间 | 始终显示 | 回到游戏空间页 |

**「继续旅程」逻辑：**
- 首次进入游戏（无存档）：不显示此按钮
- 有存档后：显示，点击从最近一次自动/手动存档恢复

### 6.3 存档列表页

```
┌──────────────────────────────────┐
│  读取存档                    ✕   │
│  ──────────────────────────────  │
│  [自动存档]  [手动存档]           │
│                                  │
│  自动存档 Tab:                    │
│  ┌──────────────────────────────┐│
│  │ 第三章 · 第5场景  2小时前     ││
│  │ "你推开了古堡的铁门..."       ││
│  └──────────────────────────────┘│
│  ┌──────────────────────────────┐│
│  │ 第二章 · 第8场景  昨天        ││
│  │ "竹林深处传来箫声..."         ││
│  └──────────────────────────────┘│
│                                  │
│  手动存档 Tab:                    │
│  ┌──────────────────────────────┐│
│  │ "关键抉择点"  3小时前         ││
│  │ 第二章 · 第3场景              ││
│  └──────────────────────────────┘│
└──────────────────────────────────┘
```

---

## 7. 星图章节系统

### 7.1 章节划分

**AI 自动分章（方案 A）：**

System Prompt 扩展：
```
你需要根据叙事节奏自然地划分章节。当故事进入新的阶段/场景/时间线时，
在场景描述的最开头加上章节标记：

【第N章：章节标题】

例如：
【第二章：梦中森林】
你踏入了一片银色的树林...
```

前端解析 `【第N章：标题】` 标记，创建新的 chapter 记录。

### 7.2 2D 星图设计

**视觉：**
- 星空背景上，章节以发光星点呈现
- 星点之间用细线连接（已走过的路径）
- 当前章节的星点脉冲发光
- 已完成章节的星点稳定发光（暗一些）
- 星点上方显示章节标题

**交互：**
- 支持拖拽平移、滚轮缩放
- 点击已完成章节星点 → 查看该章节内容（剧情回顾）
- 当前章节星点不可点击（正在游玩中）

**实现：** SVG 绘制节点 + 连线，CSS 动画做脉冲效果

### 7.3 星图布局算法

线性路径布局，从上到下：
```
节点1 (x=center, y=100)
  |
节点2 (x=center±offset, y=250)  ← 轻微左右偏移增加自然感
  |
节点3 (x=center, y=400)
  |
...
```

---

## 8. 存档/读档系统

### 8.1 自动存档

- **触发时机**：每完成一个章节时自动存档
- **存档内容**：chapter_id + scene_index + 时间戳
- **命名**：自动生成「第N章 · 第M场景」
- **上限**：每个游戏保留最近 10 个自动存档，超出删除最早的

### 8.2 手动存档

- **触发**：用户在阅读器中点击「存档」按钮
- **命名**：用户可输入自定义名称，或使用默认「第N章 · 第M场景」
- **上限**：每个游戏最多 10 个手动存档

### 8.3 存档恢复

选择存档后：
1. 从 Supabase 加载该 game 的所有 scenes（到存档点为止）
2. 恢复 gameStore 状态
3. 跳转到阅读器，从存档点继续

---

## 9. 记忆压缩机制

### 9.1 上下文结构

```
发送给 AI 的上下文：
┌──────────────────────────┐
│ System Prompt            │  固定
├──────────────────────────┤
│ 第1章摘要（~200字）       │  压缩
│ 第2章摘要（~200字）       │  压缩
│ 第3章摘要（~200字）       │  压缩
├──────────────────────────┤
│ 第4章完整对话（如不太长）  │  完整或压缩
├──────────────────────────┤
│ 第5章最近5轮完整对话      │  完整
├──────────────────────────┤
│ 当前用户选择              │  最新
└──────────────────────────┘
```

### 9.2 压缩流程

1. 章节完成时，调用 `/api/compress`：
   - 输入：该章节所有 AI 回复 + 用户选择
   - Prompt：「请将以下互动小说对话总结为 200 字以内的摘要，保留：关键事件、人物关系变化、重要线索、未解之谜」
   - 输出：存入 `chapters.summary`

2. 下次请求 AI 时，上下文构建逻辑：
   - 已完成章节 → 用 summary
   - 当前章节 → 用最近 5 轮完整对话
   - 如果当前章节对话超过 5 轮，更早的对话也用 summary（章节内压缩）

### 9.3 完整对话保留

- 所有原始对话存入 `scenes` 表，不受压缩影响
- 用户在「剧情回顾」中看到的永远是完整内容
- 压缩只影响发送给 AI 的上下文，不影响用户查看

---

## 10. 游戏类型系统

### 10.1 类型定义

```typescript
type GameType = 'otome' | 'mystery' | 'other';
```

### 10.2 类型差异

| 功能 | 乙游 (otome) | 悬疑 (mystery) | 其他 (other) |
|------|-------------|---------------|-------------|
| 星图章节 | ✅ | ✅ | ✅ |
| 存档/读档 | ✅ | ✅ | ✅ |
| 剧情回顾 | ✅ | ✅ | ✅ |
| 人物关系图 | ✅ | ❌ | ❌ |
| 线索板 | ❌ | ✅ | ❌ |
| 场景布局图 | ❌ | ✅ | ❌ |
| AI Prompt 差异 | 关系更新指令 | 线索/地图指令 | 基础指令 |

### 10.3 类型专属 Prompt

**乙游 System Prompt 追加：**
```
在场景描述和选项之后，附带输出人物关系状态（用户不可见）：

[关系更新]
- 角色名：关系标签（如道侣/友人/敌对/师徒）（新增/变化）
```

**悬疑 System Prompt 追加：**
```
在关键场景（如发现案发现场、进入新地点）时，附带输出场景布局：

[场景布局]
地点名称：xxx
房间列表：
- 房间A（x:0, y:0, w:100, h:80）连接：房间B
- 房间B（x:100, y:0, w:80, h:80）连接：房间A, 房间C
关键物品：桌上的信件、保险箱
```

---

## 11. 人物关系图（乙游）

### 11.1 数据来源

- AI 在场景生成时附带 `[关系更新]` 标记
- 前端解析后更新 `characters` 和 `relationships` 表
- AI 自动识别主要角色和次要角色，不需要用户预设

### 11.2 展示方式

**力导向图：**
- 主角在中心
- 主要角色距离主角近，次要角色距离远
- 关系类型用不同颜色/样式的连线表示：
  - 道侣/恋人：粉色粗线 + 心形
  - 友人：蓝色细线
  - 敌对：红色虚线
  - 师徒：金色线

**角色详情面板（点击节点）：**
- 角色名 + 头像色块
- 描述（AI 生成）
- 首次登场章节
- 关系变化历史（时间线）

### 11.3 关系更新逻辑

```
AI 输出:
[关系更新]
- 林夜：道侣（从友人变化）
- 苏婉：友人（新增角色，第2章登场）

前端处理:
1. 查找/创建 character 记录
2. 创建/更新 relationship 记录
3. previous_label 记录变化前的关系
4. 更新关系图可视化
```

---

## 12. 线索板 + 地图（悬疑）

### 12.1 线索板（笔记本风格）

```
┌──────────────────────────────────┐
│  📓 线索笔记本              ✕    │
│  ──────────────────────────────  │
│                                  │
│  ┌──────────────────────────────┐│
│  │ 📌 桌上的信件                 ││
│  │ 信中提到了"午夜的秘密会议"     ││
│  │ [查看关联地图]   2小时前       ││
│  └──────────────────────────────┘│
│                                  │
│  ┌──────────────────────────────┐│
│  │ 📌 保险箱密码                 ││
│  │ 可能与书房挂钟的时间有关       ││
│  │ 3小时前                       ││
│  └──────────────────────────────┘│
│                                  │
│  [+ 添加线索]                    │
│                                  │
│  ──────────────────────────────  │
│  场景地图                        │
│  ┌────────┐ ┌────────┐          │
│  │ 车厢布局 │ │ 书房布局 │          │
│  │  [下载]  │ │  [下载]  │          │
│  └────────┘ └────────┘          │
└──────────────────────────────────┘
```

- 用户可手动添加文字线索
- AI 生成的线索也会自动添加
- 每条线索可关联一张地图
- 线索可编辑/删除

### 12.2 场景布局图

**生成方式：**
- AI 在关键场景输出 `[场景布局]` 标记
- 前端解析 `layout_data` JSON
- 用 SVG 绘制俯视布局图

**SVG 布局图：**
- 矩形表示房间，标注房间名
- 连接线表示通道
- 关键物品用图标标记
- 配色与当前主题一致

**下载功能：**
- SVG → Canvas → PNG 下载
- 点击「添加到线索板」→ 创建 clue 记录关联 map_id

**数量限制：** 一个悬疑游戏约 3-5 个地图

---

## 13. 星空背景动效

### 13.1 实现

**Canvas 粒子系统，3 层：**

| 层 | 内容 | 数量 | 动效 |
|----|------|------|------|
| 远景 | 星点（1-2px） | 200-300个 | 缓慢闪烁 |
| 中景 | 星河带（渐变 + 流动） | 1条带状 | 缓慢横向流动 |
| 近景 | 流星 | 随机生成 | 划过屏幕后消失 |

### 13.2 性能控制

- `requestAnimationFrame` 驱动
- 不同页面调整粒子密度：
  - 游戏空间页：密集（营造沉浸感）
  - 游戏入口页：中等（突出标题）
  - 阅读器页：稀疏（不干扰阅读）
- Canvas `pointer-events: none`，不拦截交互
- 移动端降低粒子数量

### 13.3 配色

与主题联动：
- 梦境柔光：深紫底 + 薰衣草星点
- 暗夜哥特：深黑底 + 暖白羊皮纸星点

---

## 14. 付费方案

### 14.1 定价

| 方案 | 价格 | 说明 |
|------|------|------|
| 免费体验 | 0 元 | 10 轮 AI 对话（走系统 Key） |
| 月卡 | 9.9 元/月 | 无限畅玩，系统代付 API 费用 |
| 季卡 | 24.9 元/季 | 约 8.3 元/月，鼓励长期留存 |
| BYOK | 0 元 | 填自己的 DeepSeek API Key，永久免费 |

### 14.2 付费入口设计

**不单独建明显的付费页入口，而是嵌入设置页：**

设置页 → API 配置区域：
```
DeepSeek API Key
填入你的 Key 即可无限畅玩，无需付费。
Key 仅保存在你的账户中，安全可靠。

[输入框] [保存]

获取 Key ↗

────────────────────────────────
不想自己配置 API？开通会员，我们来帮你搞定 →
────────────────────────────────
```

点击底部小字链接 → 跳转 `/membership` 页面

### 14.3 会员计划页

```
┌──────────────────────────────────┐
│  会员计划                    ←   │
│  ──────────────────────────────  │
│                                  │
│  适合不想自己配置 API 的小伙伴     │
│                                  │
│  ┌──────────────┐ ┌────────────┐ │
│  │  月卡         │ │  季卡       │ │
│  │  ¥9.9/月     │ │  ¥24.9/季  │ │
│  │              │ │  约8.3元/月 │ │
│  │  ✓ 无限畅玩   │ │  ✓ 无限畅玩 │ │
│  │  ✓ 系统代付   │ │  ✓ 系统代付 │ │
│  │    API费用    │ │    API费用  │ │
│  │  ✓ DeepSeek  │ │  ✓ DeepSeek│ │
│  │    模型       │ │    模型     │ │
│  │              │ │            │ │
│  │  [开通月卡]   │ │  [开通季卡] │ │
│  └──────────────┘ └────────────┘ │
│                                  │
│  ──────────────────────────────  │
│  或使用自己的 API Key →           │
│                                  │
└──────────────────────────────────┘
```

**文案风格：** 平实说明，无诱导性语言，无"支持开发""打赏"等表述

### 14.4 付费验证

- 付费通过爱发电（保留现有方式）
- 用户付费后在爱发电收到验证码
- 在会员计划页输入验证码 → 验证通过 → Supabase 更新用户 `is_premium` 状态
- V2.1 仍用手动 token 验证，V2.2 接入爱发电 Webhook 自动验证

### 14.5 免费体验设计

- 新用户注册后获得 10 轮免费对话
- 计数存 Supabase（按用户，非按设备）
- 10 轮用完后：
  - 体验「人物关系图」「星图」「剧情回顾」等功能（不消耗对话次数）
  - 如需继续生成新场景 → 引导到会员计划页或设置页填 Key
- 免费模型探索：后续可接入免费模型（如 Gemini Flash）作为免费用户的降级选项，V2.1 先不做

### 14.6 API Key 双通道

```
用户发起 AI 请求
    │
    ├── 用户填了自己的 API Key → 用用户 Key
    └── 用户未填 Key
         ├── 是会员 → 用系统 Key（DEEPSEEK_API_KEY 环境变量）
         └── 非会员 + 有免费次数 → 用系统 Key，扣减免费次数
         └── 非会员 + 无免费次数 → 返回付费引导
```

---

## 15. 埋点方案

### 15.1 工具

- **Vercel Analytics**：自动统计 PV/UV，零配置
- **Umami Cloud**：事件埋点 + 漏斗 + 留存分析

### 15.2 埋点事件

```typescript
// lib/analytics.ts
export function track(event: string, props?: Record<string, any>) {
  if (typeof window !== 'undefined' && window.umami) {
    window.umami.track(event, props);
  }
}
```

| 事件名 | 触发时机 | 属性 |
|--------|----------|------|
| `page_view` | 页面加载（自动） | path |
| `create_game` | 创建游戏 | game_type |
| `enter_game` | 进入游戏入口页 | game_type, has_saves |
| `start_journey` | 开始旅程 | action(new/continue/load) |
| `complete_chapter` | 完成章节 | chapter_number |
| `view_star_map` | 查看星图 | chapter_count |
| `view_relationship` | 查看关系图 | character_count |
| `view_clue_board` | 查看线索板 | clue_count |
| `view_story_review` | 查看剧情回顾 | chapters_reviewed |
| `hit_paywall` | 触发付费引导 | trigger(free_exhausted/no_key) |
| `complete_payment` | 完成付费 | plan(monthly/seasonal) |
| `save_game` | 手动存档 | chapter_number |

### 15.3 隐私说明

- Umami 不使用 Cookie，不收集个人身份信息
- 事件属性不含 email、用户 ID 等 PII
- 仅追踪匿名 session_id 和事件属性
- 暂不添加隐私说明文案（后续用户量增大后再考虑）

---

## 16. AI Prompt 设计（V2.1 扩展）

### 16.1 基础 System Prompt（所有类型通用）

```
你是一位互动小说大师。用户会给出一个故事设定，你需要：

1. 每次只生成一个场景描述（150-300字），营造强烈的画面感和沉浸感
2. 在场景描述后，提供 2-4 个选项供玩家选择
3. 选项要有实际影响力，能真正改变故事走向
4. 保持叙事连贯性，记住之前发生的所有事情
5. 文风要优美、有画面感，像优秀的小说一样
6. 根据叙事节奏自然划分章节，新章节开始时在场景描述最前面加上：
   【第N章：章节标题】
7. 如果故事到达结局，在场景描述最后加上【结局】标记，不提供选项

输出格式：

【第N章：标题】（仅新章节开始时）
[场景描述]
（空行）
选项：
A. [选项1]
B. [选项2]

[类型专属输出]（见下方）
```

### 16.2 乙游专属追加

```
[关系更新]
- 角色名：关系标签（道侣/友人/敌对/师徒等）（新增/变化/不变）
```

### 16.3 悬疑专属追加

```
[线索]
（如发现新线索，列出线索内容，自动添加到线索板）

[场景布局]
（如进入新的关键地点，输出布局数据）
地点名称：xxx
房间列表：
- 房间A（x, y, w, h）连接：[房间B]
关键物品：xxx
```

---

## 17. 页面路由总览

| 路由 | 页面 | 认证 | 说明 |
|------|------|------|------|
| `/` | 游戏空间 | 可选 | 未登录显示产品介绍 + 登录引导 |
| `/auth/login` | 登录页 | 无 | 邮箱魔法链接 |
| `/game/[id]` | 游戏入口 | 必须 | 晨光风格菜单 |
| `/play/[id]` | 阅读器 | 必须 | 核心游戏体验 |
| `/settings` | 设置 | 必须 | API Key + 主题 + 速度 |
| `/membership` | 会员计划 | 必须 | 付费方案 |

---

## 18. V2.1 范围边界

### 18.1 V2.1 包含

- Supabase 全栈架构 + RLS
- 邮箱魔法链接登录
- 游戏空间页（多游戏管理，最多5个）
- 新建游戏弹窗（选类型 + 输入设定）
- 游戏入口页（晨光风格菜单）
- 星图章节系统（2D星图 + AI自动分章）
- 存档/读档（自动 + 手动，分Tab展示）
- 记忆压缩（章节摘要 + 最近对话）
- 剧情回顾（查看任意章节完整内容）
- 人物关系图（乙游，力导向图 + 角色详情）
- 线索板（悬疑，笔记本风格 + 手动记录）
- 场景布局图（悬疑，SVG俯视图 + 下载 + 关联线索板）
- 星空背景动效（Canvas粒子系统）
- 会员计划（9.9元/月 + 24.9元/季）
- 10轮免费体验
- BYOK 支持
- 埋点（Vercel Analytics + Umami）

### 18.2 V2.1 不包含（V2.2+）

- 3D 星图
- 分支树展示
- 场景渲染图（AI生图）
- 免费模型降级
- 爱发电 Webhook 自动验证
- 微信小程序
- 云端存档跨设备同步（Supabase 已支持，但需测试）
- 背景音乐
- 社区分享

---

## 19. 技术风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| AI 输出格式不稳定 | 解析失败 | 正则容错 + 多种格式匹配 |
| 记忆压缩质量不佳 | AI 忘记关键剧情 | 摘要 Prompt 强调保留关键信息 + 可手动触发重新压缩 |
| 关系图解析延迟 | 用户体验卡顿 | 进入关系图页面时才解析，非实时更新 |
| Supabase 免费额度 | 连接数/存储限制 | 免费版 500MB 存储 + 50并发连接，V2.1 足够 |
| API 成本超支 | 利润率低 | 9.9元定价下重度用户月成本约8元，利润率约20%，可接受 |
| 星空背景性能 | 移动端卡顿 | 粒子数量自适应 + 虚拟 DOM 外渲染 |
| 魔法链接邮件延迟 | 用户等待 | Supabase 邮件通常秒到，极端情况显示"请稍候" |

---

## 20. 开发进度管理

### 20.1 变更记录

在 `docs/changelog/` 下按日期记录：
```
docs/changelog/
├── 2026-07-XX-v2.1-auth.md
├── 2026-07-XX-v2.1-supabase-setup.md
├── 2026-07-XX-v2.1-game-space.md
├── 2026-07-XX-v2.1-star-map.md
└── ...
```

每个文件记录：模块名、变更内容、新增/修改/删除的文件、已知问题。

### 20.2 Git 约定

- Commit message: `<type>(<scope>): <description>`
- 重大节点打 tag: `v2.1.0-<module>`
- 每个 PR 对应一个功能模块
- 开发分支: `dev/v2.1`，合并到 `main` 时打 tag

### 20.3 回滚策略

- 每个模块开发完成后，确保 `main` 分支可正常运行
- 如某模块引入问题，revert 该模块的 commit + tag
- Supabase schema 变更通过 migration 文件管理，可回滚
