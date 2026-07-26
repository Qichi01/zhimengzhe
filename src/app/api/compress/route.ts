import { NextRequest } from "next/server";
import {
  type ProviderId,
  getProvider,
  buildApiRequest,
} from "@/lib/providers";

export const runtime = "edge";

// 免费模型配置（与 chat route 一致）
const FREE_PROVIDER: ProviderId = "glm";
const FREE_MODEL = "glm-4-flash";

/**
 * 记忆压缩 API
 * 将一段对话历史压缩为简洁的摘要，用于减轻 AI 上下文长度压力
 */
export async function POST(req: NextRequest) {
  try {
    const { messages, chapterTitle, apiKey, providerId, modelId } =
      await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 解析 provider
    let pid: ProviderId = (providerId as ProviderId) || "deepseek";
    let provider = getProvider(pid);
    let mid = modelId || provider.models[0].id;
    let effectiveKey = apiKey || "";

    // 如果用户没有提供自己的 Key，使用 GLM-4-Flash
    if (!effectiveKey) {
      const glmKey = process.env.GLM_API_KEY || process.env.DEEPSEEK_API_KEY || "";
      if (glmKey) {
        pid = FREE_PROVIDER;
        provider = getProvider(pid);
        mid = FREE_MODEL;
        effectiveKey = glmKey;
      } else {
        return new Response(
          JSON.stringify({ error: "未配置 API Key" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 构建压缩 prompt
    const compressPrompt = `你是一位故事摘要专家。请将以下互动小说的对话历史压缩成一段简洁的摘要（200-400字）。

要求：
1. 保留关键剧情转折、角色关系变化、重要发现
2. 保留时间线和因果关系
3. 省略细节描写，只保留核心信息
4. 用第三人称叙述
5. 如果有章节标题，请在摘要开头标注

${chapterTitle ? `章节：${chapterTitle}\n` : ""}

对话历史：
${messages.map((m: { role: string; content: string }) => `[${m.role}] ${m.content}`).join("\n\n")}

请直接输出摘要，不要加任何前缀或解释。`;

    // 使用非流式调用
    const { url, headers, body } = buildApiRequest(
      pid,
      mid,
      effectiveKey,
      [{ role: "user", content: compressPrompt }],
      {
        stream: false,
        temperature: 0.3,
        maxTokens: 600,
      }
    );

    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
    });

    if (!response.ok) {
      console.error("Compress API error:", response.status);
      return new Response(
        JSON.stringify({ error: "压缩服务暂时不可用" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    let summary = "";

    if (!provider.openaiCompatible) {
      // Claude 响应格式
      const data = await response.json();
      summary = data?.content?.[0]?.text ?? "";
    } else {
      // OpenAI 兼容格式
      const data = await response.json();
      summary = data?.choices?.[0]?.message?.content ?? "";
    }

    if (!summary.trim()) {
      return new Response(
        JSON.stringify({ error: "压缩结果为空" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ summary: summary.trim() }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Compress API error:", error);
    return new Response(
      JSON.stringify({ error: "压缩服务异常" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
