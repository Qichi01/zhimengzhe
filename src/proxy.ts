import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next.js 16 Proxy（原 Middleware）
 * 刷新用户的 Supabase auth session
 * 如果 Supabase 环境变量未配置，跳过 session 刷新
 */
export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase 未配置时，直接放行
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // 刷新 session（重要：不要在 proxy 中做权限判断，仅刷新）
    await supabase.auth.getUser();
  } catch {
    // Supabase 出错时不阻塞请求
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，排除：
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico
     * - public 目录
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
