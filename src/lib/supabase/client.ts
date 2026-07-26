import { createBrowserClient } from "@supabase/ssr";

/**
 * 浏览器端 Supabase 客户端
 * 使用 NEXT_PUBLIC_ 前缀的环境变量（客户端可见）
 * 如果环境变量未配置，返回 null 而非抛出异常
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  try {
    return createBrowserClient(url, anonKey);
  } catch {
    // 环境变量值无效时返回 null，不崩溃
    return null;
  }
}
