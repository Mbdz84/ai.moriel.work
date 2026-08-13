import { redirect } from "next/navigation";

// Account moved under settings. Keep this path working.
export default function AccountRedirect() {
  redirect("/settings/account");
}
