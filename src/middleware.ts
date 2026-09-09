import { NextRequest, NextResponse } from "next/server";

// Basic Auth para o deploy público (insta.sinteseia.com.br).
// Sem BASIC_AUTH_PASS no env (ex.: dev local), passa direto.
export function middleware(req: NextRequest) {
  const pass = process.env.BASIC_AUTH_PASS;
  if (!pass) return NextResponse.next();

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const [user, pwd] = atob(header.slice(6)).split(":");
    if (user === (process.env.BASIC_AUTH_USER ?? "admin") && pwd === pass) {
      return NextResponse.next();
    }
  }
  return new NextResponse("autenticação necessária", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="viral-radar"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
