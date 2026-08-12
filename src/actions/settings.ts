"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UnauthorizedError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { updateSettings, type AppSettings } from "@/lib/settings";
import { settingsFormSchema } from "@/lib/validators";
import { actionError, actionOk, type ActionResult } from "@/types/actions";

export async function saveSettings(rawInput: unknown): Promise<ActionResult<null>> {
  try {
    await requirePermission("MANAGE_SETTINGS");
    const input = settingsFormSchema.parse(rawInput);

    await updateSettings(input as Partial<AppSettings>);

    // Thresholds feed the dashboard, product list and analytics.
    revalidatePath("/admin");
    revalidatePath("/admin/settings");
    revalidatePath("/admin/products");
    revalidatePath("/admin/analytics");

    return actionOk(null);
  } catch (error) {
    if (error instanceof UnauthorizedError) return actionError(error.message);
    if (error instanceof z.ZodError) {
      return actionError(error.issues[0]?.message ?? "Invalid settings");
    }
    console.error("[saveSettings]", error);
    return actionError("Could not save the settings.");
  }
}
