"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import StarfieldBackground from "@/components/StarfieldBackground";
import SaveList from "@/components/GameMenu/SaveList";
import StarMap from "@/components/StarMap";
import RelationshipGraph from "@/components/RelationshipGraph";
import ClueBoard from "@/components/ClueBoard";
import {
  getGame,
  getSaves,
  deleteSave,
  getChapters,
  getScenes,
  getCharacters,
  getRelationships,
  clearGameData,
  upsertCharacter,
  claimCharacterAvatarAutoGeneration,
  getDeviceId,
  setGeneratedCharacterAvatarIfEmpty,
} from "@/lib/localDb";
import { generateCharacterAvatar } from "@/lib/avatarAssets";
import { track } from "@/lib/analytics";
import type { Game, Save, Chapter, SceneRecord, Character, Relationship } from "@/types";

const MAX_AUTOMATIC_AVATARS_PER_VISIT = 6;

async function generateMissingDefaultAvatars(
  game: Game,
  characters: Character[],
  onUpdated: (character: Character) => void
) {
  const candidates = characters
    .filter(
      (character) =>
        (character.role === "protagonist" || character.role === "major") &&
        !character.avatar &&
        !character.avatar_auto_attempted_at
    )
    .slice(0, MAX_AUTOMATIC_AVATARS_PER_VISIT);

  for (const character of candidates) {
    const claim = await claimCharacterAvatarAutoGeneration(character.id);
    if (!claim.claimed || !claim.data) continue;

    try {
      const avatar = await generateCharacterAvatar({
        characterName: claim.data.name,
        description: claim.data.description,
        gameType: game.type,
        storySetting: game.setting,
        deviceId: getDeviceId(),
      });
      const saved = await setGeneratedCharacterAvatarIfEmpty(
        claim.data.id,
        avatar
      );
      if (saved.data) onUpdated(saved.data);
    } catch {
      // 自动生成只尝试一次；失败保留首字头像，用户仍可手动重试或上传。
    }
  }
}

export default function GameMenuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [game, setGame] = useState<Game | null>(null);
  const [saves, setSaves] = useState<Save[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [scenes, setScenes] = useState<SceneRecord[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSaveList, setShowSaveList] = useState(false);
  const [showStarMap, setShowStarMap] = useState(false);
  const [showRelationships, setShowRelationships] = useState(false);
  const [showClueBoard, setShowClueBoard] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const { data: gameData } = await getGame(id);
      if (!gameData) {
        router.push("/");
        return;
      }
      setGame(gameData);

      const { data: saveData } = await getSaves(id);
      setSaves(saveData ?? []);

      const { data: chapterData } = await getChapters(id);
      setChapters(chapterData ?? []);

      const { data: sceneData } = await getScenes(id);
      setScenes(sceneData ?? []);

      const { data: charData } = await getCharacters(id);
      let loadedCharacters = charData ?? [];
      if (
        gameData.type === "otome" &&
        !loadedCharacters.some((character) => character.role === "protagonist")
      ) {
        const protagonistResult = await upsertCharacter({
          game_id: id,
          name: "主角",
          description: "玩家在故事中的角色",
          role: "protagonist",
          first_appearance_chapter: 1,
          avatar_color: "#ffd76b",
        });
        if (protagonistResult.data) {
          const protagonist = protagonistResult.data;
          loadedCharacters = [protagonist, ...loadedCharacters];
        }
      }
      setCharacters(loadedCharacters);
      void generateMissingDefaultAvatars(
        gameData,
        loadedCharacters,
        (updatedCharacter) => {
          setCharacters((current) =>
            current.map((character) =>
              character.id === updatedCharacter.id ? updatedCharacter : character
            )
          );
        }
      );

      const { data: relData } = await getRelationships(id);
      setRelationships(relData ?? []);

      setLoading(false);
    };
    loadData();
  }, [id, router]);

  const handleLoadSave = (save: Save) => {
    track("start_journey", { action: "load" });
    router.push(`/play/${id}?save=${save.id}`);
  };

  const handleDeleteSave = async (saveId: string) => {
    await deleteSave(saveId);
    setSaves((prev) => prev.filter((s) => s.id !== saveId));
  };

  const handleStartNew = async () => {
    if (!game) return;
    if (saves.length > 0) {
      if (!confirm("开始新游戏将清空当前存档和进度，确定吗？")) return;
    }
    // 清空旧进度数据（场景、章节、存档、角色、关系、线索、地图）
    await clearGameData(id);
    track("start_journey", { action: "new" });
    router.push(`/play/${id}`);
  };

  const hasSaves = saves.length > 0;
  const latestSave = saves[0]; // saves 已按 created_at desc 排序

  if (loading || !game) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background:
            "radial-gradient(ellipse at 50% 32%, #2e2b4e 0%, #1e1b2e 55%, #14111e 100%)",
        }}
      >
        <div
          className="inline-block w-10 h-10 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "#c8aaff", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  // 菜单项配置
  type MenuItem = {
    label: string;
    icon: string;
    onClick: () => void;
    show: boolean;
  };

  const menuItems: MenuItem[] = [
    {
      label: "继续旅程",
      icon: "▶",
      onClick: () => {
        if (latestSave) {
          track("start_journey", { action: "continue" });
          handleLoadSave(latestSave);
        }
      },
      show: hasSaves,
    },
    {
      label: "新的开始",
      icon: "✦",
      onClick: handleStartNew,
      show: true,
    },
    {
      label: "读取存档",
      icon: "⏏",
      onClick: () => setShowSaveList(true),
      show: hasSaves,
    },
    {
      label: "章节星图",
      icon: "✧",
      onClick: () => {
        track("view_star_map", { chapter_count: chapters.length });
        setShowStarMap(true);
      },
      show: chapters.length > 0,
    },
    {
      label: "剧情回顾",
      icon: "❀",
      onClick: () => {
        track("view_story_review", { chapters_reviewed: chapters.length });
        router.push(`/play/${id}?review=true`);
      },
      show: scenes.length > 0,
    },
    {
      label: "人物关系图",
      icon: "⚛",
      onClick: () => {
        track("view_relationship", { character_count: characters.length });
        setShowRelationships(true);
      },
      show: game.type === "otome" && characters.length > 0,
    },
    {
      label: "线索板",
      icon: "✧",
      onClick: () => {
        track("view_clue_board", { clue_count: 0 });
        setShowClueBoard(true);
      },
      show: game.type === "mystery",
    },
    {
      label: "返回空间",
      icon: "←",
      onClick: () => router.push("/"),
      show: true,
    },
  ];

  return (
    <div
      className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center"
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #2e2b4e 0%, #1e1b2e 55%, #14111e 100%)",
      }}
    >
      <StarfieldBackground density="sparse" />

      {/* 返回按钮 */}
      <button
        onClick={() => router.push("/")}
        className="absolute top-5 left-5 z-20 flex items-center gap-1.5 text-sm transition-opacity hover:opacity-80"
        style={{ color: "rgba(213,184,245,0.5)" }}
      >
        <span>←</span>
        返回空间
      </button>

      {/* 游戏标题 */}
      <div className="relative z-10 text-center mb-12 px-6">
        <div
          className="text-3xl mb-2"
          style={{ color: game.cover_color, textShadow: `0 0 30px ${game.cover_color}80` }}
        >
          ✦
        </div>
        <h1
          className="text-3xl sm:text-4xl font-bold tracking-wider mb-2"
          style={{
            color: "#e8d5f5",
            textShadow:
              "0 0 30px rgba(200,170,255,0.4), 0 0 70px rgba(200,170,255,0.2)",
          }}
        >
          {game.title}
        </h1>
        {/* 设定预览 */}
        <p
          className="text-sm leading-relaxed max-w-md mx-auto line-clamp-2"
          style={{ color: "rgba(213,184,245,0.5)" }}
        >
          {game.setting}
        </p>
      </div>

      {/* 菜单列表 */}
      <nav className="relative z-10 flex flex-col gap-3 w-full max-w-xs px-6">
        {menuItems.filter((item) => item.show).map((item, idx) => (
          <button
            key={idx}
            onClick={item.onClick}
            className="group flex items-center gap-4 rounded-2xl px-6 py-4 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_4px_30px_rgba(200,170,255,0.15)]"
            style={{
              background: "rgba(200,170,255,0.05)",
              border: "1px solid rgba(200,170,255,0.12)",
            }}
          >
            <span
              className="text-lg w-6 text-center transition-transform group-hover:scale-110"
              style={{ color: "#c8aaff" }}
            >
              {item.icon}
            </span>
            <span
              className="text-base font-medium tracking-wide"
              style={{ color: "#e8d5f5" }}
            >
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      {/* 存档列表弹窗 */}
      {showSaveList && (
        <SaveList
          saves={saves}
          onLoad={handleLoadSave}
          onDelete={handleDeleteSave}
          onClose={() => setShowSaveList(false)}
        />
      )}

      {/* 章节星图 */}
      {showStarMap && (
        <StarMap
          chapters={chapters}
          scenes={scenes}
          onClose={() => setShowStarMap(false)}
        />
      )}

      {/* 人物关系图 */}
      {showRelationships && (
        <RelationshipGraph
          characters={characters}
          relationships={relationships}
          protagonistName="主角"
          gameType={game.type}
          storySetting={game.setting}
          onCharacterUpdated={(updatedCharacter) => {
            setCharacters((current) =>
              current.map((character) =>
                character.id === updatedCharacter.id ? updatedCharacter : character
              )
            );
          }}
          onClose={() => setShowRelationships(false)}
        />
      )}

      {/* 线索板 */}
      {showClueBoard && (
        <ClueBoard
          gameId={id}
          onClose={() => setShowClueBoard(false)}
        />
      )}
    </div>
  );
}
