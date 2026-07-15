import type { Option } from "@/types";

/**
 * 解析 AI 返回的文本，提取场景描述和选项
 */
export function parseAIResponse(text: string): {
  content: string;
  options: Option[];
  isEnding: boolean;
} {
  const fullText = text.trim();

  // 检查是否结局
  const isEnding = fullText.includes("【结局】") || fullText.includes("[结局]");

  // 尝试匹配选项部分
  // 格式: "选项：\nA. xxx\nB. xxx"
  const optionRegex = /选项[：:]\s*\n([\s\S]*?)$/;
  const optionMatch = fullText.match(optionRegex);

  let content = fullText;
  let options: Option[] = [];

  if (optionMatch) {
    // 场景描述 = 选项之前的内容
    content = fullText.substring(0, optionMatch.index).trim();

    // 解析选项
    const optionText = optionMatch[1];
    const optionLines = optionText.split("\n").filter((line) => line.trim());

    for (const line of optionLines) {
      const lineMatch = line.match(/^([A-D])[.、．]\s*(.+)/);
      if (lineMatch) {
        options.push({
          label: lineMatch[1],
          text: lineMatch[2].trim(),
        });
      }
    }
  } else {
    // 没有匹配到选项格式，尝试找 A. B. C. D. 的模式
    const altOptionRegex = /\n([A-D])[.、．]\s+/;
    const altMatch = fullText.match(altOptionRegex);
    if (altMatch && !isEnding) {
      const splitIndex = fullText.indexOf(altMatch[0]);
      content = fullText.substring(0, splitIndex).trim();

      const optionSection = fullText.substring(splitIndex);
      const optionLines = optionSection.split("\n").filter((line) => line.trim());
      for (const line of optionLines) {
        const lineMatch = line.match(/^([A-D])[.、．]\s*(.+)/);
        if (lineMatch) {
          options.push({
            label: lineMatch[1],
            text: lineMatch[2].trim(),
          });
        }
      }
    }
  }

  // 清理场景描述中的结尾标记
  content = content
    .replace(/【结局】/g, "")
    .replace(/\[结局\]/g, "")
    .trim();

  return { content, options, isEnding };
}
