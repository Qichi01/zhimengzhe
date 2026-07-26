"use client";

import { useState, useMemo } from "react";
import type { Chapter, SceneRecord } from "@/types";

interface StarMapProps {
  chapters: Chapter[];
  scenes: SceneRecord[];
  onClose: () => void;
}

interface StarNode {
  chapter: Chapter;
  x: number;
  y: number;
  sceneCount: number;
  isCompleted: boolean;
  isCurrent: boolean;
}

/**
 * 2D 星图章节系统
 * - 每个章节是一颗星，按序号排列在星河中
 * - 点击星星查看该章节的场景列表
 * - 已完成章节和当前章节有不同视觉
 */
export default function StarMap({ chapters, scenes, onClose }: StarMapProps) {
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);

  // 计算每颗星的位置（沿一条蜿蜒的星河排列）
  const starNodes: StarNode[] = useMemo(() => {
    if (chapters.length === 0) return [];

    const currentChapterId = chapters[chapters.length - 1]?.id;

    return chapters.map((chapter, index) => {
      const chapterScenes = scenes.filter((s) => s.chapter_id === chapter.id);
      // 蜿蜒布局：x 均匀分布，y 用 sin 波动
      const spacing = 180;
      const startX = 100;
      const x = startX + index * spacing;
      const y = 200 + Math.sin(index * 0.8) * 80;

      return {
        chapter,
        x,
        y,
        sceneCount: chapterScenes.length,
        isCompleted: chapter.status === "completed",
        isCurrent: chapter.id === currentChapterId,
      };
    });
  }, [chapters, scenes]);

  // 计算选中章节的场景
  const selectedScenes = useMemo(() => {
    if (!selectedChapter) return [];
    return scenes
      .filter((s) => s.chapter_id === selectedChapter.id)
      .sort((a, b) => a.order_index - b.order_index);
  }, [selectedChapter, scenes]);

  // SVG 视口宽度
  const svgWidth = Math.max(800, starNodes.length * 180 + 200);
  const svgHeight = 500;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background: "radial-gradient(ellipse at 50% 30%, #2e2b4e 0%, #1e1b2e 55%, #14111e 100%)",
      }}
    >
      {/* 顶部栏 */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b shrink-0"
        style={{ borderColor: "rgba(200,170,255,0.1)" }}
      >
        <h2 className="text-lg font-semibold tracking-wide" style={{ color: "#e8d5f5" }}>
          ✦ 章节星图
        </h2>
        <button
          onClick={onClose}
          className="p-2 rounded-full transition-colors hover:bg-white/10"
          style={{ color: "rgba(213,184,245,0.6)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 星图主体 */}
      <div className="flex-1 overflow-auto relative">
        {chapters.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p style={{ color: "rgba(213,184,245,0.4)" }} className="text-sm">
              尚未开始任何章节
            </p>
          </div>
        ) : (
          <svg
            width={svgWidth}
            height={svgHeight}
            className="block"
            style={{ minHeight: "100%" }}
          >
            {/* 星河连线 */}
            {starNodes.length > 1 &&
              starNodes.slice(0, -1).map((node, i) => {
                const next = starNodes[i + 1];
                return (
                  <line
                    key={`line-${i}`}
                    x1={node.x}
                    y1={node.y}
                    x2={next.x}
                    y2={next.y}
                    stroke="rgba(200,170,255,0.2)"
                    strokeWidth="1.5"
                    strokeDasharray="4 6"
                  />
                );
              })}

            {/* 装饰性小星星 */}
            {Array.from({ length: 40 }).map((_, i) => {
              const seed = i * 137.5;
              const x = (seed * 7) % svgWidth;
              const y = (seed * 3) % svgHeight;
              const r = (seed % 3) * 0.4 + 0.3;
              const opacity = ((seed * 11) % 50) / 100 + 0.1;
              return (
                <circle
                  key={`deco-${i}`}
                  cx={x}
                  cy={y}
                  r={r}
                  style={{ fill: `rgba(232,213,245,${opacity})` }}
                />
              );
            })}

            {/* 章节星节点 */}
            {starNodes.map((node) => {
              const isSelected = selectedChapter?.id === node.chapter.id;
              const starColor = node.isCurrent
                ? "#c8aaff"
                : node.isCompleted
                  ? "rgba(160,200,220,0.7)"
                  : "rgba(200,170,255,0.5)";
              const glowSize = node.isCurrent ? 35 : node.isCompleted ? 20 : 12;

              return (
                <g
                  key={node.chapter.id}
                  onClick={() => setSelectedChapter(node.chapter)}
                  style={{ cursor: "pointer" }}
                >
                  {/* 光晕 */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={glowSize}
                    fill={starColor}
                    opacity={0.15}
                    style={{
                      transition: "all 0.3s ease",
                      filter: node.isCurrent
                        ? "blur(8px)"
                        : isSelected
                          ? "blur(6px)"
                          : "blur(3px)",
                    }}
                  />
                  {/* 星星主体（四角星形状） */}
                  <path
                    d={starPath(node.x, node.y, node.isCurrent ? 12 : 8)}
                    fill={starColor}
                    style={{
                      transition: "all 0.3s ease",
                      filter: node.isCurrent
                        ? `drop-shadow(0 0 8px ${starColor})`
                        : isSelected
                          ? `drop-shadow(0 0 6px ${starColor})`
                          : "none",
                    }}
                  />
                  {/* 章节编号 */}
                  <text
                    x={node.x}
                    y={node.y - 22}
                    textAnchor="middle"
                    fill="rgba(232,213,245,0.7)"
                    fontSize="11"
                    fontFamily="sans-serif"
                  >
                    第{node.chapter.chapter_number}章
                  </text>
                  {/* 章节标题 */}
                  {node.chapter.title && (
                    <text
                      x={node.x}
                      y={node.y + 28}
                      textAnchor="middle"
                      fill={node.isCurrent ? "#e8d5f5" : "rgba(213,184,245,0.5)"}
                      fontSize="12"
                      fontFamily="sans-serif"
                      fontWeight={node.isCurrent ? 600 : 400}
                    >
                      {node.chapter.title.length > 8
                        ? node.chapter.title.slice(0, 8) + "…"
                        : node.chapter.title}
                    </text>
                  )}
                  {/* 场景数 */}
                  <text
                    x={node.x}
                    y={node.y + 44}
                    textAnchor="middle"
                    fill="rgba(213,184,245,0.3)"
                    fontSize="10"
                    fontFamily="sans-serif"
                  >
                    {node.sceneCount} 场景
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* 章节详情面板 */}
      {selectedChapter && (
        <div
          className="shrink-0 max-h-[40vh] overflow-y-auto px-6 py-4 border-t"
          style={{
            borderColor: "rgba(200,170,255,0.15)",
            background: "rgba(20,17,30,0.6)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span
                className="text-sm font-medium"
                style={{ color: "#c8aaff" }}
              >
                第{selectedChapter.chapter_number}章
              </span>
              {selectedChapter.title && (
                <span
                  className="text-base font-semibold"
                  style={{ color: "#e8d5f5" }}
                >
                  {selectedChapter.title}
                </span>
              )}
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background:
                    selectedChapter.status === "completed"
                      ? "rgba(100,200,120,0.15)"
                      : "rgba(200,170,255,0.1)",
                  color:
                    selectedChapter.status === "completed"
                      ? "#a0e8b0"
                      : "rgba(213,184,245,0.6)",
                }}
              >
                {selectedChapter.status === "completed" ? "已完成" : "进行中"}
              </span>
            </div>
            <button
              onClick={() => setSelectedChapter(null)}
              className="text-xs transition-opacity hover:opacity-70"
              style={{ color: "rgba(213,184,245,0.4)" }}
            >
              收起
            </button>
          </div>

          {/* 章节摘要 */}
          {selectedChapter.summary && (
            <div
              className="mb-3 p-3 rounded-lg text-sm leading-relaxed"
              style={{
                background: "rgba(200,170,255,0.05)",
                border: "1px solid rgba(200,170,255,0.1)",
                color: "rgba(213,184,245,0.7)",
              }}
            >
              <span className="text-xs" style={{ color: "rgba(213,184,245,0.4)" }}>
                摘要：
              </span>
              {selectedChapter.summary}
            </div>
          )}

          {/* 场景列表 */}
          {selectedScenes.length > 0 ? (
            <div className="flex flex-col gap-2">
              {selectedScenes.map((scene) => (
                <div
                  key={scene.id}
                  className="rounded-lg p-3 text-sm"
                  style={{
                    background: "rgba(200,170,255,0.03)",
                    border: "1px solid rgba(200,170,255,0.08)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs font-mono"
                      style={{ color: "rgba(213,184,245,0.4)" }}
                    >
                      #{scene.order_index + 1}
                    </span>
                    {scene.is_ending && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          background: "rgba(255,180,180,0.15)",
                          color: "#ffb4b4",
                        }}
                      >
                        结局
                      </span>
                    )}
                  </div>
                  <p
                    className="line-clamp-2 leading-relaxed"
                    style={{ color: "rgba(213,184,245,0.6)" }}
                  >
                    {scene.content}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p
              className="text-center py-4 text-sm"
              style={{ color: "rgba(213,184,245,0.3)" }}
            >
              该章节暂无场景记录
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** 生成四角星 SVG path */
function starPath(cx: number, cy: number, size: number): string {
  const s = size;
  return `M ${cx} ${cy - s}
    Q ${cx + s * 0.3} ${cy - s * 0.3} ${cx + s} ${cy}
    Q ${cx + s * 0.3} ${cy + s * 0.3} ${cx} ${cy + s}
    Q ${cx - s * 0.3} ${cy + s * 0.3} ${cx - s} ${cy}
    Q ${cx - s * 0.3} ${cy - s * 0.3} ${cx} ${cy - s} Z`;
}
