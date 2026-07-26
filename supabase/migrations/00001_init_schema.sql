-- ============================================================
-- 织梦者 V2.1 数据库初始化
-- 日期: 2026-07-26
-- 说明: 创建所有表结构、索引、RLS 策略
-- ============================================================

-- ------------------------------------------------------------
-- 1. 用户资料表（扩展 auth.users）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  membership_plan TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'monthly' | 'quarterly'
  membership_expires_at TIMESTAMPTZ,
  free_trial_used INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 新用户注册时自动创建 user_profiles 记录
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- 2. 游戏表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',  -- 'otome' | 'mystery' | 'other'
  setting TEXT NOT NULL,
  cover_color TEXT DEFAULT '#c8aaff',
  status TEXT DEFAULT 'active',         -- 'active' | 'completed' | 'archived'
  last_played_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_games_user_id ON public.games(user_id);
CREATE INDEX IF NOT EXISTS idx_games_last_played ON public.games(last_played_at DESC);

-- updated_at 自动更新
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS games_updated_at ON public.games;
CREATE TRIGGER games_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ------------------------------------------------------------
-- 3. 章节表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
  chapter_number INT NOT NULL,
  title TEXT,
  summary TEXT,                          -- 压缩摘要
  status TEXT DEFAULT 'in_progress',     -- 'in_progress' | 'completed'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chapters_game_id ON public.chapters(game_id);

-- ------------------------------------------------------------
-- 4. 场景表（存完整对话）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE NOT NULL,
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  options JSONB,                         -- [{label, text}]
  ai_raw_response TEXT,                  -- AI原始回复（含关系更新等）
  is_ending BOOLEAN DEFAULT false,
  order_index INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scenes_game_id ON public.scenes(game_id);
CREATE INDEX IF NOT EXISTS idx_scenes_chapter_id ON public.scenes(chapter_id);
CREATE INDEX IF NOT EXISTS idx_scenes_order ON public.scenes(game_id, order_index);

-- ------------------------------------------------------------
-- 5. 存档表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES public.chapters(id),
  scene_index INT NOT NULL,
  label TEXT NOT NULL,                   -- 'auto' | 用户自定义名称
  save_type TEXT DEFAULT 'manual',       -- 'auto' | 'manual'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saves_game_id ON public.saves(game_id);
CREATE INDEX IF NOT EXISTS idx_saves_type ON public.saves(game_id, save_type);

-- ------------------------------------------------------------
-- 6. 角色表（关系图）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  role TEXT DEFAULT 'minor',             -- 'protagonist' | 'major' | 'minor'
  first_appearance_chapter INT,
  avatar_color TEXT DEFAULT '#c8aaff',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_characters_game_id ON public.characters(game_id);

-- ------------------------------------------------------------
-- 7. 关系表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
  character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL,
  relation_label TEXT NOT NULL,          -- '道侣' | '友人' | '敌对' | '师徒' 等
  previous_label TEXT,                   -- 变化前的关系
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_relationships_game_id ON public.relationships(game_id);
CREATE INDEX IF NOT EXISTS idx_relationships_character ON public.relationships(character_id);

-- ------------------------------------------------------------
-- 8. 地图表（悬疑，先建表以供线索引用）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES public.chapters(id),
  title TEXT NOT NULL,
  layout_data JSONB NOT NULL,             -- {rooms: [{name, x, y, w, h, connections: []}]}
  svg_content TEXT,                       -- 渲染后的SVG
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maps_game_id ON public.maps(game_id);

-- ------------------------------------------------------------
-- 9. 线索表（悬疑）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  note TEXT,                              -- 用户手动备注
  map_id UUID REFERENCES public.maps(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clues_game_id ON public.clues(game_id);

-- ============================================================
-- RLS 策略（Row Level Security）
-- ============================================================

-- 启用 RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clues ENABLE ROW LEVEL SECURITY;

-- user_profiles: 用户只能读写自己的资料
DROP POLICY IF EXISTS "user_profiles_owner" ON public.user_profiles;
CREATE POLICY "user_profiles_owner" ON public.user_profiles
  FOR ALL USING (id = auth.uid());

-- games: 用户只能 CRUD 自己的游戏
DROP POLICY IF EXISTS "games_owner" ON public.games;
CREATE POLICY "games_owner" ON public.games
  FOR ALL USING (user_id = auth.uid());

-- chapters: 通过 game_id 关联验证
DROP POLICY IF EXISTS "chapters_via_game" ON public.chapters;
CREATE POLICY "chapters_via_game" ON public.chapters
  FOR ALL USING (
    game_id IN (SELECT id FROM public.games WHERE user_id = auth.uid())
  );

-- scenes: 通过 game_id 关联验证
DROP POLICY IF EXISTS "scenes_via_game" ON public.scenes;
CREATE POLICY "scenes_via_game" ON public.scenes
  FOR ALL USING (
    game_id IN (SELECT id FROM public.games WHERE user_id = auth.uid())
  );

-- saves: 通过 game_id 关联验证
DROP POLICY IF EXISTS "saves_via_game" ON public.saves;
CREATE POLICY "saves_via_game" ON public.saves
  FOR ALL USING (
    game_id IN (SELECT id FROM public.games WHERE user_id = auth.uid())
  );

-- characters: 通过 game_id 关联验证
DROP POLICY IF EXISTS "characters_via_game" ON public.characters;
CREATE POLICY "characters_via_game" ON public.characters
  FOR ALL USING (
    game_id IN (SELECT id FROM public.games WHERE user_id = auth.uid())
  );

-- relationships: 通过 game_id 关联验证
DROP POLICY IF EXISTS "relationships_via_game" ON public.relationships;
CREATE POLICY "relationships_via_game" ON public.relationships
  FOR ALL USING (
    game_id IN (SELECT id FROM public.games WHERE user_id = auth.uid())
  );

-- maps: 通过 game_id 关联验证
DROP POLICY IF EXISTS "maps_via_game" ON public.maps;
CREATE POLICY "maps_via_game" ON public.maps
  FOR ALL USING (
    game_id IN (SELECT id FROM public.games WHERE user_id = auth.uid())
  );

-- clues: 通过 game_id 关联验证
DROP POLICY IF EXISTS "clues_via_game" ON public.clues;
CREATE POLICY "clues_via_game" ON public.clues
  FOR ALL USING (
    game_id IN (SELECT id FROM public.games WHERE user_id = auth.uid())
  );

-- ============================================================
-- 完成
-- ============================================================
