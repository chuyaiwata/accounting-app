import type { GmailAccount } from "@/lib/types";

/**
 * GmailAccount の accessToken が期限切れなら refreshToken でリフレッシュ
 * 戻り値: 最新の(または既存の)accessToken と更新後の GmailAccount
 */
export async function ensureValidAccessToken(
  account: GmailAccount
): Promise<{ accessToken: string; updatedAccount: GmailAccount }> {
  // 有効期限が5分以上残っていれば既存のを使う
  const now = Date.now();
  const buffer = 5 * 60 * 1000;
  if (account.expiresAt && account.expiresAt > now + buffer) {
    return { accessToken: account.accessToken, updatedAccount: account };
  }

  // リフレッシュトークンがなければ既存のを使う(エラーになるかも)
  if (!account.refreshToken) {
    return { accessToken: account.accessToken, updatedAccount: account };
  }

  // リフレッシュ実行
  const url = "https://oauth2.googleapis.com/token";
  const params = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID!,
    client_secret: process.env.AUTH_GOOGLE_SECRET!,
    refresh_token: account.refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    console.error("Token refresh failed for " + account.email);
    return { accessToken: account.accessToken, updatedAccount: account };
  }

  const data = await res.json();
  const newAccessToken = data.access_token as string;
  const expiresIn = data.expires_in as number;
  const newRefreshToken = (data.refresh_token as string | undefined) || account.refreshToken;

  const updated: GmailAccount = {
    ...account,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    updatedAt: new Date().toISOString(),
  };

  return { accessToken: newAccessToken, updatedAccount: updated };
}
