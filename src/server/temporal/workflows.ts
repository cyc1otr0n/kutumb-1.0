import { proxyActivities, sleep } from "@temporalio/workflow";
import type * as activities from "./activities";

const { deliverReminderActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 minute",
  retry: {
    initialInterval: "5 seconds",
    maximumInterval: "1 minute",
    maximumAttempts: 5,
  },
});

export interface ReminderWorkflowInput {
  reminderId: string;
  familyId: string;
  fireAtIso: string;
}

export async function reminderWorkflow(input: ReminderWorkflowInput): Promise<void> {
  const targetTime = new Date(input.fireAtIso).getTime();
  const now = Date.now();
  const delayMs = targetTime - now;

  if (delayMs > 0) {
    // Durable Temporal sleep - survives worker crashes, machine reboots, and days of waiting!
    await sleep(delayMs);
  }

  await deliverReminderActivity({
    reminderId: input.reminderId,
    familyId: input.familyId,
  });
}
