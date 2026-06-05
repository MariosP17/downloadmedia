export default function Loading() {
  return (
    <main className="p-8 bg-zinc-950 min-h-screen text-white flex items-center justify-center">
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <span className="loader"></span>
          <span className="ml-4 text-lg">Loading...</span>
        </div>
    </main>
  );
}
