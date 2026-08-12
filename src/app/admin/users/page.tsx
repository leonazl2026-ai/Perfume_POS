import { redirect } from "next/navigation";
import { UserManager } from "@/components/admin/UserManager";
import { listUsers } from "@/actions/users";
import { getCurrentUser } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  // The layout guard already covers this; repeated here so the page is safe
  // on its own if it is ever rendered outside that layout.
  if (!hasPermission(user, "MANAGE_USERS")) redirect("/admin");

  const users = await listUsers();

  return <UserManager users={users} currentUserId={user?.id ?? ""} />;
}
