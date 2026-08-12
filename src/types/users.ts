import type { Permission } from "@/lib/permissions";

export interface UserRow {
  id: string;
  name: string;
  username: string;
  role: string;
  permissions: Permission[];
  isActive: boolean;
  createdAt: string; // ISO
}
