"use client";

import { deleteLogin } from "@/app/settings/company/actions";

// Super-admin-only control: permanently delete a user's login account.
// Confirms before submitting because it's irreversible and account-wide.
export default function DeleteLoginButton({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  return (
    <form
      action={deleteLogin}
      onSubmit={(e) => {
        if (
          !confirm(
            `Permanently delete the login ${email}?\n\nThis removes the account everywhere (all companies) and cannot be undone.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="user_id" value={userId} />
      <button className="text-rose-700 hover:underline font-medium">
        Delete login
      </button>
    </form>
  );
}
