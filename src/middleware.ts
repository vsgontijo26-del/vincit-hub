import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { can, hubAllowed, toolForPath, type Access } from "@/lib/access";

const PUBLIC = ["/login", "/auth", "/api/meta/webhook", "/api/cron/", "/privacidade", "/p/", "/r/", "/c/"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path.startsWith(p));
  if (!user && !isPublic) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // ── controle de acesso da plataforma (assinatura) ──
  if (user && !isPublic && !path.startsWith("/aguardando") && !path.startsWith("/conta")) {
    const { data } = await supabase.rpc("my_access");
    const acc = (data || { role: "user", status: "pendente", tools: [] }) as Access;
    const go = (to: string, msg?: string) => {
      if (path.startsWith("/api/")) return NextResponse.json({ error: msg || "Acesso não liberado" }, { status: 403 });
      const url = request.nextUrl.clone(); url.pathname = to; url.search = msg ? `?bloqueado=${encodeURIComponent(msg)}` : "";
      return NextResponse.redirect(url);
    };
    if (acc.role !== "superadmin") {
      if (acc.status !== "ativo") return go("/aguardando", "Conta " + acc.status);
      if (path.startsWith("/admin")) return go("/", "Área exclusiva do administrador");
      if ((path.startsWith("/api/ai") || path.startsWith("/api/ref-profile")) && !can(acc.tools, "ia")) return go("/", "IA não incluída no seu plano");
      if (path.startsWith("/api/meta") && !hubAllowed(acc.tools, "creator")) return go("/", "CREATOR não incluído no seu plano");
      for (const hub of ["creator", "agency"] as const) {
        if (path === `/${hub}` || path.startsWith(`/${hub}/`)) {
          if (!hubAllowed(acc.tools, hub)) return go("/", `${hub.toUpperCase()} não incluído no seu plano`);
          const t = toolForPath(path);
          if (t && !can(acc.tools, t)) return go(`/${hub}`, "Ferramenta não incluída no seu plano");
        }
      }
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:png|jpg|svg|webp)$).*)"],
};
