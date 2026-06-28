// =============================================================================
// Google Drive クライアント
// =============================================================================
// 個別ユーザーのGoogle Driveに、アプリ専用フォルダを作成し、
// JSONLファイルとしてデータを保存・読込する
// =============================================================================

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";
const APP_FOLDER_NAME = "accounting-app-data";

/**
 * Google Drive API へのリクエストを行うヘルパー
 */
async function driveRequest(
  accessToken: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${DRIVE_API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });
  return response;
}

/**
 * アプリ専用フォルダを取得(なければ作成)
 */
export async function ensureAppFolder(accessToken: string): Promise<string> {
  // 既存フォルダを検索
  const searchUrl =
    `/files?` +
    new URLSearchParams({
      q: `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name)",
      spaces: "drive",
    });

  const searchRes = await driveRequest(accessToken, searchUrl);
  if (!searchRes.ok) {
    throw new Error(`Drive search failed: ${searchRes.status}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // 無ければ新規作成
  const createRes = await driveRequest(accessToken, "/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: APP_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Drive folder create failed: ${createRes.status}`);
  }

  const createData = await createRes.json();
  return createData.id;
}

/**
 * フォルダ内のファイルを名前で検索(なければnull)
 */
export async function findFileByName(
  accessToken: string,
  folderId: string,
  fileName: string
): Promise<{ id: string; name: string } | null> {
  const searchUrl =
    `/files?` +
    new URLSearchParams({
      q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
      fields: "files(id, name)",
      spaces: "drive",
    });

  const res = await driveRequest(accessToken, searchUrl);
  if (!res.ok) {
    throw new Error(`Drive search failed: ${res.status}`);
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return { id: data.files[0].id, name: data.files[0].name };
  }
  return null;
}

/**
 * ファイルの中身をテキストとして読み込む
 */
export async function downloadFileContent(
  accessToken: string,
  fileId: string
): Promise<string> {
  const res = await driveRequest(accessToken, `/files/${fileId}?alt=media`);
  if (!res.ok) {
    throw new Error(`Drive download failed: ${res.status}`);
  }
  return await res.text();
}

/**
 * ファイルを作成 or 上書き保存(テキストの場合)
 */
export async function uploadTextFile(
  accessToken: string,
  folderId: string,
  fileName: string,
  content: string
): Promise<string> {
  // 既存ファイルを検索
  const existing = await findFileByName(accessToken, folderId, fileName);

  if (existing) {
    // 上書き(PATCH)
    const url = `${DRIVE_UPLOAD_BASE}/files/${existing.id}?uploadType=media`;
    const res = await driveRequest(accessToken, url, {
      method: "PATCH",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: content,
    });
    if (!res.ok) {
      throw new Error(`Drive update failed: ${res.status}`);
    }
    const data = await res.json();
    return data.id;
  }

  // 新規作成(multipart upload)
  const boundary = "-------accounting-app-boundary";
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
  });

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    metadata +
    `\r\n--${boundary}\r\n` +
    `Content-Type: text/plain; charset=utf-8\r\n\r\n` +
    content +
    `\r\n--${boundary}--`;

  const url = `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`;
  const res = await driveRequest(accessToken, url, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });

  if (!res.ok) {
    throw new Error(`Drive upload failed: ${res.status}`);
  }
  const data = await res.json();
  return data.id;
}

/**
 * JSONLファイルにオブジェクトを追記
 * ファイルが無ければ新規作成
 */
export async function appendJsonl<T>(
  accessToken: string,
  folderId: string,
  fileName: string,
  obj: T
): Promise<void> {
  const existing = await findFileByName(accessToken, folderId, fileName);
  let existingContent = "";

  if (existing) {
    existingContent = await downloadFileContent(accessToken, existing.id);
    if (existingContent && !existingContent.endsWith("\n")) {
      existingContent += "\n";
    }
  }

  const newContent = existingContent + JSON.stringify(obj) + "\n";
  await uploadTextFile(accessToken, folderId, fileName, newContent);
}

/**
 * JSONLファイルを全て読み込んで配列として返す
 */
export async function readJsonl<T>(
  accessToken: string,
  folderId: string,
  fileName: string
): Promise<T[]> {
  const existing = await findFileByName(accessToken, folderId, fileName);
  if (!existing) return [];

  const content = await downloadFileContent(accessToken, existing.id);
  if (!content.trim()) return [];

  return content
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}


/**
 * サブフォルダを取得(なければ作成)
 */
export async function ensureSubFolder(
  accessToken: string,
  parentFolderId: string,
  folderName: string
): Promise<string> {
  const searchUrl =
    `/files?` +
    new URLSearchParams({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
      fields: "files(id, name)",
      spaces: "drive",
    });

  const searchRes = await driveRequest(accessToken, searchUrl);
  if (!searchRes.ok) {
    throw new Error(`Drive subfolder search failed: ${searchRes.status}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createRes = await driveRequest(accessToken, "/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Drive subfolder create failed: ${createRes.status}`);
  }

  const createData = await createRes.json();
  return createData.id;
}

/**
 * バイナリファイル(画像等)を新規作成
 * 戻り値: Google Drive ファイルID
 */
export async function uploadBinaryFile(
  accessToken: string,
  folderId: string,
  fileName: string,
  data: ArrayBuffer | Uint8Array,
  mimeType: string
): Promise<string> {
  const boundary = "-------accounting-app-binary-boundary";
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
  });

  // multipart body をバイナリ対応で構築
  const encoder = new TextEncoder();
  const metadataPart = encoder.encode(
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    metadata +
    `\r\n--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`
  );
  const bodyEnd = encoder.encode(`\r\n--${boundary}--`);

  const dataBytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const fullBody = new Uint8Array(metadataPart.length + dataBytes.length + bodyEnd.length);
  fullBody.set(metadataPart, 0);
  fullBody.set(dataBytes, metadataPart.length);
  fullBody.set(bodyEnd, metadataPart.length + dataBytes.length);

  const url = `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`;
  const res = await driveRequest(accessToken, url, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body: fullBody as BodyInit,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drive binary upload failed: ${res.status} ${errText}`);
  }
  const json = await res.json();
  return json.id;
}

/**
 * ファイル削除
 */
export async function deleteFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  const res = await driveRequest(accessToken, `/files/${fileId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Drive delete failed: ${res.status}`);
  }
}
