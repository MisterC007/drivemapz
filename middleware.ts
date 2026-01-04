import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Publieke routes (toegankelijk zonder login)
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/brand") ||
    pathname.startsWith("/api");

  // Supabase server client met cookie bridge (middleware/edge safe)
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const { data } = await supabase.auth.getUser();
  const loggedIn = !!data?.user;

  // Als niet ingelogd en niet-public → naar /login
  if (!loggedIn && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    // Optioneel: waar je vandaan kwam onthouden
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Als wél ingelogd en je gaat naar /login → doorsturen naar /trips
  if (loggedIn && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/trips";
    return NextResponse.redirect(url);
  }

  return res;
}

// Welke paden middleware moet beschermen
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
