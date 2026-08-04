"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import { useUserStore } from "@/stores/userStore";
import { themes } from "@/lib/themes";
import { parseAIResponse, stripInternalMetadata } from "@/lib/parser";
import { buildSystemPrompt, buildInitialUserMessage, buildChoiceMessage } from "@/lib/prompts";
import { buildContext, shouldCompress, getScenesToCompress, compressScenes } from "@/lib/contextBuilder";
import { track } from "@/lib/analytics";
import {
  decideIllustration,
  generateSceneIllustration,
} from "@/lib/illustrations";
import { generateCharacterAvatar } from "@/lib/avatarAssets";
import TypewriterText from "./TypewriterText";
import OptionButtons from "./OptionButtons";
import {
  createScene,
  getNextSceneIndex,
  createChapter,
  touchGame,
  upsertCharacter,
  upsertRelationship,
  createMap,
  createSave,
  pruneAutoSaves,
  updateChapterSummary,
  getDeviceId,
  getSaves,
  deleteSave,
  updateSceneIllustration,
  setGeneratedCharacterAvatarIfEmpty,
} from "@/lib/localDb";
import SaveList from "./GameMenu/SaveList";
import type {
  Game,
  SceneRecord,
  Chapter,
  Save,
  ChatMessage,
  Option,
  Theme,
  TypewriterSpeed,
  SceneIllustration,
} from "@/types";

interface StoryReaderProps {
  gameId: string;
  game: Game;
  initialScenes: SceneRecord[];
  initialChapters: Chapter[];
  savePoint: Save | null;
  reviewMode?: boolean;
  onExit?: () => void;
}

const SPEED_OPTIONS: TypewriterSpeed[] = ["slow", "medium", "fast"];

interface DisplayScene {
  id: string;
  content: string;
  options: Option[];
  isEnding: boolean;
  chapterTitle?: string;
  illustration?: SceneIllustration | null;
  isIllustrationLoading?: boolean;
}

/**
 * V2.1 核心阅读器组件
 * - 从 Supabase 加载历史场景
 * - 支持 AI 流式响应 + 章节解析 + 类型专属功能
 * - 场景写入 Supabase 持久化
 */
export default function StoryReader({
  gameId,
  game,
  initialScenes,
  initialChapters,
  savePoint,
  reviewMode = false,
  onExit,
}: StoryReaderProps) {
  // ---- 用户状态 ----
  const apiKey = useUserStore((s) => s.apiKey);
  const providerId = useUserStore((s) => s.providerId);
  const modelId = useUserStore((s) => s.modelId);
  const themeId = useUserStore((s) => s.themeId);
  const typewriterSpeed = useUserStore((s) => s.typewriterSpeed);
  const illustrationsEnabled = useUserStore((s) => s.illustrationsEnabled);
  const setThemeId = useUserStore((s) => s.setThemeId);
  const setTypewriterSpeed = useUserStore((s) => s.setTypewriterSpeed);
  const setIllustrationsEnabled = useUserStore((s) => s.setIllustrationsEnabled);

  const theme: Theme = themes[themeId] ?? themes["dream-light"];

  // ---- 场景状态 ----
  // 将 SceneRecord 转换为显示用的 DisplayScene
  const [scenes, setScenes] = useState<DisplayScene[]>(() =>
    initialScenes.map((s) => ({
      id: s.id,
      content: stripInternalMetadata(s.content),
      options: s.options ?? [],
      isEnding: s.is_ending,
      illustration: s.illustration ?? null,
    }))
  );

  // 保留原始 SceneRecord（用于上下文构建和压缩）
  const [rawScenes, setRawScenes] = useState<SceneRecord[]>(initialScenes);

  // ---- 消息历史（发给 AI，使用优化的上下文构建） ----
  const systemPrompt = buildSystemPrompt(game.type);
  const initialUserMessage = buildInitialUserMessage(game.setting);

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    buildContext({
      systemPrompt,
      initialUserMessage,
      chapters: initialChapters,
      scenes: initialScenes,
    })
  );

  const [chapters, setChapters] = useState<Chapter[]>(initialChapters);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typingDone, setTypingDone] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSaveList, setShowSaveList] = useState(false);
  const [saveList, setSaveList] = useState<Save[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const hasStartedRef = useRef(false);
  const lastIllustrationRequestIndexRef = useRef(
    initialScenes.reduce(
      (latest, scene) => scene.illustration ? Math.max(latest, scene.order_index) : latest,
      Number.NEGATIVE_INFINITY
    )
  );

  const latestScene: DisplayScene | undefined = scenes[scenes.length - 1];
  const isEnding = Boolean(latestScene?.isEnding);

  // 新场景到来时重置打字完成状态
  const [prevSceneId, setPrevSceneId] = useState<string | undefined>(
    latestScene?.id
  );
  if (latestScene?.id !== prevSceneId) {
    setPrevSceneId(latestScene?.id);
    setTypingDone(false);
  }

  // ---- Toast 辅助 ----
  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  // ---- 自动滚动
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [latestScene?.id, typingDone, isLoading]);

  // ---- 当前章节追踪 ----
  const currentChapterRef = useRef<Chapter | null>(
    chapters.length > 0 ? chapters[chapters.length - 1] : null
  );

  // ---- 核心：调用 AI（流式） ----
  const callAI = useCallback(
    async (msgs: ChatMessage[]) => {
      if (reviewMode) return; // 回顾模式不调用 AI

      setError(null);
      setPaused(false);
      setIsLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: msgs,
            apiKey: apiKey || "",
            deviceId: getDeviceId(),
            providerId,
            modelId,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          let msg = "梦境暂时中断，请稍后重试";
          try {
            const data = await res.json();
            if (data?.error) {
              msg = data.error;
            }
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }

        if (!res.body) throw new Error("无法接收响应流");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let full = "";
        let streamDone = false;

        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) {
            streamDone = true;
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const delta: unknown = json?.choices?.[0]?.delta?.content;
              if (typeof delta === "string") full += delta;
            } catch {
              /* ignore */
            }
          }
        }

        // 冲刷剩余字节
        buffer += decoder.decode();
        const tail = buffer.trim();
        if (tail.startsWith("data:")) {
          const data = tail.slice(5).trim();
          if (data && data !== "[DONE]") {
            try {
              const json = JSON.parse(data);
              const delta: unknown = json?.choices?.[0]?.delta?.content;
              if (typeof delta === "string") full += delta;
            } catch {
              /* ignore */
            }
          }
        }

        if (!full.trim()) {
          throw new Error("AI 未返回任何内容，请重试");
        }

        // 解析 AI 回复
        const parsed = parseAIResponse(full);

        const orderIndex = await getNextSceneIndex(gameId);
        const isNewChapter = Boolean(
          parsed.chapterMarker &&
            !chapters.some(
              (chapter) => chapter.chapter_number === parsed.chapterMarker!.number
            )
        );
        const illustrationDecision = decideIllustration({
          enabled: illustrationsEnabled,
          orderIndex,
          isNewChapter,
          parsed,
          existingScenes: rawScenes,
          lastRequestedIndex: lastIllustrationRequestIndexRef.current,
        });
        if (illustrationDecision.shouldGenerate) {
          lastIllustrationRequestIndexRef.current = orderIndex;
        }
        const illustrationPromise =
          illustrationDecision.shouldGenerate && illustrationDecision.reason
            ? generateSceneIllustration({
                gameType: game.type,
                storySetting: game.setting,
                sceneContent: parsed.content,
                reason: illustrationDecision.reason,
                deviceId: getDeviceId(),
              })
            : null;

        // 处理章节标记
        let chapterTitle: string | undefined;
        if (parsed.chapterMarker) {
          const existingChapter = chapters.find(
            (c) => c.chapter_number === parsed.chapterMarker!.number
          );
          if (!existingChapter) {
            // 新章节开始 → 压缩上一章
            const prevChapter = currentChapterRef.current;
            if (prevChapter && !prevChapter.summary) {
              // 异步压缩上一章，不阻塞当前流程
              void (async () => {
                const scenesToCompress = getScenesToCompress(rawScenes, prevChapter);
                if (scenesToCompress.length > 0) {
                  const { summary } = await compressScenes(
                    scenesToCompress,
                    prevChapter.title,
                    apiKey,
                    providerId,
                    modelId
                  );
                  if (summary) {
                    await updateChapterSummary(prevChapter.id, summary);
                    // 更新本地章节状态
                    setChapters((prev) =>
                      prev.map((c) =>
                        c.id === prevChapter.id
                          ? { ...c, summary, status: "completed" as const }
                          : c
                      )
                    );
                  }
                }
              })();
            }

            // 创建新章节
            const { data: newChapter } = await createChapter(
              gameId,
              parsed.chapterMarker.number,
              parsed.chapterMarker.title
            );
            if (newChapter) {
              setChapters((prev) => [...prev, newChapter]);
              currentChapterRef.current = newChapter;
              // 上一章完成，触发埋点
              if (parsed.chapterMarker.number > 1) {
                track("complete_chapter", {
                  chapter_number: parsed.chapterMarker.number - 1,
                });
              }
            }
          } else {
            currentChapterRef.current = existingChapter;
          }
          chapterTitle = parsed.chapterMarker.title;
        }

        // 写入场景到 Supabase
        const currentChapter = currentChapterRef.current;
        const { data: sceneRecord } = await createScene({
          chapter_id: currentChapter?.id ?? "",
          game_id: gameId,
          content: parsed.content,
          options: parsed.options.length > 0 ? parsed.options : null,
          ai_raw_response: full,
          is_ending: parsed.isEnding,
          order_index: orderIndex,
        });

        // 构建完整的 SceneRecord
        const newRawScene: SceneRecord = sceneRecord ?? {
          id: `temp-${Date.now()}`,
          chapter_id: currentChapter?.id ?? "",
          game_id: gameId,
          content: parsed.content,
          options: parsed.options.length > 0 ? parsed.options : null,
          ai_raw_response: full,
          is_ending: parsed.isEnding,
          order_index: orderIndex,
          created_at: new Date().toISOString(),
        };

        // 更新原始场景数据
        setRawScenes((prev) => [...prev, newRawScene]);

        // 更新 UI
        const displayScene: DisplayScene = {
          id: newRawScene.id,
          content: parsed.content,
          options: parsed.options,
          isEnding: parsed.isEnding,
          chapterTitle,
          illustration: null,
          isIllustrationLoading: Boolean(illustrationPromise),
        };
        setScenes((prev) => [...prev, displayScene]);

        // 配图与章节/关系等后处理并行。失败时只移除占位，不中断正文。
        if (illustrationPromise) {
          void illustrationPromise
            .then(async (illustration) => {
              await updateSceneIllustration(newRawScene.id, illustration);
              setRawScenes((prev) =>
                prev.map((scene) =>
                  scene.id === newRawScene.id
                    ? { ...scene, illustration }
                    : scene
                )
              );
              setScenes((prev) =>
                prev.map((scene) =>
                  scene.id === newRawScene.id
                    ? { ...scene, illustration, isIllustrationLoading: false }
                    : scene
                )
              );
            })
            .catch(() => {
              setScenes((prev) =>
                prev.map((scene) =>
                  scene.id === newRawScene.id
                    ? { ...scene, isIllustrationLoading: false }
                    : scene
                )
              );
            });
        }

        // 更新消息历史（追加 assistant 回复）
        setMessages((prev) => [...prev, { role: "assistant", content: full }]);

        // 检测是否需要压缩当前章节（场景过多时）
        if (shouldCompress([...rawScenes, newRawScene], currentChapter)) {
          const scenesToCompress = getScenesToCompress(
            [...rawScenes, newRawScene],
            currentChapter
          );
          if (scenesToCompress.length > 0) {
            // 异步压缩，不阻塞用户操作
            void (async () => {
              const { summary } = await compressScenes(
                scenesToCompress,
                currentChapter?.title ?? null,
                apiKey,
                providerId,
                modelId
              );
              if (summary && currentChapter) {
                await updateChapterSummary(currentChapter.id, summary);
                setChapters((prev) =>
                  prev.map((c) =>
                    c.id === currentChapter.id
                      ? { ...c, summary, status: "completed" as const }
                      : c
                  )
                );
                // 重建优化后的上下文
                const updatedChapters = chapters.map((c) =>
                  c.id === currentChapter.id
                    ? { ...c, summary, status: "completed" as const }
                    : c
                );
                const newContext = buildContext({
                  systemPrompt,
                  initialUserMessage,
                  chapters: updatedChapters,
                  scenes: [...rawScenes, newRawScene],
                });
                setMessages(newContext);
                showToast("记忆已压缩 ✓");
              }
            })();
          }
        }

        // 处理关系更新（乙游）
        if (parsed.relationshipUpdates && parsed.relationshipUpdates.length > 0) {
          for (const update of parsed.relationshipUpdates) {
            const { data: character, created } = await upsertCharacter({
              game_id: gameId,
              name: update.characterName,
              description: update.description ?? null,
              role: "major",
              first_appearance_chapter: parsed.chapterMarker?.number ?? null,
              avatar_color: "#c8aaff",
            });
            if (character) {
              await upsertRelationship(gameId, character.id, update.relationLabel);
              if (created && character.role === "major" && !character.avatar) {
                // 默认头像在后台生成，不阻塞正文、选项或关系更新。
                void generateCharacterAvatar({
                  characterName: character.name,
                  description: character.description,
                  gameType: game.type,
                  storySetting: game.setting,
                  deviceId: getDeviceId(),
                })
                  .then((avatar) =>
                    setGeneratedCharacterAvatarIfEmpty(character.id, avatar)
                  )
                  .catch(() => {
                    // 保留首字与主题色兜底头像，用户之后可手动生成或上传替换。
                  });
              }
            }
          }
        }

        // 处理场景布局（悬疑）
        if (parsed.sceneLayout && parsed.sceneLayout.rooms.length > 0) {
          await createMap(
            gameId,
            parsed.sceneLayout.locationName,
            { rooms: parsed.sceneLayout.rooms },
            currentChapter?.id,
          );
        }

        // 更新游戏最后游玩时间
        await touchGame(gameId);

        // 如果是结局，创建自动存档
        if (parsed.isEnding) {
          await createSave(
            gameId,
            currentChapter?.id ?? null,
            orderIndex,
            "结局存档",
            "auto"
          );
        }
      } catch (err) {
        const e = err as Error;
        if (e.name === "AbortError") return;
        setError(e.message || "未知错误，请重试");
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [apiKey, providerId, modelId, gameId, game.type, game.setting, chapters, reviewMode, rawScenes, systemPrompt, initialUserMessage, illustrationsEnabled, showToast]
  );

  // ---- 挂载时自动发起第一次请求（新游戏时） ----
  useEffect(() => {
    if (hasStartedRef.current) return;
    if (reviewMode) return;
    // 新游戏：有初始消息但没有场景
    if (messages.length > 0 && scenes.length === 0 && !savePoint) {
      hasStartedRef.current = true;
      void callAI(messages);
    }
    // 从存档继续：有消息且有场景，不需要自动请求
    if (scenes.length > 0) {
      hasStartedRef.current = true;
    }
  }, [messages, scenes.length, savePoint, reviewMode, callAI]);

  // ---- 用户选择选项 ----
  const handleChooseOption = useCallback(
    (option: Option) => {
      const userContent = buildChoiceMessage(`${option.label}. ${option.text}`);
      const userMessage: ChatMessage = { role: "user", content: userContent };
      setMessages((prev) => [...prev, userMessage]);
      const newMessages = [...messages, userMessage];
      void callAI(newMessages);
    },
    [messages, callAI]
  );

  // ---- 手动存档 ----
  const handleSave = async () => {
    if (scenes.length === 0) {
      showToast("暂无场景可存档", "error");
      return;
    }
    try {
      const orderIndex = scenes.length - 1;
      const currentChapter = currentChapterRef.current;
      const chapterLabel = currentChapter?.title
        ? `· ${currentChapter.title}`
        : currentChapter
          ? `· 第${currentChapter.chapter_number}章`
          : "";
      const label = `第${scenes.length}场景 ${chapterLabel}`;
      const { error: saveError } = await createSave(
        gameId,
        currentChapter?.id ?? null,
        orderIndex,
        label,
        "manual"
      );
      if (saveError) {
        showToast("存档失败，请重试", "error");
      } else {
        showToast("存档成功 ✓");
        track("save_game", { chapter_number: currentChapter?.chapter_number });
        // 如果存档列表开着，刷新列表
        if (showSaveList) {
          const { data } = await getSaves(gameId);
          setSaveList(data ?? []);
        }
      }
    } catch {
      showToast("存档失败，请重试", "error");
    }
  };

  // ---- 打开存档列表 ----
  const handleOpenSaveList = async () => {
    try {
      const { data } = await getSaves(gameId);
      setSaveList(data ?? []);
    } catch {
      setSaveList([]);
    }
    setShowSaveList(true);
  };

  // ---- 从存档加载 ----
  const handleLoadSave = (save: Save) => {
    track("load_save", { scene_index: save.scene_index });
    // 跳转到 play 页面并带上 save 参数
    window.location.href = `/play/${gameId}?save=${save.id}`;
  };

  // ---- 删除存档 ----
  const handleDeleteSave = async (saveId: string) => {
    try {
      await deleteSave(saveId);
      setSaveList((prev) => prev.filter((s) => s.id !== saveId));
      showToast("存档已删除");
    } catch {
      showToast("删除失败", "error");
    }
  };

  // ---- 暂停 / 继续 ----
  const handlePause = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsLoading(false);
    setPaused(true);
  };

  const handleResume = () => {
    setPaused(false);
    void callAI(messages);
  };

  // ---- 返回 ----
  const handleExit = async () => {
    // 自动存档
    if (scenes.length > 0 && !reviewMode) {
      try {
        const orderIndex = scenes.length - 1;
        const currentChapter = currentChapterRef.current;
        const chapterLabel = currentChapter?.title
          ? `· ${currentChapter.title}`
          : currentChapter
            ? `· 第${currentChapter.chapter_number}章`
            : "";
        const label = `第${scenes.length}场景 ${chapterLabel}`;
        await createSave(gameId, currentChapter?.id ?? null, orderIndex, label, "auto");
        await pruneAutoSaves(gameId, 10);
      } catch {
        // 静默失败，不阻断退出
      }
    }
    onExit?.();
  };

  // ---- 选项是否展示 ----
  const showOptions =
    !isLoading &&
    !error &&
    !paused &&
    !reviewMode &&
    Boolean(latestScene) &&
    !isEnding &&
    latestScene !== undefined &&
    latestScene.options.length > 0 &&
    typingDone;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        background: theme.bgGradient,
        color: theme.textPrimary,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ===== 顶部信息栏 ===== */}
      <div
        style={{
          flexShrink: 0,
          padding: "12px 24px",
          paddingTop: "max(12px, env(safe-area-inset-top))",
          borderBottom: `1px solid ${theme.optionBorder}`,
          background: "rgba(0,0,0,0.2)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ color: theme.accentColor, fontSize: "14px", fontWeight: 600 }}>
            {game.title}
          </span>
          {latestScene?.chapterTitle && (
            <span style={{ color: theme.textSecondary, fontSize: "13px" }}>
              · {latestScene.chapterTitle}
            </span>
          )}
        </div>
        {reviewMode && (
          <span style={{ color: theme.accentColor, fontSize: "12px", fontStyle: "italic" }}>
            剧情回顾模式
          </span>
        )}
      </div>

      {/* ===== 可滚动的故事区域 ===== */}
      <div
        ref={scrollRef}
        className="story-scroll"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "24px 24px 24px",
        }}
      >
        <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto" }}>
          {/* 历史场景（半透明） */}
          {scenes.slice(0, -1).map((scene) => (
            <div key={scene.id} style={{ marginBottom: "28px" }}>
              {scene.chapterTitle && (
                <div
                  style={{
                    color: theme.accentColor,
                    fontSize: "14px",
                    fontWeight: 600,
                    marginBottom: "8px",
                    letterSpacing: "1px",
                  }}
                >
                  ✦ {scene.chapterTitle}
                </div>
              )}
              <SceneIllustrationView
                illustration={scene.illustration}
                loading={false}
                theme={theme}
                muted
              />
              <div
                style={{
                  opacity: 0.4,
                  color: theme.textSecondary,
                  lineHeight: 1.9,
                  fontSize: "16px",
                  whiteSpace: "pre-wrap",
                }}
              >
                {scene.content}
              </div>
            </div>
          ))}

          {/* 最新场景：打字机逐字显示 */}
          {latestScene && !isLoading && !error && (
            <div>
              {latestScene.chapterTitle && (
                <div
                  style={{
                    color: theme.accentColor,
                    fontSize: "15px",
                    fontWeight: 600,
                    marginBottom: "12px",
                    letterSpacing: "1px",
                  }}
                >
                  ✦ {latestScene.chapterTitle}
                </div>
              )}
              <SceneIllustrationView
                illustration={latestScene.illustration}
                loading={Boolean(latestScene.isIllustrationLoading)}
                theme={theme}
              />
              <div
                style={{
                  lineHeight: 1.95,
                  fontSize: "17px",
                  whiteSpace: "pre-wrap",
                  color: theme.textPrimary,
                }}
              >
                <TypewriterText
                  text={latestScene.content}
                  speed={typewriterSpeed}
                  onComplete={() => setTypingDone(true)}
                />
              </div>
            </div>
          )}

          {/* 加载提示 */}
          {isLoading && (
            <div
              style={{
                color: theme.textSecondary,
                fontSize: "16px",
                fontStyle: "italic",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span>梦境正在编织中</span>
              <span className="loading-dots" />
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div
              style={{
                padding: "16px",
                borderRadius: theme.borderRadius,
                background: "rgba(255, 100, 100, 0.1)",
                border: "1px solid rgba(255, 100, 100, 0.3)",
                color: "#ffb4b4",
                fontSize: "15px",
              }}
            >
              <p style={{ margin: "0 0 12px" }}>{error}</p>
              <button
                type="button"
                onClick={() => void callAI(messages)}
                style={retryBtnStyle(theme)}
              >
                重试
              </button>
            </div>
          )}

          {paused && !isLoading && !error && (
            <div style={{ color: theme.textSecondary, fontStyle: "italic" }}>
              已暂停
            </div>
          )}
        </div>
      </div>

      {/* ===== 底部操作区 ===== */}
      <div
        style={{
          flexShrink: 0,
          borderTop: `1px solid ${theme.optionBorder}`,
          background: "rgba(0,0,0,0.18)",
          backdropFilter: "blur(8px)",
          padding: "20px 24px 16px",
          paddingBottom: "max(16px, env(safe-area-inset-bottom))",
        }}
      >
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          {showOptions && latestScene && (
            <OptionButtons
              options={latestScene.options}
              onChoose={handleChooseOption}
              themeId={themeId}
              disabled={isLoading}
            />
          )}

          {isLoading && (
            <div
              style={{
                textAlign: "center",
                color: theme.textSecondary,
                fontStyle: "italic",
                padding: "12px 0",
              }}
            >
              梦境正在编织中
              <span className="loading-dots" />
            </div>
          )}

          {paused && !isLoading && !error && !reviewMode && (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <button
                type="button"
                onClick={handleResume}
                style={accentBtnStyle(theme)}
              >
                继续编织
              </button>
            </div>
          )}

          {isEnding && !isLoading && !error && (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <p
                style={{
                  color: theme.accentColor,
                  fontSize: "18px",
                  fontWeight: 600,
                  margin: "0 0 16px",
                  letterSpacing: "2px",
                }}
              >
                故事结束
              </p>
              <button
                type="button"
                onClick={() => onExit?.()}
                style={{
                  ...accentBtnStyle(theme),
                  boxShadow: `0 0 22px ${theme.glowColor}`,
                }}
              >
                返回
              </button>
            </div>
          )}

          {/* 控制栏 */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "12px",
              marginTop: "16px",
              paddingTop: "12px",
              borderTop: `1px solid ${theme.optionBorder}`,
            }}
          >
            {!reviewMode && (
              <>
                <button
                  type="button"
                  onClick={handlePause}
                  disabled={!isLoading}
                  style={controlBtnStyle(theme, !isLoading)}
                >
                  暂停
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isLoading || scenes.length === 0}
                  style={controlBtnStyle(theme, isLoading || scenes.length === 0)}
                >
                  存档
                </button>
                <button
                  type="button"
                  onClick={handleOpenSaveList}
                  disabled={isLoading}
                  style={controlBtnStyle(theme, isLoading)}
                >
                  读档
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleExit}
              style={controlBtnStyle(theme, false)}
            >
              {reviewMode ? "返回" : "退出"}
            </button>
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              style={controlBtnStyle(theme, false)}
            >
              设置
            </button>
          </div>

          {/* 设置面板 */}
          {showSettings && (
            <div
              style={{
                marginTop: "16px",
                padding: "16px",
                borderRadius: theme.borderRadius,
                background: theme.optionBg,
                border: `1px solid ${theme.optionBorder}`,
              }}
            >
              <div style={{ marginBottom: "14px" }}>
                <div style={settingLabelStyle(theme)}>主题</div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {Object.values(themes).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setThemeId(t.id)}
                      style={chipStyle(t, themeId === t.id)}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={settingLabelStyle(theme)}>打字机速度</div>
                <div style={{ display: "flex", gap: "8px" }}>
                  {SPEED_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setTypewriterSpeed(s)}
                      style={chipStyle(theme, typewriterSpeed === s)}
                    >
                      {s === "slow" ? "慢" : s === "medium" ? "中" : "快"}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: "14px" }}>
                <div style={settingLabelStyle(theme)}>AI 配图</div>
                <button
                  type="button"
                  onClick={() => setIllustrationsEnabled(!illustrationsEnabled)}
                  style={chipStyle(theme, illustrationsEnabled)}
                >
                  {illustrationsEnabled ? "关键场景配图已开启" : "已关闭"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== 存档列表弹窗 ===== */}
      {showSaveList && (
        <SaveList
          saves={saveList}
          onLoad={handleLoadSave}
          onDelete={handleDeleteSave}
          onClose={() => setShowSaveList(false)}
          onCreateManual={handleSave}
        />
      )}

      {/* ===== Toast 提示 ===== */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: "70px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
            padding: "10px 24px",
            borderRadius: theme.borderRadius,
            background:
              toast.type === "success"
                ? "rgba(100, 200, 120, 0.15)"
                : "rgba(255, 100, 100, 0.15)",
            border: `1px solid ${
              toast.type === "success"
                ? "rgba(100, 200, 120, 0.4)"
                : "rgba(255, 100, 100, 0.4)"
            }`,
            backdropFilter: "blur(8px)",
            color: toast.type === "success" ? "#a0e8b0" : "#ffb4b4",
            fontSize: "14px",
            fontWeight: 500,
            animation: "toastSlide 0.3s ease",
            pointerEvents: "none",
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function SceneIllustrationView({
  illustration,
  loading,
  theme,
  muted = false,
}: {
  illustration?: SceneIllustration | null;
  loading: boolean;
  theme: Theme;
  muted?: boolean;
}) {
  if (!illustration && !loading) return null;

  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "16 / 9",
        marginBottom: "18px",
        borderRadius: theme.borderRadius,
        overflow: "hidden",
        border: `1px solid ${theme.optionBorder}`,
        background: theme.optionBg,
        boxShadow: muted ? "none" : `0 14px 36px ${theme.glowColor}`,
        opacity: muted ? 0.42 : 1,
      }}
    >
      {illustration ? (
        <Image
          src={illustration.dataUrl}
          alt={illustration.alt}
          width={1280}
          height={720}
          unoptimized
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div
          className="illustration-loading"
          aria-live="polite"
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: theme.textSecondary,
            fontSize: "14px",
            fontStyle: "italic",
            background: `linear-gradient(110deg, ${theme.optionBg} 25%, ${theme.glowColor} 45%, ${theme.optionBg} 65%)`,
            backgroundSize: "220% 100%",
            animation: "illustrationShimmer 1.8s ease-in-out infinite",
          }}
        >
          正在描绘关键场景…
        </div>
      )}
    </div>
  );
}

/* ============ 样式辅助函数 ============ */

function controlBtnStyle(theme: Theme, disabled: boolean): CSSProperties {
  return {
    padding: "8px 18px",
    borderRadius: theme.borderRadius,
    border: `1px solid ${theme.optionBorder}`,
    background: theme.optionBg,
    color: theme.textPrimary,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    fontSize: "14px",
  };
}

function accentBtnStyle(theme: Theme): CSSProperties {
  return {
    background: theme.optionHoverBg,
    border: `1px solid ${theme.accentColor}`,
    color: theme.textPrimary,
    padding: "10px 28px",
    borderRadius: theme.borderRadius,
    cursor: "pointer",
    fontSize: "15px",
  };
}

function retryBtnStyle(theme: Theme): CSSProperties {
  return {
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.2)",
    color: "#fff",
    padding: "6px 16px",
    borderRadius: theme.borderRadius,
    cursor: "pointer",
  };
}

function settingLabelStyle(theme: Theme): CSSProperties {
  return {
    color: theme.textSecondary,
    fontSize: "13px",
    marginBottom: "8px",
  };
}

function chipStyle(theme: Theme, active: boolean): CSSProperties {
  return {
    padding: "6px 14px",
    borderRadius: theme.borderRadius,
    border: `1px solid ${active ? theme.accentColor : theme.optionBorder}`,
    background: active ? theme.optionHoverBg : theme.optionBg,
    color: theme.textPrimary,
    cursor: "pointer",
    fontWeight: active ? 600 : 400,
    fontSize: "14px",
  };
}
