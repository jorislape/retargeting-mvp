export default function LaunchPage() {
  return (
    <main className="min-h-screen bg-black text-white p-8">
      <h1 className="text-3xl font-bold">Launch Retargeting</h1>

      <div className="mt-6 space-y-4">

        <div className="border border-white/10 p-4 rounded-lg">
          <p className="text-gray-400">Audience</p>
          <p>Website Visitors (30 days)</p>
        </div>

        <div className="border border-white/10 p-4 rounded-lg">
          <p className="text-gray-400">Budget</p>
          <p>$10/day</p>
        </div>

        <button className="bg-blue-600 px-6 py-3 rounded-lg">
          Launch Campaign
        </button>

      </div>
    </main>
  );
}