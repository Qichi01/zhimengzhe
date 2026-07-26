// ============================================================
// AI 提供商配置
// 支持国内外主流大模型 API，统一通过 OpenAI 兼容接口调用
// Claude 使用独立的 Messages API 适配层
// ============================================================

export type ProviderId =
  | "deepseek"
  | "openai"
  | "claude"
  | "qwen"
  | "glm"
  | "kimi"
  | "ernie";

export interface ProviderModel {
  /** 模型 ID（传给 API 的 model 字段） */
  id: string;
  /** 显示名称 */
  label: string;
  /** 上下文窗口（token 数） */
  contextWindow: number;
  /** 是否推荐（默认选中） */
  recommended?: boolean;
}

export interface ProviderConfig {
  /** 提供商 ID */
  id: ProviderId;
  /** 显示名称 */
  label: string;
  /** 提供商描述 */
  description: string;
  /** API Base URL（不含 /chat/completions） */
  baseUrl: string;
  /** 完整的 chat completions 端点 */
  chatEndpoint: string;
  /** 是否使用 OpenAI 兼容格式 */
  openaiCompatible: boolean;
  /** API Key 获取链接 */
  apiKeyUrl: string;
  /** API Key 前缀提示 */
  keyPrefix: string;
  /** 支持的模型列表 */
  models: ProviderModel[];
  /** 是否为国产 API */
  isChinese: boolean;
  /** 是否支持流式 */
  supportsStream: boolean;
}

// ============================================================
// 提供商配置
// ============================================================

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  deepseek: {
    id: "deepseek",
    label: "DeepSeek 深度求索",
    description: "性价比极高，中文创作能力强",
    baseUrl: "https://api.deepseek.com",
    chatEndpoint: "https://api.deepseek.com/chat/completions",
    openaiCompatible: true,
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    keyPrefix: "sk-",
    isChinese: true,
    supportsStream: true,
    models: [
      { id: "deepseek-chat", label: "DeepSeek Chat（推荐）", contextWindow: 64000, recommended: true },
      { id: "deepseek-reasoner", label: "DeepSeek Reasoner（推理）", contextWindow: 64000 },
    ],
  },

  openai: {
    id: "openai",
    label: "OpenAI",
    description: "GPT 系列，全球最强通用模型",
    baseUrl: "https://api.openai.com/v1",
    chatEndpoint: "https://api.openai.com/v1/chat/completions",
    openaiCompatible: true,
    apiKeyUrl: "https://platform.openai.com/api-keys",
    keyPrefix: "sk-",
    isChinese: false,
    supportsStream: true,
    models: [
      { id: "gpt-4o", label: "GPT-4o（推荐）", contextWindow: 128000, recommended: true },
      { id: "gpt-4o-mini", label: "GPT-4o mini（快速便宜）", contextWindow: 128000 },
      { id: "gpt-4-turbo", label: "GPT-4 Turbo", contextWindow: 128000 },
    ],
  },

  claude: {
    id: "claude",
    label: "Anthropic Claude",
    description: "文学创作能力强，叙事细腻优美",
    baseUrl: "https://api.anthropic.com",
    chatEndpoint: "https://api.anthropic.com/v1/messages",
    openaiCompatible: false,
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
    keyPrefix: "sk-ant-",
    isChinese: false,
    supportsStream: true,
    models: [
      { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4（推荐）", contextWindow: 200000, recommended: true },
      { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", contextWindow: 200000 },
      { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku（快速）", contextWindow: 200000 },
    ],
  },

  qwen: {
    id: "qwen",
    label: "通义千问 Qwen",
    description: "阿里云出品，中文理解出色",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    chatEndpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    openaiCompatible: true,
    apiKeyUrl: "https://dashscope.console.aliyun.com/apiKey",
    keyPrefix: "sk-",
    isChinese: true,
    supportsStream: true,
    models: [
      { id: "qwen-plus", label: "Qwen Plus（推荐）", contextWindow: 131072, recommended: true },
      { id: "qwen-turbo", label: "Qwen Turbo（快速）", contextWindow: 1000000 },
      { id: "qwen-max", label: "Qwen Max（旗舰）", contextWindow: 32768 },
    ],
  },

  glm: {
    id: "glm",
    label: "智谱 GLM",
    description: "清华系大模型，flash 模型免费",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    chatEndpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    openaiCompatible: true,
    apiKeyUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    keyPrefix: "",
    isChinese: true,
    supportsStream: true,
    models: [
      { id: "glm-4", label: "GLM-4（推荐）", contextWindow: 128000, recommended: true },
      { id: "glm-4-flash", label: "GLM-4 Flash（免费）", contextWindow: 128000 },
      { id: "glm-4-air", label: "GLM-4 Air（轻量）", contextWindow: 128000 },
    ],
  },

  kimi: {
    id: "kimi",
    label: "Kimi 月之暗面",
    description: "超长上下文，适合复杂故事线",
    baseUrl: "https://api.moonshot.cn/v1",
    chatEndpoint: "https://api.moonshot.cn/v1/chat/completions",
    openaiCompatible: true,
    apiKeyUrl: "https://platform.moonshot.cn/console/api-keys",
    keyPrefix: "sk-",
    isChinese: true,
    supportsStream: true,
    models: [
      { id: "moonshot-v1-8k", label: "Moonshot v1 8K（推荐）", contextWindow: 8000, recommended: true },
      { id: "moonshot-v1-32k", label: "Moonshot v1 32K", contextWindow: 32000 },
      { id: "moonshot-v1-128k", label: "Moonshot v1 128K（超长）", contextWindow: 128000 },
    ],
  },

  ernie: {
    id: "ernie",
    label: "文心一言 ERNIE",
    description: "百度大模型，千帆 v2 兼容接口",
    baseUrl: "https://qianfan.baidubce.com/v2",
    chatEndpoint: "https://qianfan.baidubce.com/v2/chat/completions",
    openaiCompatible: true,
    apiKeyUrl: "https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application",
    keyPrefix: "",
    isChinese: true,
    supportsStream: true,
    models: [
      { id: "ernie-4.0-turbo-8k", label: "ERNIE 4.0 Turbo（推荐）", contextWindow: 8000, recommended: true },
      { id: "ernie-3.5-8k", label: "ERNIE 3.5 8K（免费）", contextWindow: 8000 },
      { id: "ernie-4.0-8k-latest", label: "ERNIE 4.0 旗舰", contextWindow: 8000 },
    ],
  },
};

// ============================================================
// 辅助函数
// ============================================================

/** 获取提供商配置 */
export function getProvider(id: ProviderId): ProviderConfig {
  return PROVIDERS[id] ?? PROVIDERS.deepseek;
}

/** 获取提供商的默认模型 */
export function getDefaultModel(id: ProviderId): ProviderModel {
  const provider = getProvider(id);
  return provider.models.find((m) => m.recommended) ?? provider.models[0];
}

/** 所有提供商列表（用于 UI 展示） */
export const PROVIDER_LIST = Object.values(PROVIDERS).sort((a, b) => {
  // 国产优先，再按名称排序
  if (a.isChinese && !b.isChinese) return -1;
  if (!a.isChinese && b.isChinese) return 1;
  return a.label.localeCompare(b.label);
});

// ============================================================
// Claude Messages API 适配
// 将 OpenAI 格式的 messages 转换为 Claude 格式
// ============================================================

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * 将 OpenAI 格式的 messages 转换为 Claude Messages API 格式
 * - system 消息提取为顶层字段
 * - 其余消息保持 user/assistant 交替
 */
export function convertToClaudeFormat(
  messages: { role: string; content: string }[]
): { system: string; messages: ClaudeMessage[] } {
  let system = "";
  const claudeMessages: ClaudeMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      system += (system ? "\n\n" : "") + msg.content;
    } else {
      claudeMessages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }
  }

  // Claude 要求首条消息必须是 user
  // 如果首条是 assistant，前面补一个空 user 消息
  if (claudeMessages.length > 0 && claudeMessages[0].role === "assistant") {
    claudeMessages.unshift({ role: "user", content: "继续" });
  }

  return { system, messages: claudeMessages };
}

/**
 * 构建调用 API 的请求参数
 * 根据 provider 返回对应的 fetch 参数
 */
export function buildApiRequest(
  providerId: ProviderId,
  modelId: string,
  apiKey: string,
  messages: { role: string; content: string }[],
  options?: {
    stream?: boolean;
    temperature?: number;
    maxTokens?: number;
  }
): { url: string; headers: Record<string, string>; body: string } {
  const provider = getProvider(providerId);
  const stream = options?.stream ?? true;
  const temperature = options?.temperature ?? 0.8;
  const maxTokens = options?.maxTokens ?? 800;

  if (!provider.openaiCompatible) {
    // Claude Messages API
    const { system, messages: claudeMessages } = convertToClaudeFormat(messages);
    return {
      url: provider.chatEndpoint,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelId,
        system,
        messages: claudeMessages,
        max_tokens: maxTokens,
        stream,
        ...(stream ? { stream: true } : {}),
      }),
    };
  }

  // OpenAI 兼容格式
  return {
    url: provider.chatEndpoint,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages,
      stream,
      temperature,
      max_tokens: maxTokens,
    }),
  };
}
