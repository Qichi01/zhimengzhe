"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StarfieldBackground from "@/components/StarfieldBackground";
import {
  confirmWorldCreationDraft,
  getDefaultModulesForGenre,
  getGenrePack,
  getWorldCreationDraft,
  saveWorldCreationDraft,
} from "@/lib/narrative";
import type { NarrativeModuleId, WorldCreationDraft } from "@/types";

const GENRE_OPTIONS = [
  {
    id: "campus_otome" as const,
    label: "校园乙游",
    description: "手机通信、校园论坛、日历与人物关系",
    accent: "#ffb3d9",
  },
  {
    id: "infinite_flow" as const,
    label: "无限流",
    description: "多世界冒险、成长升级、系统任务、背包与商店",
    accent: "#71f5c2",
  },
];

export default function V3WorldConfirmPage({ params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = use(params);
  const router = useRouter();
  const [draft, setDraft] = useState<WorldCreationDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getWorldCreationDraft(draftId)
      .then((loadedDraft) => {
        if (!loadedDraft) {
          setError("世界草稿不存在或已完成创建");
          return;
        }
        setDraft(loadedDraft);
      })
      .catch(() => setError("无法读取本地世界草稿"))
      .finally(() => setLoading(false));
  }, [draftId]);

  const genrePack = useMemo(
    () => (draft ? getGenrePack(draft.primaryGenre) : null),
    [draft]
  );

  const updateDraft = (patch: Partial<WorldCreationDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  };

  const handleGenreChange = (genre: "campus_otome" | "infinite_flow") => {
    updateDraft({
      primaryGenre: genre,
      enabledModules: getDefaultModulesForGenre(genre),
      artStyle:
        genre === "campus_otome"
          ? "清透细腻的校园乙女游戏插画"
          : "明快舒适、有冲击力的多世界冒险插画，突出成长、任务推进与爽感，适合全年龄用户",
    });
  };

  const toggleModule = (moduleId: NarrativeModuleId) => {
    if (!draft || moduleId === "reader") return;
    updateDraft({
      enabledModules: draft.enabledModules.includes(moduleId)
        ? draft.enabledModules.filter((id) => id !== moduleId)
        : [...draft.enabledModules, moduleId],
    });
  };

  const updateCharacter = (
    characterId: string,
    patch: { name?: string; description?: string }
  ) => {
    if (!draft) return;
    updateDraft({
      characters: draft.characters.map((character) =>
        character.id === characterId ? { ...character, ...patch } : character
      ),
    });
  };

  const addCharacter = () => {
    if (!draft || draft.characters.length >= 10) return;
    updateDraft({
      characters: [
        ...draft.characters,
        { id: crypto.randomUUID(), name: "", role: "major", description: "" },
      ],
    });
  };

  const removeCharacter = (characterId: string) => {
    if (!draft) return;
    updateDraft({
      characters: draft.characters.filter(
        (character) => character.id !== characterId || character.role === "protagonist"
      ),
    });
  };

  const handleBack = async () => {
    if (draft) await saveWorldCreationDraft(draft);
    router.back();
  };

  const handleConfirm = async () => {
    if (!draft || saving) return;
    setError(null);
    setSaving(true);
    try {
      await saveWorldCreationDraft(draft);
      const game = await confirmWorldCreationDraft(draft);
      router.replace(`/game/${game.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "世界档案创建失败");
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  if (!draft) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#171423] px-6 text-center">
        <div>
          <p className="mb-4 text-sm text-[#d5b8f5]/60">{error}</p>
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="rounded-full border border-[#c8aaff]/25 px-5 py-2 text-sm text-[#c8aaff]"
          >
            返回梦境空间
          </button>
        </div>
      </div>
    );
  }

  const accent =
    GENRE_OPTIONS.find((option) => option.id === draft.primaryGenre)?.accent ?? "#c8aaff";

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% -5%, #332d52 0%, #1e1b2e 52%, #14111e 100%)",
      }}
    >
      <StarfieldBackground density="sparse" />
      <header
        className="relative z-10 border-b border-[#c8aaff]/10 px-5 pb-4 sm:px-8 sm:py-4"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => void handleBack()}
            className="-ml-3 min-h-11 touch-manipulation rounded-full px-3 text-sm text-[#d5b8f5]/55 transition-opacity hover:bg-white/5 hover:opacity-80"
          >
            ← 返回修改
          </button>
          <span className="rounded-full border border-[#c8aaff]/20 bg-[#c8aaff]/10 px-3 py-1 text-xs text-[#c8aaff]">
            V3 Beta · 世界档案
          </span>
        </div>
      </header>

      <main
        className="relative z-10 mx-auto max-w-5xl px-5 pt-8 sm:px-8 sm:py-10"
        style={{ paddingBottom: "max(2rem, calc(env(safe-area-inset-bottom) + 1rem))" }}
      >
        <div className="mb-8 max-w-2xl">
          <p className="mb-2 text-xs tracking-[0.2em] text-[#c8aaff]/70">WORLD DEFINITION</p>
          <h1 className="mb-3 text-3xl font-semibold text-[#f0e4fa] sm:text-4xl">
            确认你的故事世界
          </h1>
          <p className="text-sm leading-6 text-[#d5b8f5]/55">
            原始内容已保存在本机。确认题材、主角和主要人物后，系统会用这份档案约束后续剧情、头像与沉浸界面。
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <Section title="基础档案" subtitle="这些内容会成为游戏的稳定世界设定">
              <Field label="世界名称">
                <input
                  value={draft.title}
                  maxLength={30}
                  onChange={(event) => updateDraft({ title: event.target.value })}
                  className="world-input"
                />
              </Field>
              <Field label="世界简介">
                <textarea
                  value={draft.summary}
                  maxLength={4000}
                  rows={6}
                  onChange={(event) => updateDraft({ summary: event.target.value })}
                  className="world-input resize-y leading-6"
                />
              </Field>
            </Section>

            <Section title="主要人物" subtitle="确认后会自动生成默认头像，你仍可随时替换">
              <div className="space-y-3">
                {draft.characters.map((character, index) => (
                  <div
                    key={character.id}
                    className="rounded-2xl border border-[#c8aaff]/12 bg-[#c8aaff]/[0.035] p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs text-[#c8aaff]">
                        {character.role === "protagonist" ? "主角" : `主要人物 ${index}`}
                      </span>
                      {character.role !== "protagonist" && (
                        <button
                          type="button"
                          onClick={() => removeCharacter(character.id)}
                          className="-mr-3 min-h-11 touch-manipulation rounded-full px-3 text-xs text-[#d5b8f5]/35 hover:bg-white/5 hover:text-[#ff9ca8]"
                        >
                          移除
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[0.7fr_1.3fr]">
                      <input
                        value={character.name}
                        maxLength={40}
                        placeholder="人物姓名"
                        onChange={(event) => updateCharacter(character.id, { name: event.target.value })}
                        className="world-input"
                      />
                      <input
                        value={character.description}
                        maxLength={1200}
                        placeholder="身份、外貌、性格或与主角的关系"
                        onChange={(event) =>
                          updateCharacter(character.id, { description: event.target.value })
                        }
                        className="world-input"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addCharacter}
                disabled={draft.characters.length >= 10}
                className="mt-3 min-h-11 w-full touch-manipulation rounded-xl border border-dashed border-[#c8aaff]/20 py-3 text-sm text-[#c8aaff]/75 transition-colors hover:bg-[#c8aaff]/5 disabled:opacity-40"
              >
                + 添加主要人物
              </button>
            </Section>
          </div>

          <div className="space-y-6">
            <Section title="沉浸题材" subtitle="题材决定游戏里会出现哪些界面">
              <div className="space-y-2.5">
                {GENRE_OPTIONS.map((option) => {
                  const selected = draft.primaryGenre === option.id;
                  return (
                    <button
                      type="button"
                      key={option.id}
                      onClick={() => handleGenreChange(option.id)}
                      className="min-h-11 w-full touch-manipulation rounded-2xl p-4 text-left transition-all"
                      style={{
                        border: selected
                          ? `1px solid ${option.accent}70`
                          : "1px solid rgba(200,170,255,0.12)",
                        background: selected
                          ? `${option.accent}12`
                          : "rgba(200,170,255,0.025)",
                      }}
                    >
                      <div
                        className="mb-1 text-sm font-medium"
                        style={{ color: selected ? option.accent : "#d5b8f5" }}
                      >
                        {option.label}
                      </div>
                      <p className="text-xs leading-5 text-[#d5b8f5]/45">{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section title="启用模块" subtitle="模块会随剧情事件逐步点亮">
              <div className="grid grid-cols-2 gap-2">
                {genrePack?.modules.map((module) => (
                  <label
                    key={module.id}
                    className="flex min-h-11 cursor-pointer touch-manipulation items-center gap-2 rounded-xl border border-[#c8aaff]/10 px-3 py-2.5 text-xs text-[#d5b8f5]/70"
                  >
                    <input
                      type="checkbox"
                      checked={draft.enabledModules.includes(module.id)}
                      disabled={module.id === "reader"}
                      onChange={() => toggleModule(module.id)}
                      className="accent-[#c8aaff]"
                    />
                    {module.label}
                  </label>
                ))}
              </div>
            </Section>

            <Section title="视觉风格" subtitle="默认头像和场景图会引用这项约束">
              <textarea
                value={draft.artStyle}
                maxLength={500}
                rows={3}
                onChange={(event) => updateDraft({ artStyle: event.target.value })}
                className="world-input resize-none leading-6"
              />
            </Section>

            <div className="rounded-2xl border border-[#71f5c2]/15 bg-[#71f5c2]/[0.045] p-4 text-xs leading-5 text-[#a9d9c7]/70">
              <p className="mb-1 text-[#9fe8c4]">本地来源</p>
              <p className="truncate">{draft.sourceFileName ?? "手动输入内容"}</p>
              <p>共 {draft.sourceText.length.toLocaleString("zh-CN")} 个字符，原文不会随建档自动上传。</p>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-6 rounded-xl bg-[#ff9ca8]/10 px-4 py-3 text-sm text-[#ffb1ba]">{error}</p>
        )}

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[#c8aaff]/10 pt-6 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={() => void handleBack()}
            className="min-h-11 touch-manipulation rounded-full px-6 py-3 text-sm text-[#d5b8f5]/55 hover:bg-white/5"
          >
            返回修改内容
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={saving}
            className="min-h-11 touch-manipulation rounded-full px-8 py-3 text-sm font-medium text-[#171423] transition-transform hover:scale-[1.02] disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${accent}, #c8aaff)`,
              boxShadow: `0 8px 30px ${accent}25`,
            }}
          >
            {saving ? "正在建立世界…" : "确认并创建 V3 梦境"}
          </button>
        </div>
      </main>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-[#c8aaff]/12 bg-[#211d33]/75 p-5 backdrop-blur-sm sm:p-6">
      <h2 className="text-base font-medium text-[#eee2f8]">{title}</h2>
      <p className="mb-5 mt-1 text-xs leading-5 text-[#d5b8f5]/42">{subtitle}</p>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block last:mb-0">
      <span className="mb-2 block text-xs text-[#d5b8f5]/58">{label}</span>
      {children}
    </label>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#171423]">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#c8aaff] border-t-transparent" />
    </div>
  );
}
