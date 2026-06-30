import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const clientId = process.env.AUTH_GOOGLE_ID;
  if (!clientId) {
    return new NextResponse("Google OAuth が設定されてません", { status: 500 });
  }

  const url = new URL(req.url);
  const baseUrl = url.origin;
  const redirectUri = baseUrl + "/api/gmail-auth/callback";

  const scope = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/gmail.readonly",
  ].join(" ");

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent select_account");

  return NextResponse.redirect(authUrl.toString());
}
