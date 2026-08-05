"use client";

import { useMemo, useState } from "react";
import CharacterAvatar from "@/components/CharacterAvatar";
import { getGenrePack, markNarrativeModuleRead } from "@/lib/narrative";
import type {
  Character,
  Game,
  NarrativeModuleDefinition,
  NarrativeModuleId,
  WorldDefinition,
  WorldState,
} from "@/types";

interface V3ImmersiveShellProps {
  game: Game;
  definition: WorldDefinition | null;
  state: WorldState | null;
  characters: Character[];
  onStateChange: (state: WorldState) => void | Promise<void>;
}

const MODULE_ICONS: Partial<Record<NarrativeModuleId, string>> = {
  messages: "✉",
  moments: "◎",
  forum: "⌁",
  calendar: "▦",
  system_panel: "◇",
  team_channel: "◫",
  inventory: "▣",
  shop: "◆",
  relationships: "♡",
  archive: "▤",
};

export default function V3ImmersiveShell({
  game,
  definition,
  state,
  characters,
  onStateChange,
}: V3ImmersiveShellProps) {
  const [activeModule, setActiveModule] = useState<NarrativeModuleId | null>(null);
  const genreId = game.genre_pack_id;
  const genrePack = genreId ? getGenrePack(genreId) : null;
  const isCampus = genreId === "campus_otome";
  const enabledModules = new Set(
    definition?.enabledModules ?? genrePack?.modules.map((module) => module.id) ?? []
  );
  const modules = (genrePack?.modules ?? []).filter(
    (module) => module.id !== "reader" && enabledModules.has(module.id)
  );
  const characterById = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters]
  );

  if (!genrePack || modules.length === 0) return null;

  const openModule = (module: NarrativeModuleDefinition) => {
    if (!isModuleUnlocked(module, state)) return;
    setActiveModule(module.id);
    if (!state || (state.unreadByModule[module.id] ?? 0) === 0) return;
    const next = markNarrativeModuleRead(state, module.id);
    void onStateChange(next);
  };

  return (
    <>
      <div
        className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto border-t px-4 py-3 backdrop-blur-xl lg:hidden"
        style={{
          borderColor: "rgba(200,170,255,0.16)",
          background: "rgba(0,0,0,0.16)",
        }}
        aria-label={isCampus ? "校园手机功能" : "无限流系统功能"}
      >
        {modules.map((module) => (
          <ModuleButton
            key={module.id}
            module={module}
            state={state}
            compact
            onClick={() => openModule(module)}
          />
        ))}
      </div>

      <aside
        className="fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-2 rounded-3xl border p-2 shadow-2xl backdrop-blur-xl lg:flex"
        style={{
          borderColor: isCampus ? "rgba(255,179,217,0.28)" : "rgba(113,245,194,0.28)",
          background: isCampus ? "rgba(43,31,50,0.78)" : "rgba(10,20,17,0.86)",
        }}
        aria-label={isCampus ? "校园手机功能" : "无限流系统功能"}
      >
        {modules.map((module) => (
          <ModuleButton
            key={module.id}
            module={module}
            state={state}
            onClick={() => openModule(module)}
          />
        ))}
      </aside>

      {activeModule && (
        <ModuleDrawer
          activeModule={activeModule}
          isCampus={isCampus}
          state={state}
          characters={characters}
          characterById={characterById}
          onClose={() => setActiveModule(null)}
        />
      )}
    </>
  );
}

function ModuleButton({
  module,
  state,
  compact = false,
  onClick,
}: {
  module: NarrativeModuleDefinition;
  state: WorldState | null;
  compact?: boolean;
  onClick: () => void;
}) {
  const unlocked = isModuleUnlocked(module, state);
  const unread = state?.unreadByModule[module.id] ?? 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!unlocked}
      className={
        compact
          ? "relative flex min-h-14 min-w-[4.25rem] touch-manipulation flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] px-2 text-[11px] text-[#eadcf4] disabled:opacity-35"
          : "relative flex min-h-12 min-w-12 touch-manipulation flex-col items-center justify-center rounded-2xl px-2 text-[10px] text-[#eadcf4] transition-colors hover:bg-white/10 disabled:opacity-30"
      }
      aria-label={`${module.label}${unread > 0 ? `，${unread} 条未读` : ""}${unlocked ? "" : "，未解锁"}`}
    >
      <span className="text-lg leading-none">{unlocked ? MODULE_ICONS[module.id] ?? "·" : "⌁"}</span>
      <span className="mt-1 whitespace-nowrap">{module.label}</span>
      {unread > 0 && unlocked && (
        <span className="absolute right-1 top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[#ff7fae] px-1 text-[9px] font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}

function ModuleDrawer({
  activeModule,
  isCampus,
  state,
  characters,
  characterById,
  onClose,
}: {
  activeModule: NarrativeModuleId;
  isCampus: boolean;
  state: WorldState | null;
  characters: Character[];
  characterById: Map<string, Character>;
  onClose: () => void;
}) {
  const label = getModuleLabel(activeModule);
  const accent = isCampus ? "#d978a8" : "#71f5c2";
  const foreground = isCampus ? "#3d2b3b" : "#d8ffef";
  const muted = isCampus ? "#816b7e" : "#7da592";

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={label}>
      <button
        type="button"
        className="absolute inset-0 h-full w-full bg-black/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="关闭沉浸界面"
      />
      <section
        className="absolute inset-x-0 bottom-0 flex max-h-[82dvh] min-h-[52dvh] flex-col overflow-hidden rounded-t-[2rem] border-t shadow-2xl lg:inset-y-0 lg:left-auto lg:right-0 lg:h-full lg:max-h-none lg:min-h-0 lg:w-[430px] lg:rounded-none lg:border-l lg:border-t-0"
        style={{
          color: foreground,
          borderColor: isCampus ? "rgba(217,120,168,0.28)" : "rgba(113,245,194,0.28)",
          background: isCampus
            ? "linear-gradient(180deg, #fffafd 0%, #f6eaf2 100%)"
            : "linear-gradient(180deg, #111b17 0%, #08110e 100%)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <header
          className="flex shrink-0 items-center justify-between border-b px-5 py-3"
          style={{ borderColor: isCampus ? "rgba(92,58,83,0.1)" : "rgba(113,245,194,0.13)" }}
        >
          <div className="min-w-0">
            <p className="text-[10px] tracking-[0.22em]" style={{ color: muted }}>
              {isCampus ? "CAMPUS LINK" : "SURVIVAL SYSTEM"}
            </p>
            <h2 className="mt-1 truncate text-lg font-semibold">{label}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-full border text-lg"
            style={{ borderColor: `${accent}40`, color: accent }}
            aria-label={`关闭${label}`}
          >
            ×
          </button>
        </header>

        <div className="flex items-center justify-between px-5 pb-2 pt-3 text-xs" style={{ color: muted }}>
          <span>{state?.storyTime || "时间尚未同步"}</span>
          <span>{state?.currentLocationId || "位置未知"}</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-2">
          <ModuleContent
            moduleId={activeModule}
            isCampus={isCampus}
            state={state}
            characters={characters}
            characterById={characterById}
            accent={accent}
            muted={muted}
          />
        </div>
      </section>
    </div>
  );
}

function ModuleContent({
  moduleId,
  isCampus,
  state,
  characters,
  characterById,
  accent,
  muted,
}: {
  moduleId: NarrativeModuleId;
  isCampus: boolean;
  state: WorldState | null;
  characters: Character[];
  characterById: Map<string, Character>;
  accent: string;
  muted: string;
}) {
  const surface = isCampus ? "rgba(255,255,255,0.72)" : "rgba(113,245,194,0.055)";
  const border = isCampus ? "rgba(106,67,97,0.11)" : "rgba(113,245,194,0.13)";

  if (moduleId === "messages" || moduleId === "team_channel") {
    const conversations = Object.entries(state?.messages ?? {});
    if (conversations.length === 0) return <EmptyState text={isCampus ? "还没有收到新的私聊" : "队伍频道暂时静默"} muted={muted} />;
    return (
      <div className="space-y-3">
        {conversations.map(([conversationId, messages]) => (
          <article key={conversationId} className="rounded-2xl border p-4" style={{ background: surface, borderColor: border }}>
            <p className="mb-3 text-xs font-medium" style={{ color: muted }}>{conversationId}</p>
            <div className="space-y-3">
              {messages.map((message) => {
                const sender = characterById.get(message.senderCharacterId);
                return (
                  <div key={message.eventId} className="flex items-start gap-3">
                    <CharacterAvatar name={sender?.name ?? "?"} color={sender?.avatar_color ?? accent} avatar={sender?.avatar} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-xs font-semibold" style={{ color: accent }}>{sender?.name ?? "未知联系人"}</p>
                      <p className="rounded-2xl rounded-tl-md px-3 py-2 text-sm leading-6" style={{ background: isCampus ? "#f3ddea" : "rgba(113,245,194,0.09)" }}>{message.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (moduleId === "forum") {
    const posts = state?.forumPosts ?? [];
    if (posts.length === 0) return <EmptyState text={isCampus ? "校园论坛今天很安静" : "玩家论坛暂无新帖"} muted={muted} />;
    return (
      <div className="space-y-3">
        {posts.slice().reverse().map((post) => {
          const author = post.authorCharacterId ? characterById.get(post.authorCharacterId) : null;
          return (
            <article key={post.eventId} className="rounded-2xl border p-4" style={{ background: surface, borderColor: border }}>
              <div className="mb-2 flex items-center justify-between gap-3 text-xs" style={{ color: muted }}>
                <span>#{post.board}</span><span>{post.reliability === "rumor" ? "传闻" : post.reliability === "verified" ? "已证实" : "未验证"}</span>
              </div>
              <h3 className="text-base font-semibold">{post.title}</h3>
              <p className="mt-2 text-sm leading-6">{post.content}</p>
              {author && <p className="mt-3 text-xs" style={{ color: accent }}>发布者：{author.name}</p>}
            </article>
          );
        })}
      </div>
    );
  }

  if (moduleId === "calendar") {
    const entries = state?.calendarEntries ?? [];
    if (entries.length === 0) return <EmptyState text="日历中还没有新的安排" muted={muted} />;
    return (
      <div className="space-y-3">
        {entries.map((entry) => (
          <article key={entry.entryId} className="flex gap-4 rounded-2xl border p-4" style={{ background: surface, borderColor: border }}>
            <div className="w-16 shrink-0 text-sm font-semibold" style={{ color: accent }}>{entry.storyTime}</div>
            <div><h3 className="font-semibold">{entry.title}</h3>{entry.description && <p className="mt-1 text-sm leading-6" style={{ color: muted }}>{entry.description}</p>}</div>
          </article>
        ))}
      </div>
    );
  }

  if (moduleId === "system_panel") {
    const quests = Object.values(state?.quests ?? {}).filter((quest) => quest.status !== "hidden");
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(state?.currencies ?? {}).map(([id, amount]) => (
            <div key={id} className="rounded-2xl border p-3" style={{ background: surface, borderColor: border }}><p className="text-[10px] uppercase" style={{ color: muted }}>{id}</p><p className="mt-1 text-xl font-semibold" style={{ color: accent }}>{amount}</p></div>
          ))}
        </div>
        {quests.length === 0 ? <EmptyState text="系统尚未发布任务" muted={muted} /> : quests.map((quest) => (
          <article key={quest.questId} className="rounded-2xl border p-4" style={{ background: surface, borderColor: border }}>
            <div className="mb-2 flex items-center justify-between gap-3"><h3 className="font-semibold">{quest.title}</h3><span className="text-xs" style={{ color: accent }}>{questStatusLabel(quest.status)}</span></div>
            {quest.description && <p className="text-sm leading-6" style={{ color: muted }}>{quest.description}</p>}
            {quest.progressLabel && <p className="mt-3 text-xs" style={{ color: accent }}>{quest.progressLabel}</p>}
          </article>
        ))}
      </div>
    );
  }

  if (moduleId === "inventory") {
    const items = Object.values(state?.inventory ?? {});
    if (items.length === 0) return <EmptyState text="背包还是空的" muted={muted} />;
    return <div className="grid grid-cols-2 gap-3">{items.map((item) => <article key={item.itemId} className="rounded-2xl border p-4" style={{ background: surface, borderColor: border }}><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border" style={{ borderColor: `${accent}40`, color: accent }}>◇</div><h3 className="font-semibold">{item.name}</h3><p className="mt-1 text-xs" style={{ color: muted }}>数量 × {item.quantity}</p>{item.description && <p className="mt-2 text-xs leading-5" style={{ color: muted }}>{item.description}</p>}</article>)}</div>;
  }

  if (moduleId === "shop") {
    const shops = Object.values(state?.unlockedShops ?? {});
    if (shops.length === 0) return <EmptyState text="系统商店尚未开放" muted={muted} />;
    return <div className="space-y-3">{shops.map((shop) => <article key={shop.shopId} className="rounded-2xl border p-4" style={{ background: surface, borderColor: border }}><p className="text-xs tracking-[0.18em]" style={{ color: accent }}>UNLOCKED</p><h3 className="mt-2 text-lg font-semibold">{shop.name}</h3><p className="mt-1 text-xs" style={{ color: muted }}>结算单位：{shop.currencyId ?? "系统点数"}</p></article>)}</div>;
  }

  if (moduleId === "relationships" || moduleId === "archive") {
    return (
      <div className="space-y-3">
        {characters.map((character) => {
          const relation = state?.relationships[character.id];
          return (
            <article key={character.id} className="flex gap-4 rounded-2xl border p-4" style={{ background: surface, borderColor: border }}>
              <CharacterAvatar name={character.name} color={character.avatar_color} avatar={character.avatar} size={54} />
              <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><h3 className="truncate font-semibold">{character.name}</h3><span className="shrink-0 text-xs" style={{ color: accent }}>{character.role === "protagonist" ? "主角" : relation?.label ?? "待了解"}</span></div>{character.description && <p className="mt-2 text-sm leading-6" style={{ color: muted }}>{character.description}</p>}{relation?.memory && <p className="mt-2 border-l-2 pl-3 text-xs leading-5" style={{ color: muted, borderColor: `${accent}66` }}>{relation.memory}</p>}</div>
            </article>
          );
        })}
      </div>
    );
  }

  return <EmptyState text="该模块会随剧情逐步解锁" muted={muted} />;
}

function isModuleUnlocked(module: NarrativeModuleDefinition, state: WorldState | null): boolean {
  if (module.unlockPolicy === "always") return true;
  if (!state) return false;
  if (module.id === "messages" || module.id === "team_channel") return Object.keys(state.messages).length > 0;
  if (module.id === "forum") return state.forumPosts.length > 0;
  if (module.id === "calendar") return state.calendarEntries.length > 0;
  if (module.id === "inventory") return Object.keys(state.inventory).length > 0;
  if (module.id === "shop") return Object.keys(state.unlockedShops).length > 0;
  if (module.id === "relationships") return Object.keys(state.relationships).length > 0;
  return false;
}

function getModuleLabel(moduleId: NarrativeModuleId): string {
  const labels: Record<NarrativeModuleId, string> = {
    reader: "正文",
    messages: "私聊",
    moments: "动态",
    forum: "论坛",
    calendar: "日历",
    system_panel: "系统面板",
    team_channel: "队伍频道",
    inventory: "背包",
    shop: "系统商店",
    relationships: "人物关系",
    archive: "人物档案",
  };
  return labels[moduleId];
}

function questStatusLabel(status: "hidden" | "active" | "completed" | "failed") {
  return status === "active" ? "进行中" : status === "completed" ? "已完成" : status === "failed" ? "失败" : "隐藏";
}

function EmptyState({ text, muted }: { text: string; muted: string }) {
  return <div className="flex min-h-48 items-center justify-center rounded-3xl border border-dashed px-6 text-center text-sm" style={{ color: muted, borderColor: `${muted}35` }}>{text}</div>;
}
