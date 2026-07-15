import { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const { messages, apiKey } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 如果用户提供了自己的 Key，使用用户的；否则使用环境变量中的系统 Key
    const effectiveKey = apiKey || process.env.DEEPSEEK_API_KEY;

    if (!effectiveKey) {
      return new Response(
        JSON.stringify({ error: "未配置 API Key，请在设置中填写你的 DeepSeek API Key" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 调用 DeepSeek API（OpenAI 兼容接口）
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${effectiveKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        stream: true,
        temperature: 0.8,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DeepSeek API error:", response.status, errorText);

      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "API Key 无效，请检查你的 DeepSeek API Key" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: `AI 服务暂时不可用 (${response.status})` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // 将流式响应直接透传给前端
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "梦境暂时中断，请稍后重试" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
