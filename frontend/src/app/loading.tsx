export default function Loading() {
  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="w-8 h-8 border-2 border-eucalypt border-t-transparent rounded-full animate-spin mb-3" />
      <span className="t-micro text-ink-muted">Reading field guide data…</span>
    </div>
  );
}
