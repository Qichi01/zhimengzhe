"use client";

import { useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StoryReader from "@/components/StoryReader";
import { getGame, getScenes, getSaves, getChapters } from "@/lib/localDb";
import type { Game, SceneRecord, Chapter, Save } from "@/types";

export default function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [game, setGame] = useState<Game | null>(null);
  const [scenes, setScenes] = useState<SceneRecord[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [savePoint, setSavePoint] = useState<Save | null>(null);
  const [loading, setLoading] = useState(true);

  const saveId = searchParams.get("save");
  const reviewMode = searchParams.get("review") === "true";

  useEffect(() => {
    const loadData = async () => {
      // 加载游戏信息
      const { data: gameData } = await getGame(id);
      if (!gameData) {
        router.push("/");
        return;
      }
      setGame(gameData);

      // 加载章节
      const { data: chapterData } = await getChapters(id);
      setChapters(chapterData ?? []);

      if (saveId) {
        // 从存档加载：加载场景并截取到存档点
        const { data: sceneData } = await getScenes(id);
        const { data: saves } = await getSaves(id);
        const save = saves?.find((s) => s.id === saveId);
        if (save) {
          setSavePoint(save);
          setScenes((sceneData ?? []).filter((s) => s.order_index <= save.scene_index));
        } else {
          setScenes(sceneData ?? []);
        }
      } else {
        // 新的开始：不加载历史场景，从空开始
        setScenes([]);
      }

      setLoading(false);
    };
    loadData();
  }, [id, router, saveId]);

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

  return (
    <StoryReader
      gameId={id}
      game={game}
      initialScenes={scenes}
      initialChapters={chapters}
      savePoint={savePoint}
      reviewMode={reviewMode}
      onExit={() => router.push(`/game/${id}`)}
    />
  );
}
