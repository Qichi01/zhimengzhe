import { NextRequest, NextResponse } from "next/server";
import {
  type ProviderId,
  getProvider,
  buildApiRequest,
} from "@/lib/providers";

export const runtime = "nodejs";

// 开发环境下绕过自签名证书问题（代理软件导致的 SSL 拦截）
if (process.env.NODE_ENV === "development") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

// ============================================================
// 免费模型配置
// 免费用户（无 API Key、非会员）自动使用 GLM-4-Flash
// GLM-4-Flash 永久免费、无 Token 上限，仅限 30 并发
// ============================================================
const FREE_PROVIDER: ProviderId = "glm";
const FREE_MODEL = "glm-4-flash";

// ============================================================
// Claude SSE 流转换
// Claude 的 SSE 格式与 OpenAI 不同，需要转换为 OpenAI 格式
// ============================================================
async function convertClaudeStreamToOpenAI(
  response: Response
): Promise<ReadableStream<Uint8Array>> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (!data || data === "[DONE]") continue;

            try {
              const json = JSON.parse(data);

              if (json.type === "content_block_delta" && json.delta?.text) {
                const openaiChunk = {
                  choices: [
                    {
                      delta: { content: json.delta.text },
                      index: 0,
                    },
                  ],
                };
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`)
                );
              }

              if (json.type === "message_stop") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
            } catch {
              /* ignore parse errors */
            }
          }
        }
      } catch (e) {
        controller.error(e);
      } finally {
        controller.close();
      }
    },
  });
}

// ============================================================
// 主路由
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const {
      messages,
      apiKey,
      providerId,
      modelId,
    } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages is required" },
        { status: 400 }
      );
    }

    // 解析 provider（默认 deepseek，兼容旧版）
    let pid: ProviderId = (providerId as ProviderId) || "deepseek";
    let provider = getProvider(pid);
    let mid = modelId || provider.models[0].id;
    let effectiveKey = apiKey || "";

    // 如果用户没有提供自己的 Key
    if (!effectiveKey) {
      // 免费用户：自动使用 GLM-4-Flash（永久免费、不限次数）
      const glmKey = process.env.GLM_API_KEY || process.env.DEEPSEEK_API_KEY || "";

      if (glmKey) {
        // 强制使用 GLM-4-Flash
        pid = FREE_PROVIDER;
        provider = getProvider(pid);
        mid = FREE_MODEL;
        effectiveKey = glmKey;
      } else {
        // 没有配置任何系统 Key
        return NextResponse.json(
          {
            error: "服务暂时无法使用，请在设置中填写你的 API Key",
          },
          { status: 503 }
        );
      }
    }

    // 构建请求参数
    const { url, headers, body } = buildApiRequest(
      pid,
      mid,
      effectiveKey,
      messages,
      {
        stream: true,
        temperature: 0.8,
        maxTokens: 800,
      }
    );

    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${provider.label} API error:`, response.status, errorText);

      if (response.status === 401) {
        return NextResponse.json(
          { error: `API Key 无效，请检查你的 ${provider.label} API Key` },
          { status: 401 }
        );
      }

      let errorMsg = `${provider.label} 服务暂时不可用 (${response.status})`;
      try {
        const errJson = JSON.parse(errorText);
        if (errJson?.error?.message) {
          errorMsg = errJson.error.message;
        } else if (errJson?.message) {
          errorMsg = errJson.message;
        }
      } catch {
        /* ignore */
      }

      return NextResponse.json(
        { error: errorMsg },
        { status: 502 }
      );
    }

    // Claude 流格式不同，需要转换
    if (!provider.openaiCompatible) {
      const convertedStream = await convertClaudeStreamToOpenAI(response);
      return new Response(convertedStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // OpenAI 兼容格式：直接透传流
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "梦境暂时中断，请稍后重试" },
      { status: 500 }
    );
  }
}
