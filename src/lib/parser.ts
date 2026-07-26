import type { Option, ParsedAIResponse, RelationshipUpdate, SceneLayoutData, MapRoom } from "@/types";

/**
 * 解析 AI 返回的文本，提取场景描述、选项、章节标记、关系更新等
 */
export function parseAIResponse(text: string): ParsedAIResponse {
  const fullText = text.trim();

  // 检查是否结局
  const isEnding = fullText.includes("【结局】") || fullText.includes("[结局]");

  // 提取章节标记
  let chapterMarker: ParsedAIResponse["chapterMarker"] | undefined;
  const chapterRegex = /【第(\d+)章[：:](.+?)】/;
  const chapterMatch = fullText.match(chapterRegex);
  if (chapterMatch) {
    chapterMarker = {
      number: parseInt(chapterMatch[1], 10),
      title: chapterMatch[2].trim(),
    };
  }

  // 提取关系更新（乙游）
  let relationshipUpdates: RelationshipUpdate[] | undefined;
  const relationRegex = /\[关系更新\]([\s\S]*?)(?=\[场景布局\]|$)/;
  const relationMatch = fullText.match(relationRegex);
  if (relationMatch) {
    relationshipUpdates = parseRelationshipUpdates(relationMatch[1]);
  }

  // 提取场景布局（悬疑）
  let sceneLayout: SceneLayoutData | undefined;
  const layoutRegex = /\[场景布局\]([\s\S]*?)$/;
  const layoutMatch = fullText.match(layoutRegex);
  if (layoutMatch) {
    sceneLayout = parseSceneLayout(layoutMatch[1]);
  }

  // 移除附加信息，只保留场景描述 + 选项
  let cleanText = fullText
    .replace(chapterRegex, "")
    .replace(relationRegex, "")
    .replace(layoutRegex, "")
    .trim();

  // 尝试匹配选项部分
  const optionRegex = /选项[：:]\s*\n([\s\S]*?)$/;
  const optionMatch = cleanText.match(optionRegex);

  let content = cleanText;
  let options: Option[] = [];

  if (optionMatch) {
    content = cleanText.substring(0, optionMatch.index).trim();
    options = parseOptions(optionMatch[1]);
  } else {
    // 没有匹配到选项格式，尝试找 A. B. C. D. 的模式
    const altOptionRegex = /\n([A-D])[.、．]\s+/;
    const altMatch = cleanText.match(altOptionRegex);
    if (altMatch && !isEnding) {
      const splitIndex = cleanText.indexOf(altMatch[0]);
      content = cleanText.substring(0, splitIndex).trim();
      const optionSection = cleanText.substring(splitIndex);
      options = parseOptions(optionSection);
    }
  }

  // 清理场景描述中的结尾标记
  content = content
    .replace(/【结局】/g, "")
    .replace(/\[结局\]/g, "")
    .trim();

  return { content, options, isEnding, chapterMarker, relationshipUpdates, sceneLayout };
}

/** 解析选项 */
function parseOptions(text: string): Option[] {
  const lines = text.split("\n").filter((line) => line.trim());
  const options: Option[] = [];
  for (const line of lines) {
    const match = line.match(/^([A-D])[.、．]\s*(.+)/);
    if (match) {
      options.push({ label: match[1], text: match[2].trim() });
    }
  }
  return options;
}

/** 解析关系更新 */
function parseRelationshipUpdates(text: string): RelationshipUpdate[] {
  const lines = text.split("\n").filter((line) => line.trim().startsWith("-"));
  const updates: RelationshipUpdate[] = [];

  for (const line of lines) {
    // 格式: - 角色名：关系标签：新增/变化（角色描述）
    // 括号内的描述可能包含冒号，所以用非贪婪匹配并在括号前停止
    const match = line.match(
      /^-\s*(.+?)[：:]\s*(.+?)[：:]\s*(新增|变化)(?:[（(]([\s\S]+?)[)）])?$/
    );
    if (match) {
      updates.push({
        characterName: match[1].trim(),
        relationLabel: match[2].trim(),
        action: match[3] as "new" | "change",
        description: match[4]?.trim(),
      });
    }
  }

  return updates;
}

/** 解析场景布局 */
function parseSceneLayout(text: string): SceneLayoutData | undefined {
  const lines = text.split("\n").filter((line) => line.trim());

  let locationName = "";
  const rooms: MapRoom[] = [];
  const keyItems: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // 地点名称
    const locMatch = trimmed.match(/地点名称[：:]\s*(.+)/);
    if (locMatch) {
      locationName = locMatch[1].trim();
      continue;
    }

    // 房间
    const roomMatch = trimmed.match(/-\s*(.+?)（x:(-?\d+),\s*y:(-?\d+),\s*w:(\d+),\s*h:(\d+)）连接[：:]\s*(.*)/);
    if (roomMatch) {
      rooms.push({
        name: roomMatch[1].trim(),
        x: parseInt(roomMatch[2], 10),
        y: parseInt(roomMatch[3], 10),
        w: parseInt(roomMatch[4], 10),
        h: parseInt(roomMatch[5], 10),
        connections: roomMatch[6].split(",").map((s) => s.trim()).filter(Boolean),
      });
      continue;
    }

    // 关键物品
    const itemMatch = trimmed.match(/关键物品[：:]\s*(.+)/);
    if (itemMatch) {
      keyItems.push(...itemMatch[1].split(/[、,，]/).map((s) => s.trim()).filter(Boolean));
    }
  }

  if (!locationName && rooms.length === 0) return undefined;
  return { locationName, rooms, keyItems };
}

/**
 * 兼容 V1 的简单解析（不含附加信息）
 */
export function parseAIResponseSimple(text: string): {
  content: string;
  options: Option[];
  isEnding: boolean;
} {
  const result = parseAIResponse(text);
  return {
    content: result.content,
    options: result.options,
    isEnding: result.isEnding,
  };
}
