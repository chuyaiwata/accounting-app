export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900 p-8">
      <h1 className="text-3xl font-bold mb-2">会計アプリ</h1>
      <p className="text-gray-600">個人事業主のためのシンプルな帳簿</p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
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

      <p className="mt-12 text-sm text-gray-400">
        セットアップ完了 ✓
      </p>
    </main>
  );
}