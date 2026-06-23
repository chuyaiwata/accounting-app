import { auth, signIn, signOut } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="min-h-screen bg-white text-gray-900 p-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">会計アプリ</h1>
          <p className="text-gray-600">個人事業主のためのシンプルな帳簿</p>
        </div>

        {session?.user ? (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">{session.user.name}</p>
              <p className="text-xs text-gray-500">{session.user.email}</p>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50"
              >
                ログアウト
              </button>
            </form>
          </div>
        ) : (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700"
            >
              Googleでログイン
            </button>
          </form>
        )}
      </div>

      {session?.user ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">今月の売上</p>
              <p className="text-2xl font-semibold mt-1">¥0</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">今月の経費</p>
              <p className="text-2xl font-semibold mt-1">¥0</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">売掛金残高</p>
              <p className="text-2xl font-semibold mt-1">¥0</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">年間税額(見込)</p>
              <p className="text-2xl font-semibold mt-1">¥0</p>
            </div>
          </div>

          <div className="border rounded-lg p-6 bg-green-50 border-green-200">
            <p className="text-sm font-medium text-green-800">
              ✓ ログイン成功
            </p>
            <p className="text-xs text-green-700 mt-1">
              Google Drive と Gmail へのアクセス権限を取得しました。
            </p>
          </div>
        </>
      ) : (
        <div className="border rounded-lg p-12 text-center bg-gray-50">
          <p className="text-gray-700 mb-4">
            Googleアカウントでログインして始めましょう
          </p>
          <p className="text-sm text-gray-500">
            データはあなたのGoogle Driveに保存されます
          </p>
        </div>
      )}
    </main>
  );
}