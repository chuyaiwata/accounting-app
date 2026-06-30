import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadSettings, saveSettings } from "@/lib/actions/settings";
import type { GmailAccount } from "@/lib/types";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return new NextResponse("認証エラー: " + error, { status: 400 });
  }
  if (!code) {
    return new NextResponse("認証コードがありません", { status: 400 });
  }

  // セッション確認(メインアカウントでログイン中であること)
  const session = await auth();
  if (!session) {
    return NextResponse.redirect(new URL("/api/auth/signin", url.origin));
  }

  try {
    // code を token に交換
    const baseUrl = url.origin;
    const redirectUri = baseUrl + "/api/gmail-auth/callback";

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AUTH_GOOGLE_ID!,
        client_secret: process.env.AUTH_GOOGLE_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Token exchange failed:", err);
      return new NextResponse("token取得失敗: " + tokenRes.status, { status: 500 });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token as string;
    const refreshToken = tokenData.refresh_token as string | undefined;
    const expiresIn = tokenData.expires_in as number;

    // メールアドレス取得
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: "Bearer " + accessToken },
    });
    const userInfo = await userInfoRes.json();
    const email = userInfo.email as string;

    // 設定に追加
    const settings = await loadSettings();
    const existingAccounts = settings.gmailAccounts || [];

    // 既存の同じメールアドレスがあれば更新、なければ追加
    const idx = existingAccounts.findIndex((a) => a.email === email);
    const now = new Date().toISOString();
    const newAccount: GmailAccount = {
      id: idx >= 0 ? existingAccounts[idx].id : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 11),
      email,
      accessToken,
      refreshToken: refreshToken || (idx >= 0 ? existingAccounts[idx].refreshToken : undefined),
      expiresAt: Date.now() + expiresIn * 1000,
      enabled: true,
      createdAt: idx >= 0 ? existingAccounts[idx].createdAt : now,
      updatedAt: now,
    };

    const updatedAccounts = [...existingAccounts];
    if (idx >= 0) {
      updatedAccounts[idx] = newAccount;
    } else {
      updatedAccounts.push(newAccount);
    }

    await saveSettings({
      businessTags: settings.businessTags,
      apportionRules: settings.apportionRules,
      accounts: settings.accounts,
      gmailWhitelist: settings.gmailWhitelist,
      bankAccount: settings.bankAccount,
      companyInfo: settings.companyInfo,
      gmailAccounts: updatedAccounts,
    });

    // 設定タブに戻る
    return NextResponse.redirect(new URL("/settings?gmailAccount=added", url.origin));
  } catch (e) {
    console.error("OAuth callback error:", e);
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return new NextResponse("エラー: " + msg, { status: 500 });
  }
}
