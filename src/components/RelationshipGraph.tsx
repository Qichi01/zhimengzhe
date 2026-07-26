"use client";

import { useState, useMemo } from "react";
import type { Character, Relationship } from "@/types";

interface RelationshipGraphProps {
  characters: Character[];
  relationships: Relationship[];
  /** 主角名（从游戏设定解析或默认"我"） */
  protagonistName?: string;
  onClose: () => void;
}

interface GraphNode {
  id: string;
  name: string;
  description: string | null;
  role: string;
  color: string;
  x: number;
  y: number;
  isProtagonist: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
  previousLabel: string | null;
}

// 画布尺寸
const CANVAS_W = 800;
const CANVAS_H = 600;
const CENTER_X = CANVAS_W / 2;
const CENTER_Y = CANVAS_H / 2;

/**
 * 人物关系图（静态径向布局）
 * - 中心节点：主角（虚拟节点，固定在画布中心）
 * - 周围节点：NPC 均匀分布在主角周围的圆环上
 * - 连线：所有 NPC 连向主角，标注关系
 * - 点击节点查看角色详情
 *
 * 不使用力导向模拟，避免节点漂移和连线压缩。
 */
export default function RelationshipGraph({
  characters,
  relationships,
  protagonistName = "主角",
  onClose,
}: RelationshipGraphProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // 主角虚拟节点 ID（固定）
  const protagonistId = "__protagonist__";

  // 根据NPC数量动态计算半径，确保节点不会太挤也不会太散
  const radius = useMemo(() => {
    const count = characters.length;
    if (count <= 2) return 200;
    if (count <= 4) return 210;
    if (count <= 6) return 230;
    return 250;
  }, [characters.length]);

  // 构建节点（静态位置，不动画）
  const nodes: GraphNode[] = useMemo(() => {
    const npcCount = characters.length;
    if (npcCount === 0) return [];

    return characters.map((char, i) => {
      // NPC 均匀环形分布
      const angle = (i / npcCount) * Math.PI * 2 - Math.PI / 2; // 从正上方开始
      return {
        id: char.id,
        name: char.name,
        description: char.description,
        role: char.role,
        color: char.avatar_color,
        x: CENTER_X + Math.cos(angle) * radius,
        y: CENTER_Y + Math.sin(angle) * radius,
        isProtagonist: false,
      };
    });
  }, [characters, radius]);

  // 主角节点
  const protagonistNode: GraphNode = {
    id: protagonistId,
    name: protagonistName,
    description: null,
    role: "protagonist",
    color: "#ffd76b",
    x: CENTER_X,
    y: CENTER_Y,
    isProtagonist: true,
  };

  const allNodes = [protagonistNode, ...nodes];

  // 构建边 — 所有 NPC 连向主角
  const edges: GraphEdge[] = useMemo(() => {
    return relationships.map((rel) => ({
      source: rel.character_id,
      target: protagonistId,
      label: rel.relation_label,
      previousLabel: rel.previous_label,
    }));
  }, [relationships]);

  // 获取选中节点的完整信息
  const selectedNodeInfo = useMemo(() => {
    if (!selectedNodeId) return null;
    if (selectedNodeId === protagonistId) {
      return {
        name: protagonistName,
        role: "protagonist",
        description: null,
        relationLabel: null,
        previousLabel: null,
        first_appearance_chapter: null,
        avatar_color: "#ffd76b",
      };
    }
    const char = characters.find((c) => c.id === selectedNodeId);
    if (!char) return null;
    const rel = relationships.find((r) => r.character_id === selectedNodeId);
    return {
      name: char.name,
      role: char.role,
      description: char.description,
      relationLabel: rel?.relation_label ?? null,
      previousLabel: rel?.previous_label ?? null,
      first_appearance_chapter: char.first_appearance_chapter,
      avatar_color: char.avatar_color,
    };
  }, [selectedNodeId, characters, relationships, protagonistName]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #2e2b4e 0%, #1e1b2e 55%, #14111e 100%)",
      }}
    >
      {/* 顶部栏 */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b shrink-0"
        style={{ borderColor: "rgba(200,170,255,0.1)" }}
      >
        <h2
          className="text-lg font-semibold tracking-wide"
          style={{ color: "#e8d5f5" }}
        >
          ⚛ 人物关系图
        </h2>
        <button
          onClick={onClose}
          className="p-2 rounded-full transition-colors hover:bg-white/10"
          style={{ color: "rgba(213,184,245,0.6)" }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 关系图主体 */}
      <div className="flex-1 overflow-hidden relative flex items-center justify-center">
        {characters.length === 0 ? (
          <p
            style={{ color: "rgba(213,184,245,0.4)" }}
            className="text-sm"
          >
            尚未出现任何角色
          </p>
        ) : (
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* 装饰圆环 */}
            <circle
              cx={CENTER_X}
              cy={CENTER_Y}
              r={radius}
              fill="none"
              stroke="rgba(200,170,255,0.06)"
              strokeWidth="1"
              strokeDasharray="2 6"
            />

            {/* 连线层 */}
            {edges.map((edge, i) => {
              const sourceNode = allNodes.find((n) => n.id === edge.source);
              const targetNode = allNodes.find((n) => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              // 计算连线起点和终点（从节点边缘开始，而非圆心）
              const dx = targetNode.x - sourceNode.x;
              const dy = targetNode.y - sourceNode.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const sourceR = 22;
              const targetR = 28;
              const x1 = sourceNode.x + (dx / dist) * sourceR;
              const y1 = sourceNode.y + (dy / dist) * sourceR;
              const x2 = targetNode.x - (dx / dist) * targetR;
              const y2 = targetNode.y - (dy / dist) * targetR;

              // 标签位置：连线中点
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;

              // 标签宽度：中文字符约 14px 宽（fontSize 12）
              const labelWidth = edge.label.length * 14 + 16;
              const labelHeight = 22;

              return (
                <g key={`edge-${i}`}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="rgba(200,170,255,0.35)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  {/* 关系标签背景 */}
                  <rect
                    x={midX - labelWidth / 2}
                    y={midY - labelHeight / 2}
                    width={labelWidth}
                    height={labelHeight}
                    rx={labelHeight / 2}
                    fill="rgba(30,27,46,0.95)"
                    stroke="rgba(200,170,255,0.35)"
                    strokeWidth="0.5"
                  />
                  <text
                    x={midX}
                    y={midY + 4}
                    textAnchor="middle"
                    fill="rgba(200,170,255,0.85)"
                    fontSize="12"
                    fontFamily="sans-serif"
                  >
                    {edge.label}
                  </text>
                </g>
              );
            })}

            {/* 节点层 */}
            {allNodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const r = node.isProtagonist ? 32 : 24;

              return (
                <g
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  style={{ cursor: "pointer" }}
                >
                  {/* 外层光晕 */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r + 10}
                    fill={node.color}
                    opacity={isSelected ? 0.25 : 0.1}
                    style={{
                      filter: "blur(8px)",
                      transition: "opacity 0.3s ease",
                    }}
                  />
                  {/* 中层光环 */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r + 4}
                    fill="none"
                    stroke={node.color}
                    strokeWidth="1"
                    opacity={isSelected ? 0.4 : 0.15}
                    style={{ transition: "opacity 0.3s ease" }}
                  />
                  {/* 节点主体 */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r}
                    fill={node.color}
                    opacity={node.isProtagonist ? 0.9 : 0.75}
                    stroke={isSelected ? "#e8d5f5" : "rgba(232,213,245,0.4)"}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    style={{ transition: "all 0.3s ease" }}
                  />
                  {/* 节点内文字（主角标记或角色首字） */}
                  {node.isProtagonist ? (
                    <text
                      x={node.x}
                      y={node.y + 5}
                      textAnchor="middle"
                      fill="#fff"
                      fontSize="13"
                      fontFamily="sans-serif"
                      fontWeight={700}
                      pointerEvents="none"
                    >
                      主角
                    </text>
                  ) : (
                    <text
                      x={node.x}
                      y={node.y + 5}
                      textAnchor="middle"
                      fill="#fff"
                      fontSize="14"
                      fontFamily="sans-serif"
                      fontWeight={600}
                      pointerEvents="none"
                    >
                      {node.name.charAt(0)}
                    </text>
                  )}
                  {/* 角色名（节点下方） */}
                  <text
                    x={node.x}
                    y={node.y + r + 18}
                    textAnchor="middle"
                    fill={node.isProtagonist ? "#e8d5f5" : "rgba(213,184,245,0.75)"}
                    fontSize="13"
                    fontFamily="sans-serif"
                    fontWeight={node.isProtagonist ? 600 : 400}
                    pointerEvents="none"
                  >
                    {node.name}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* 角色详情面板 */}
      {selectedNodeInfo && (
        <div
          className="shrink-0 px-6 py-4 border-t"
          style={{
            borderColor: "rgba(200,170,255,0.15)",
            background: "rgba(20,17,30,0.6)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: selectedNodeInfo.avatar_color,
                  boxShadow: `0 0 16px ${selectedNodeInfo.avatar_color}40`,
                }}
              >
                <span
                  className="text-lg font-bold"
                  style={{ color: "#fff" }}
                >
                  {selectedNodeInfo.name.charAt(0)}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-lg font-semibold"
                    style={{ color: "#e8d5f5" }}
                  >
                    {selectedNodeInfo.name}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: "rgba(200,170,255,0.1)",
                      color: "rgba(213,184,245,0.6)",
                    }}
                  >
                    {selectedNodeInfo.role === "protagonist"
                      ? "主角"
                      : selectedNodeInfo.role === "major"
                        ? "主要角色"
                        : "次要角色"}
                  </span>
                </div>
                {selectedNodeInfo.relationLabel && (
                  <div className="flex items-center gap-2 text-sm">
                    <span style={{ color: "rgba(213,184,245,0.4)" }}>
                      当前关系：
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-xs"
                      style={{
                        background: "rgba(200,170,255,0.15)",
                        color: "#c8aaff",
                      }}
                    >
                      {selectedNodeInfo.relationLabel}
                    </span>
                    {selectedNodeInfo.previousLabel && (
                      <>
                        <span style={{ color: "rgba(213,184,245,0.3)" }}>
                          ←
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: "rgba(213,184,245,0.4)" }}
                        >
                          {selectedNodeInfo.previousLabel}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setSelectedNodeId(null)}
              className="text-xs transition-opacity hover:opacity-70"
              style={{ color: "rgba(213,184,245,0.4)" }}
            >
              收起
            </button>
          </div>

          {selectedNodeInfo.description && (
            <p
              className="text-sm leading-relaxed"
              style={{ color: "rgba(213,184,245,0.6)" }}
            >
              {selectedNodeInfo.description}
            </p>
          )}

          {selectedNodeInfo.first_appearance_chapter && (
            <p
              className="text-xs mt-2"
              style={{ color: "rgba(213,184,245,0.3)" }}
            >
              首次出现：第{selectedNodeInfo.first_appearance_chapter}章
            </p>
          )}
        </div>
      )}
    </div>
  );
}
