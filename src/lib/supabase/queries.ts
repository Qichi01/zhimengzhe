import { createClient } from "./client";
import type {
  Game,
  Chapter,
  SceneRecord,
  Save,
  Character,
  Relationship,
  Clue,
  GameMap,
  UserProfile,
  GameType,
} from "@/types";

// ============================================================
// 游戏相关查询
// ============================================================

/** 获取用户的所有游戏（分页，按最近游玩排序） */
export async function getGames(
  userId: string,
  page = 1,
  pageSize = 8
): Promise<{ data: Game[] | null; count: number | null; error: string | null }> {
  const supabase = createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("games")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("last_played_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (error) return { data: null, count: null, error: error.message };
  return { data: data as Game[], count, error: null };
}

/** 获取单个游戏详情 */
export async function getGame(
  gameId: string
): Promise<{ data: Game | null; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Game, error: null };
}

/** 创建新游戏 */
export async function createGame(
  userId: string,
  title: string,
  type: GameType,
  setting: string,
  coverColor = "#c8aaff"
): Promise<{ data: Game | null; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("games")
    .insert({
      user_id: userId,
      title,
      type,
      setting,
      cover_color: coverColor,
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Game, error: null };
}

/** 更新游戏最后游玩时间 */
export async function touchGame(gameId: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("games")
    .update({ last_played_at: new Date().toISOString() })
    .eq("id", gameId);
}

/** 删除游戏（级联删除所有关联数据） */
export async function deleteGame(
  gameId: string
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("games").delete().eq("id", gameId);
  return { error: error?.message ?? null };
}

// ============================================================
// 章节相关查询
// ============================================================

/** 获取游戏的所有章节 */
export async function getChapters(
  gameId: string
): Promise<{ data: Chapter[] | null; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chapters")
    .select("*")
    .eq("game_id", gameId)
    .order("chapter_number", { ascending: true });

  if (error) return { data: null, error: error.message };
  return { data: data as Chapter[], error: null };
}

/** 创建新章节 */
export async function createChapter(
  gameId: string,
  chapterNumber: number,
  title?: string
): Promise<{ data: Chapter | null; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chapters")
    .insert({
      game_id: gameId,
      chapter_number: chapterNumber,
      title: title ?? null,
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Chapter, error: null };
}

/** 更新章节摘要（记忆压缩） */
export async function updateChapterSummary(
  chapterId: string,
  summary: string
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("chapters")
    .update({ summary, status: "completed" })
    .eq("id", chapterId);
  return { error: error?.message ?? null };
}

// ============================================================
// 场景相关查询
// ============================================================

/** 获取游戏的全部场景（按顺序） */
export async function getScenes(
  gameId: string
): Promise<{ data: SceneRecord[] | null; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scenes")
    .select("*")
    .eq("game_id", gameId)
    .order("order_index", { ascending: true });

  if (error) return { data: null, error: error.message };
  return { data: data as SceneRecord[], error: null };
}

/** 获取某章节的场景 */
export async function getScenesByChapter(
  chapterId: string
): Promise<{ data: SceneRecord[] | null; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scenes")
    .select("*")
    .eq("chapter_id", chapterId)
    .order("order_index", { ascending: true });

  if (error) return { data: null, error: error.message };
  return { data: data as SceneRecord[], error: null };
}

/** 创建场景记录 */
export async function createScene(
  scene: Omit<SceneRecord, "id" | "created_at">
): Promise<{ data: SceneRecord | null; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scenes")
    .insert(scene)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as SceneRecord, error: null };
}

/** 获取游戏下一个 order_index */
export async function getNextSceneIndex(
  gameId: string
): Promise<number> {
  const supabase = createClient();
  const { data } = await supabase
    .from("scenes")
    .select("order_index")
    .eq("game_id", gameId)
    .order("order_index", { ascending: false })
    .limit(1);

  if (data && data.length > 0) return data[0].order_index + 1;
  return 0;
}

// ============================================================
// 存档相关查询
// ============================================================

/** 获取游戏的存档列表 */
export async function getSaves(
  gameId: string,
  saveType?: "auto" | "manual"
): Promise<{ data: Save[] | null; error: string | null }> {
  const supabase = createClient();
  let query = supabase
    .from("saves")
    .select("*")
    .eq("game_id", gameId)
    .order("created_at", { ascending: false });

  if (saveType) query = query.eq("save_type", saveType);

  const { data, error } = await query;
  if (error) return { data: null, error: error.message };
  return { data: data as Save[], error: null };
}

/** 创建存档 */
export async function createSave(
  gameId: string,
  chapterId: string | null,
  sceneIndex: number,
  label: string,
  saveType: "auto" | "manual"
): Promise<{ data: Save | null; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("saves")
    .insert({
      game_id: gameId,
      chapter_id: chapterId,
      scene_index: sceneIndex,
      label,
      save_type: saveType,
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Save, error: null };
}

/** 删除存档 */
export async function deleteSave(saveId: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("saves").delete().eq("id", saveId);
  return { error: error?.message ?? null };
}

/** 清理旧自动存档（保留最近 N 个） */
export async function pruneAutoSaves(
  gameId: string,
  keepCount = 10
): Promise<void> {
  const { data } = await getSaves(gameId, "auto");
  if (!data || data.length <= keepCount) return;

  const toDelete = data.slice(keepCount);
  const supabase = createClient();
  for (const save of toDelete) {
    await supabase.from("saves").delete().eq("id", save.id);
  }
}

// ============================================================
// 角色与关系相关查询
// ============================================================

/** 获取游戏的所有角色 */
export async function getCharacters(
  gameId: string
): Promise<{ data: Character[] | null; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("game_id", gameId)
    .order("created_at", { ascending: true });

  if (error) return { data: null, error: error.message };
  return { data: data as Character[], error: null };
}

/** 创建或更新角色 */
export async function upsertCharacter(
  character: Omit<Character, "id" | "created_at">
): Promise<{ data: Character | null; error: string | null }> {
  const supabase = createClient();

  // 先查找同名角色
  const { data: existing } = await supabase
    .from("characters")
    .select("*")
    .eq("game_id", character.game_id)
    .eq("name", character.name)
    .maybeSingle();

  if (existing) {
    // 更新
    const { data, error } = await supabase
      .from("characters")
      .update({
        description: character.description,
        role: character.role,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Character, error: null };
  }

  // 新建
  const { data, error } = await supabase
    .from("characters")
    .insert(character)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Character, error: null };
}

/** 获取游戏的所有关系 */
export async function getRelationships(
  gameId: string
): Promise<{ data: Relationship[] | null; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("relationships")
    .select("*")
    .eq("game_id", gameId)
    .order("updated_at", { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: data as Relationship[], error: null };
}

/** 创建或更新关系 */
export async function upsertRelationship(
  gameId: string,
  characterId: string,
  relationLabel: string
): Promise<{ error: string | null }> {
  const supabase = createClient();

  // 先查找是否已有关系记录
  const { data: existing } = await supabase
    .from("relationships")
    .select("*")
    .eq("game_id", gameId)
    .eq("character_id", characterId)
    .maybeSingle();

  if (existing) {
    // 更新关系
    if (existing.relation_label === relationLabel) return { error: null };

    const { error } = await supabase
      .from("relationships")
      .update({
        previous_label: existing.relation_label,
        relation_label: relationLabel,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    return { error: error?.message ?? null };
  }

  // 新建
  const { error } = await supabase.from("relationships").insert({
    game_id: gameId,
    character_id: characterId,
    relation_label: relationLabel,
  });
  return { error: error?.message ?? null };
}

// ============================================================
// 线索相关查询（悬疑）
// ============================================================

/** 获取游戏的线索列表 */
export async function getClues(
  gameId: string
): Promise<{ data: Clue[] | null; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clues")
    .select("*")
    .eq("game_id", gameId)
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: data as Clue[], error: null };
}

/** 创建线索 */
export async function createClue(
  gameId: string,
  content: string,
  note?: string
): Promise<{ data: Clue | null; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clues")
    .insert({ game_id: gameId, content, note: note ?? null })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Clue, error: null };
}

/** 更新线索备注 */
export async function updateClueNote(
  clueId: string,
  note: string
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("clues")
    .update({ note })
    .eq("id", clueId);
  return { error: error?.message ?? null };
}

/** 删除线索 */
export async function deleteClue(clueId: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("clues").delete().eq("id", clueId);
  return { error: error?.message ?? null };
}

// ============================================================
// 地图相关查询（悬疑）
// ============================================================

/** 获取游戏的地图列表 */
export async function getMaps(
  gameId: string
): Promise<{ data: GameMap[] | null; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("maps")
    .select("*")
    .eq("game_id", gameId)
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: data as GameMap[], error: null };
}

/** 创建地图 */
export async function createMap(
  gameId: string,
  title: string,
  layoutData: object,
  chapterId?: string,
  svgContent?: string
): Promise<{ data: GameMap | null; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("maps")
    .insert({
      game_id: gameId,
      chapter_id: chapterId ?? null,
      title,
      layout_data: layoutData,
      svg_content: svgContent ?? null,
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as GameMap, error: null };
}

// ============================================================
// 用户资料查询
// ============================================================

/** 获取用户会员资料 */
export async function getUserProfile(
  userId: string
): Promise<{ data: UserProfile | null; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data as UserProfile | null, error: null };
}

/** 更新免费体验次数 */
export async function incrementFreeTrial(
  userId: string
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("free_trial_used")
    .eq("id", userId)
    .single();

  if (!profile) return { error: "profile not found" };

  const { error } = await supabase
    .from("user_profiles")
    .update({ free_trial_used: profile.free_trial_used + 1 })
    .eq("id", userId);
  return { error: error?.message ?? null };
}

/** 更新会员状态 */
export async function updateMembership(
  userId: string,
  plan: "monthly" | "quarterly"
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const now = new Date();
  const expiresAt = new Date(now);
  if (plan === "monthly") expiresAt.setMonth(expiresAt.getMonth() + 1);
  else expiresAt.setMonth(expiresAt.getMonth() + 3);

  const { error } = await supabase
    .from("user_profiles")
    .update({
      membership_plan: plan,
      membership_expires_at: expiresAt.toISOString(),
    })
    .eq("id", userId);
  return { error: error?.message ?? null };
}
