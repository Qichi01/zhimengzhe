import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  type ProviderId,
  getProvider,
  buildApiRequest,
  convertToClaudeFormat,
} from "@/lib/providers";

export const runtime = "nodejs";

// 开发环境下绕过自签名证书问题（代理软件导致的 SSL 拦截）
if (process.env.NODE_ENV === "development") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const MAX_FREE_TRIALS = 20;

// ============================================================
// 设备级免费次数限制（进程级内存，防止明显滥用）
// ============================================================
interface DeviceUsage {
  count: number;
  resetAt: number;
}

const deviceUsageMap = new Map<string, DeviceUsage>();

function checkDeviceLimit(deviceId: string): { ok: boolean; remaining: number } {
  const now = Date.now();
  const record = deviceUsageMap.get(deviceId);

  if (!record || now > record.resetAt) {
    deviceUsageMap.set(deviceId, {
      count: 1,
      resetAt: now + 24 * 60 * 60 * 1000,
    });
    return { ok: true, remaining: MAX_FREE_TRIALS - 1 };
  }

  if (record.count >= MAX_FREE_TRIALS) {
    return { ok: false, remaining: 0 };
  }

  record.count++;
  return { ok: true, remaining: MAX_FREE_TRIALS - record.count };
}

// ============================================================
// 已登录用户：Supabase 验证
// ============================================================
async function checkUserAccess(userId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("membership_plan, membership_expires_at, free_trial_used")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    return { ok: false, error: "无法验证用户状态，请重新登录" };
  }

  const isPremium =
    profile.membership_plan !== "free" &&
    profile.membership_expires_at &&
    new Date(profile.membership_expires_at).getTime() > Date.now();

  if (isPremium) {
    return { ok: true };
  }

  if (profile.free_trial_used >= MAX_FREE_TRIALS) {
    return { ok: false, error: "free_exhausted" };
  }

  const { error: updateError } = await supabase
    .from("user_profiles")
    .update({ free_trial_used: profile.free_trial_used + 1 })
    .eq("id", userId);

  if (updateError) {
    return { ok: false, error: "无法更新体验次数" };
  }

  return { ok: true };
}

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

              // Claude 的 content_block_delta 事件包含文本增量
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

              // Claude 流结束
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
      deviceId,
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
    const pid: ProviderId = (providerId as ProviderId) || "deepseek";
    const provider = getProvider(pid);
    const mid = modelId || provider.models[0].id;

    let effectiveKey = apiKey || "";

    // 如果用户没有提供自己的 Key，需要校验会员/免费次数
    if (!effectiveKey) {
      let userId: string | null = null;

      try {
        const supabase = await createClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) userId = authUser.id;
      } catch {
        // Supabase 不可用时降级为匿名模式
      }

      if (userId) {
        const access = await checkUserAccess(userId);

        if (!access.ok) {
          if (access.error === "free_exhausted") {
            return NextResponse.json(
              {
                error: "free_exhausted",
                message: "免费体验次数已用完，开通会员或填入 API Key 继续畅玩",
              },
              { status: 403 }
            );
          }
          return NextResponse.json(
            { error: access.error || "无法验证使用权限" },
            { status: 403 }
          );
        }
      } else {
        if (!deviceId) {
          return NextResponse.json(
            { error: "未提供设备标识，请刷新页面重试" },
            { status: 400 }
          );
        }

        const deviceCheck = checkDeviceLimit(deviceId);
        if (!deviceCheck.ok) {
          return NextResponse.json(
            {
              error: "free_exhausted",
              message: "免费体验次数已用完，开通会员、登录账号或填入 API Key 继续畅玩",
            },
            { status: 403 }
          );
        }
      }

      // 免费用户/会员：使用系统默认 DeepSeek Key
      effectiveKey = process.env.DEEPSEEK_API_KEY || "";
      // 系统 Key 只能用 DeepSeek
      if (pid !== "deepseek" && !apiKey) {
        // 用户选了其他 provider 但没填 Key → 提示需要填写
        return NextResponse.json(
          {
            error: `使用 ${provider.label} 需要在设置中填写对应的 API Key`,
          },
          { status: 401 }
        );
      }
    }

    if (!effectiveKey) {
      return NextResponse.json(
        { error: "未配置 API Key，请在设置中填写你的 API Key" },
        { status: 401 }
      );
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

      // 尝试提取错误信息
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
