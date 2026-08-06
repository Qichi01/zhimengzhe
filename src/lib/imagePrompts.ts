import type { GameType } from "@/types";

const VISUAL_REPLACEMENTS: Array<[RegExp, string]> = [
  [
    /(恐怖|惊悚|诡异|阴森|惊吓|鬼怪|鬼魂|幽灵|恶灵|邪灵|闹鬼|horror|scary|creepy|eerie|haunted)/gi,
    "神秘冒险",
  ],
  [
    /(血腥|鲜血|流血|血泊|断肢|肢解|内脏|尸体|尸块|腐烂|溃烂|斩首|割喉|gore|gory|blood|bloody|corpse|dismembered|decay)/gi,
    "非写实的紧张冲突",
  ],
  [
    /(色情|情色|裸露|裸体|性行为|成人内容|porn|pornographic|erotic|nude|nudity|sexual)/gi,
    "全年龄且服装得体",
  ],
];

/** 仅用于图片提示词，不修改用户保存的原始人物与剧情设定。 */
export function sanitizeVisualReference(value: string, maxLength: number): string {
  let sanitized = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [pattern, replacement] of VISUAL_REPLACEMENTS) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  return sanitized.replace(/(?:\s*[,，;；。]\s*){2,}/g, "；").slice(0, maxLength);
}

export function buildAvatarPrompt(
  gameType: GameType,
  characterName: string,
  description: string
): string {
  const styleByType: Record<GameType, string> = {
    otome:
      "精致互动恋爱游戏角色档案头像，清透明亮，柔和自然光，人物情绪细腻，服饰整洁",
    mystery:
      "电影感推理冒险角色档案头像，清晰克制的光影，人物可信自然，画面明亮舒适",
    other:
      "高品质多世界冒险角色档案头像，富有成长感与活力，色彩清晰，人物亲和自然",
  };
  const safeName = sanitizeVisualReference(characterName, 80) || "未命名角色";
  const safeDescription = sanitizeVisualReference(description, 500);

  return [
    "SINGLE CHARACTER PROFILE PORTRAIT. EXACTLY ONE SUBJECT. 这是人物头像，不是风景图",
    styleByType[gameType],
    "Portrait crop: head-and-shoulders or waist-up. The character is centered, fills about 80% of the square frame, with a large clear face and a plain pastel background",
    "Use the role reference as the only source for species, age, hairstyle, clothing and personality. Keep the character natural, friendly, fully clothed and suitable for general audiences",
    "The final image contains one character only, with no other people, scenery, text, border, interface, logo or watermark",
    `角色姓名（这是姓名，不是地点）：${safeName}`,
    safeDescription
      ? `用户提供的角色介绍：${safeDescription}`
      : "用户未提供具体外观时，使用自然、简洁、亲和的中性角色形象",
  ].join("。\n");
}

export function buildSceneImagePrompt(
  gameType: GameType,
  storySetting: string,
  sceneContent: string
): string {
  const styleByType: Record<GameType, string> = {
    otome:
      "精致互动恋爱游戏场景原画，人物情绪细腻，柔和自然光，浪漫但克制，环境清新舒适",
    mystery:
      "电影级推理冒险概念艺术，线索与空间细节清晰，理性悬念感，光影克制但不阴森",
    other:
      "高品质多世界冒险场景概念艺术，明快有冲击力，突出成长、探索、任务推进与爽感，环境层次丰富",
  };
  const safeSetting = sanitizeVisualReference(storySetting, 500);
  const safeScene = sanitizeVisualReference(sceneContent, 1000);

  return [
    "STORY SCENE ILLUSTRATION. 16:9 WIDE COMPOSITION. 这是剧情场景插图",
    `当前必须表现的关键场景：${safeScene}`,
    safeSetting ? `世界观与角色背景：${safeSetting}` : "",
    styleByType[gameType],
    "单一连续场景，清晰表现当前人物动作、地点与核心物件，使用全年龄的冒险表达；画面明亮舒适，人物状态自然完整、服装得体",
    "画面不包含分镜、边框、界面、字幕、标志或文字",
  ]
    .filter(Boolean)
    .join("。\n");
}
