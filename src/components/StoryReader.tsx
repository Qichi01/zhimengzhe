"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useGameStore } from "@/stores/gameStore";
import { useUserStore } from "@/stores/userStore";
import { themes } from "@/lib/themes";
import { parseAIResponse } from "@/lib/parser";
import TypewriterText from "./TypewriterText";
import OptionButtons from "./OptionButtons";
import type { ChatMessage, Option, Scene, Theme, TypewriterSpeed } from "@/types";

interface StoryReaderProps {
  /** 退出阅读器（返回首页） */
  onExit?: () => void;
}

const SPEED_OPTIONS: TypewriterSpeed[] = ["slow", "medium", "fast"];

/**
 * 核心阅读器组件：
 * - 挂载时若已有对话历史但还没有场景，自动发起第一次 AI 请求
 * - 调用 /api/chat，读取流式 SSE 响应并逐字拼接完整文本
 * - 流结束后用 parseAIResponse 解析，创建 Scene 并写入 store
 * - 用户选择选项时构造 user message 并再次发起请求
 */
export default function StoryReader({ onExit }: StoryReaderProps) {
  // ---- 游戏状态 ----
  const scenes = useGameStore((s) => s.scenes);
  const messages = useGameStore((s) => s.messages);
  const isLoading = useGameStore((s) => s.isLoading);
  const addScene = useGameStore((s) => s.addScene);
  const addMessage = useGameStore((s) => s.addMessage);
  const setLoading = useGameStore((s) => s.setLoading);
  const resetGame = useGameStore((s) => s.resetGame);

  // ---- 用户状态 ----
  const apiKey = useUserStore((s) => s.apiKey);
  const themeId = useUserStore((s) => s.themeId);
  const typewriterSpeed = useUserStore((s) => s.typewriterSpeed);
  const setThemeId = useUserStore((s) => s.setThemeId);
  const setTypewriterSpeed = useUserStore((s) => s.setTypewriterSpeed);

  const theme: Theme = themes[themeId] ?? themes["dream-light"];

  // ---- 本地 UI 状态 ----
  const [error, setError] = useState<string | null>(null);
  const [typingDone, setTypingDone] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // 用 ref 标记是否已发起首次请求，避免放进 state 触发额外渲染
  const hasStartedRef = useRef(false);

  const latestScene: Scene | undefined = scenes[scenes.length - 1];
  const isEnding = Boolean(latestScene?.isEnding);

  // 新场景到来时重置打字完成状态：采用「渲染期间调整 state」范式
  // （React 官方推荐，等价于用 key 重置，但不触发 set-state-in-effect）
  const [prevSceneId, setPrevSceneId] = useState<string | undefined>(
    latestScene?.id
  );
  if (latestScene?.id !== prevSceneId) {
    setPrevSceneId(latestScene?.id);
    setTypingDone(false);
  }

  // 自动滚动到底部
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [latestScene?.id, typingDone, isLoading]);

  // ---- 核心：调用 AI（流式） ----
  const callAI = useCallback(
    async (msgs: ChatMessage[]) => {
      setError(null);
      setPaused(false);
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: msgs, apiKey: apiKey || "" }),
          signal: controller.signal,
        });

        if (!res.ok) {
          let msg = "梦境暂时中断，请稍后重试";
          try {
            const data = await res.json();
            if (data?.error) msg = data.error;
          } catch {
            /* 响应不是 JSON，使用默认提示 */
          }
          throw new Error(msg);
        }

        if (!res.body) throw new Error("无法接收响应流");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let full = "";
        let streamDone = false;

        // 逐块读取 SSE 流
        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) {
            streamDone = true;
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // 按行切分，最后不完整的一行保留到 buffer
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
              /* 部分 JSON，忽略，等下一块补全 */
            }
          }
        }

        // 冲刷 decoder 剩余字节，并处理 buffer 中残留的最后一行
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
              /* 忽略 */
            }
          }
        }

        if (!full.trim()) {
          throw new Error("AI 未返回任何内容，请重试");
        }

        // 解析并写入场景
        const parsed = parseAIResponse(full);
        const scene: Scene = {
          id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          content: parsed.content,
          options: parsed.options,
          isEnding: parsed.isEnding,
          timestamp: Date.now(),
        };
        addScene(scene);
        addMessage({ role: "assistant", content: full });
      } catch (err) {
        const e = err as Error;
        // 用户主动取消（暂停）不算错误
        if (e.name === "AbortError") return;
        setError(e.message || "未知错误，请重试");
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [apiKey, addScene, addMessage, setLoading]
  );

  // ---- 挂载时自动发起第一次请求 ----
  // 这是「挂载后与外部系统（AI API）同步」的正当副作用：发起流式请求。
  // callAI 内部会同步 setLoading(true) 标记请求开始，属于副作用的一部分。
  useEffect(() => {
    if (hasStartedRef.current) return;
    if (messages.length > 0 && scenes.length === 0) {
      hasStartedRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void callAI(messages);
    }
  }, [messages, scenes.length, callAI]);

  // ---- 用户选择选项 ----
  const handleChooseOption = useCallback(
    (option: Option) => {
      const userContent = `我选择：${option.label}. ${option.text}`;
      const userMessage: ChatMessage = { role: "user", content: userContent };
      addMessage(userMessage);
      // 注意：addMessage 是异步状态更新，这里用本地拼接保证传入最新消息
      const newMessages = [...messages, userMessage];
      void callAI(newMessages);
    },
    [messages, addMessage, callAI]
  );

  // ---- 暂停 / 继续 ----
  const handlePause = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setLoading(false);
    setPaused(true);
  };

  const handleResume = () => {
    setPaused(false);
    void callAI(messages);
  };

  // ---- 结局后重新开始 ----
  const handleRestart = () => {
    resetGame();
    onExit?.();
  };

  // ---- 选项是否展示：打字完成 + 非加载 + 无错误 + 非结局 ----
  const showOptions =
    !isLoading &&
    !error &&
    !paused &&
    Boolean(latestScene) &&
    !isEnding &&
    latestScene !== undefined &&
    latestScene.options.length > 0 &&
    typingDone;

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: theme.bgGradient,
        color: theme.textPrimary,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ===== 可滚动的故事区域 ===== */}
      <div
        ref={scrollRef}
        className="story-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "72px 24px 24px",
        }}
      >
        <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto" }}>
          {/* 历史场景（半透明） */}
          {scenes.slice(0, -1).map((scene) => (
            <div
              key={scene.id}
              style={{
                opacity: 0.4,
                marginBottom: "28px",
                color: theme.textSecondary,
                lineHeight: 1.9,
                fontSize: "16px",
                whiteSpace: "pre-wrap",
              }}
            >
              {scene.content}
            </div>
          ))}

          {/* 最新场景：打字机逐字显示 */}
          {latestScene && !isLoading && !error && (
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

          {/* 暂停提示 */}
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
        }}
      >
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          {/* 选项按钮 */}
          {showOptions && latestScene && (
            <OptionButtons
              options={latestScene.options}
              onChoose={handleChooseOption}
              themeId={themeId}
              disabled={isLoading}
            />
          )}

          {/* 加载状态 */}
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

          {/* 暂停后继续 */}
          {paused && !isLoading && !error && (
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

          {/* 结局 */}
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
                onClick={handleRestart}
                style={{
                  ...accentBtnStyle(theme),
                  boxShadow: `0 0 22px ${theme.glowColor}`,
                }}
              >
                重新开始
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
              onClick={() => onExit?.()}
              style={controlBtnStyle(theme, false)}
            >
              返回首页
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
              {/* 主题切换 */}
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

              {/* 打字机速度 */}
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
            </div>
          )}
        </div>
      </div>
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
