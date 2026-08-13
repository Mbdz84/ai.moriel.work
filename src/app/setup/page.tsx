import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import SetupForm from "@/components/SetupForm";

export default async function SetupPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Already has a company? Go to the dashboard.
  const { data: membership } = await supabase
    .from("memberships")
    .select("business_id")
    .maybeSingle();
  if (membership?.business_id) redirect("/dashboard");

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Finish setup</h1>
          <p className="text-sm text-neutral-500">
            Create your company to start receiving calls.
          </p>
        </div>
        <SetupForm />
      </div>
    </main>
  );
}
