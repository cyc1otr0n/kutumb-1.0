import { Worker, NativeConnection } from "@temporalio/worker";
import * as activities from "./activities";
import { env } from "../env";

export async function runWorker() {
  const address = env.temporalAddress();
  const namespace = env.temporalNamespace();
  const apiKey = env.temporalApiKey();
  const taskQueue = env.temporalTaskQueue();

  console.log(`Starting Kutumb Temporal Worker connecting to ${address}, namespace: ${namespace}...`);

  const connection = await NativeConnection.connect({
    address,
    apiKey,
  });

  const worker = await Worker.create({
    connection,
    namespace,
    taskQueue,
    workflowsPath: require.resolve("./workflows"),
    activities,
  });

  console.log(`Kutumb Temporal Worker started on queue "${taskQueue}". Ready for reminders.`);
  await worker.run();
}

if (require.main === module) {
  runWorker().catch((err) => {
    console.error("Temporal worker fatal error:", err);
    process.exit(1);
  });
}
