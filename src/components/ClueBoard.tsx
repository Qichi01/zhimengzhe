"use client";

import { useState, useEffect } from "react";
import type { Clue, GameMap } from "@/types";
import {
  getClues,
  createClue,
  updateClueNote,
  deleteClue,
  getMaps,
} from "@/lib/localDb";

interface ClueBoardProps {
  gameId: string;
  onClose: () => void;
}

/**
 * 悬疑线索板 + 场景布局图
 * - 笔记本形式的线索记录
 * - 场景布局图展示（AI 自动生成的房屋布局）
 * - 线索可添加备注、删除
 */
export default function ClueBoard({ gameId, onClose }: ClueBoardProps) {
  const [clues, setClues] = useState<Clue[]>([]);
  const [maps, setMaps] = useState<GameMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [newClueText, setNewClueText] = useState("");
  const [editingNote, setEditingNote] = useState<{ id: string; note: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"clues" | "maps">("clues");

  useEffect(() => {
    const loadData = async () => {
      const { data: clueData } = await getClues(gameId);
      setClues(clueData ?? []);

      const { data: mapData } = await getMaps(gameId);
      setMaps(mapData ?? []);

      setLoading(false);
    };
    loadData();
  }, [gameId]);

  const handleAddClue = async () => {
    if (!newClueText.trim()) return;
    const { data, error } = await createClue(gameId, newClueText.trim());
    if (!error && data) {
      setClues((prev) => [data, ...prev]);
      setNewClueText("");
    }
  };

  const handleUpdateNote = async (clueId: string, note: string) => {
    await updateClueNote(clueId, note);
    setClues((prev) =>
      prev.map((c) => (c.id === clueId ? { ...c, note } : c))
    );
    setEditingNote(null);
  };

  const handleDeleteClue = async (clueId: string) => {
    await deleteClue(clueId);
    setClues((prev) => prev.filter((c) => c.id !== clueId));
  };

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
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold tracking-wide" style={{ color: "#e8d5f5" }}>
            ✧ 线索板
          </h2>
          {/* Tab 切换 */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("clues")}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                background: activeTab === "clues" ? "rgba(200,170,255,0.15)" : "transparent",
                color: activeTab === "clues" ? "#c8aaff" : "rgba(213,184,245,0.5)",
                border: activeTab === "clues"
                  ? "1px solid rgba(200,170,255,0.4)"
                  : "1px solid rgba(200,170,255,0.1)",
              }}
            >
              线索笔记
            </button>
            <button
              onClick={() => setActiveTab("maps")}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                background: activeTab === "maps" ? "rgba(200,170,255,0.15)" : "transparent",
                color: activeTab === "maps" ? "#c8aaff" : "rgba(213,184,245,0.5)",
                border: activeTab === "maps"
                  ? "1px solid rgba(200,170,255,0.4)"
                  : "1px solid rgba(200,170,255,0.1)",
              }}
            >
              场景布局图 ({maps.length})
            </button>
          </div>
        </div>
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

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div
              className="inline-block w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "#c8aaff", borderTopColor: "transparent" }}
            />
          </div>
        ) : activeTab === "clues" ? (
          /* ===== 线索笔记 ===== */
          <div className="max-w-2xl mx-auto">
            {/* 添加线索 */}
            <div
              className="mb-6 p-4 rounded-xl"
              style={{
                background: "rgba(200,170,255,0.05)",
                border: "1px solid rgba(200,170,255,0.12)",
              }}
            >
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newClueText}
                  onChange={(e) => setNewClueText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddClue()}
                  placeholder="记录一条线索..."
                  className="flex-1 px-4 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: "rgba(30,27,46,0.6)",
                    border: "1px solid rgba(200,170,255,0.15)",
                    color: "#e8d5f5",
                  }}
                />
                <button
                  onClick={handleAddClue}
                  disabled={!newClueText.trim()}
                  className="px-5 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-30"
                  style={{
                    background: "rgba(200,170,255,0.15)",
                    border: "1px solid rgba(200,170,255,0.4)",
                    color: "#c8aaff",
                    cursor: newClueText.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  添加
                </button>
              </div>
            </div>

            {/* 线索列表（笔记本风格） */}
            {clues.length === 0 ? (
              <div className="text-center py-12">
                <p style={{ color: "rgba(213,184,245,0.3)" }} className="text-sm">
                  还没有记录任何线索
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {clues.map((clue) => (
                  <div
                    key={clue.id}
                    className="group rounded-xl p-4 transition-all"
                    style={{
                      background: "rgba(200,170,255,0.04)",
                      border: "1px solid rgba(200,170,255,0.1)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        {/* 线索内容 */}
                        <p
                          className="text-sm leading-relaxed mb-2"
                          style={{ color: "#e8d5f5" }}
                        >
                          {clue.content}
                        </p>

                        {/* 备注 */}
                        {editingNote?.id === clue.id ? (
                          <div className="flex gap-2 mt-2">
                            <input
                              type="text"
                              value={editingNote.note}
                              onChange={(e) =>
                                setEditingNote({
                                  id: clue.id,
                                  note: e.target.value,
                                })
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  handleUpdateNote(clue.id, editingNote.note);
                                if (e.key === "Escape") setEditingNote(null);
                              }}
                              placeholder="添加备注..."
                              autoFocus
                              className="flex-1 px-3 py-1 rounded text-xs outline-none"
                              style={{
                                background: "rgba(30,27,46,0.6)",
                                border: "1px solid rgba(200,170,255,0.2)",
                                color: "#e8d5f5",
                              }}
                            />
                            <button
                              onClick={() => handleUpdateNote(clue.id, editingNote.note)}
                              className="text-xs px-2 py-1 rounded"
                              style={{
                                background: "rgba(200,170,255,0.15)",
                                color: "#c8aaff",
                              }}
                            >
                              保存
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              setEditingNote({
                                id: clue.id,
                                note: clue.note ?? "",
                              })
                            }
                            className="text-xs transition-opacity"
                            style={{ color: clue.note ? "rgba(213,184,245,0.6)" : "rgba(213,184,245,0.3)" }}
                          >
                            {clue.note ? `备注：${clue.note}` : "+ 添加备注"}
                          </button>
                        )}

                        {/* 时间 */}
                        <p
                          className="text-xs mt-2"
                          style={{ color: "rgba(213,184,245,0.2)" }}
                        >
                          {new Date(clue.created_at).toLocaleString("zh-CN")}
                        </p>
                      </div>

                      {/* 删除按钮 */}
                      <button
                        onClick={() => handleDeleteClue(clue.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-red-500/20 shrink-0"
                        style={{ color: "rgba(245,160,168,0.6)" }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ===== 场景布局图 ===== */
          <div className="max-w-3xl mx-auto">
            {maps.length === 0 ? (
              <div className="text-center py-12">
                <p style={{ color: "rgba(213,184,245,0.3)" }} className="text-sm">
                  尚未生成任何场景布局图
                </p>
                <p style={{ color: "rgba(213,184,245,0.2)" }} className="text-xs mt-2">
                  随着故事推进，AI 会在关键场景自动生成布局图
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {maps.map((map) => (
                  <div
                    key={map.id}
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: "rgba(200,170,255,0.04)",
                      border: "1px solid rgba(200,170,255,0.1)",
                    }}
                  >
                    {/* 地图标题 */}
                    <div
                      className="flex items-center justify-between px-4 py-3 border-b"
                      style={{ borderColor: "rgba(200,170,255,0.08)" }}
                    >
                      <span
                        className="text-sm font-medium"
                        style={{ color: "#c8aaff" }}
                      >
                        ✦ {map.title}
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: "rgba(213,184,245,0.3)" }}
                      >
                        {new Date(map.created_at).toLocaleDateString("zh-CN")}
                      </span>
                    </div>

                    {/* 地图内容 */}
                    <div className="p-4">
                      {map.svg_content ? (
                        <div
                          dangerouslySetInnerHTML={{ __html: map.svg_content }}
                          style={{ maxWidth: "100%" }}
                        />
                      ) : (
                        <MapLayoutRenderer map={map} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 地图布局渲染器（从 layout_data 生成 SVG）
 */
function MapLayoutRenderer({ map }: { map: GameMap }) {
  const layout = map.layout_data;
  if (!layout?.rooms || layout.rooms.length === 0) {
    return (
      <p style={{ color: "rgba(213,184,245,0.3)" }} className="text-sm text-center py-4">
        布局数据为空
      </p>
    );
  }

  // 计算 SVG 视口
  const maxX = Math.max(...layout.rooms.map((r) => r.x + r.w));
  const maxY = Math.max(...layout.rooms.map((r) => r.y + r.h));
  const padding = 20;
  const svgWidth = maxX + padding * 2;
  const svgHeight = maxY + padding * 2;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      style={{ maxHeight: "300px" }}
    >
      {layout.rooms.map((room, i) => {
        const colors = [
          "rgba(200,170,255,0.15)",
          "rgba(160,200,220,0.15)",
          "rgba(220,180,200,0.15)",
          "rgba(180,220,180,0.15)",
        ];
        const strokeColors = [
          "rgba(200,170,255,0.4)",
          "rgba(160,200,220,0.4)",
          "rgba(220,180,200,0.4)",
          "rgba(180,220,180,0.4)",
        ];

        return (
          <g key={i}>
            <rect
              x={room.x + padding}
              y={room.y + padding}
              width={room.w}
              height={room.h}
              fill={colors[i % colors.length]}
              stroke={strokeColors[i % strokeColors.length]}
              strokeWidth="1.5"
              rx="4"
            />
            <text
              x={room.x + padding + room.w / 2}
              y={room.y + padding + room.h / 2 + 4}
              textAnchor="middle"
              fill="rgba(232,213,245,0.8)"
              fontSize="12"
              fontFamily="sans-serif"
            >
              {room.name}
            </text>
            {/* 连接线 */}
            {room.connections.map((conn, j) => {
              const target = layout.rooms.find((r) => r.name === conn);
              if (!target) return null;
              return (
                <line
                  key={`conn-${i}-${j}`}
                  x1={room.x + padding + room.w / 2}
                  y1={room.y + padding + room.h / 2}
                  x2={target.x + padding + target.w / 2}
                  y2={target.y + padding + target.h / 2}
                  stroke="rgba(200,170,255,0.2)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
