export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-bold">Voice-AI</h1>
      <p className="text-neutral-500">
        Telephony CRM for AI receptionists. Foundation is live.
      </p>
      <div className="flex gap-3 text-sm">
        <a className="underline" href="/login">Login</a>
        <a className="underline" href="/dashboard">Dashboard</a>
        <a className="underline" href="/settings">Settings</a>
      </div>
    </main>
  );
}
