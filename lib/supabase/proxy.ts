import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  let _cookiesToSet: Array<{
    name: string;
    value: string;
    options?: Parameters<typeof response.cookies.set>[2];
  }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          _cookiesToSet = cookiesToSet;
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          console.log("cookiesToSet", cookiesToSet);
          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });

          Object.entries(headers ?? {}).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    },
  );

  // IMPORTANT: getUser() contacts Supabase Auth to validate the token and refresh it if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoggedIn = Boolean(user);
  const isLoginPage = request.nextUrl.pathname === "/login";
  const isApiRoute = request.nextUrl.pathname.startsWith("/api");

  // Only redirect page requests to /login, let API routes handle their own auth responses
  if (!isLoggedIn && !isLoginPage && !isApiRoute) {
    const urlClone = request.nextUrl.clone();
    urlClone.pathname = "/login";

    const redirectResponse = NextResponse.redirect(urlClone);

    _cookiesToSet.forEach(({ name, value, options }) => {
      redirectResponse.cookies.set(name, value, options);
    });

    return redirectResponse;
  }

  if (isLoggedIn && isLoginPage) {
    const urlClone = request.nextUrl.clone();
    urlClone.pathname = "/";

    const redirectResponse = NextResponse.redirect(urlClone);

    _cookiesToSet.forEach(({ name, value, options }) => {
      redirectResponse.cookies.set(name, value, options);
    });

    return redirectResponse;
  }

  return response;
}
