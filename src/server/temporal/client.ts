import { Connection, Client } from "@temporalio/client";
import { env } from "../env";
import { AppError, USER_MESSAGES } from "../errors";
import { captureError } from "../observability";

let cachedClient: Client | null = null;
let connectingPromise: Promise<Client> | null = null;

export async function getTemporalClient(): Promise<Client> {
  if (cachedClient) return cachedClient;

  if (!connectingPromise) {
    connectingPromise = (async () => {
      try {
        const address = env.temporalAddress();
        const namespace = env.temporalNamespace();
        const apiKey = env.temporalApiKey();

        const connection = await Connection.connect({
          address,
          apiKey,
        });

        cachedClient = new Client({
          connection,
          namespace,
        });

        return cachedClient;
      } catch (err) {
        connectingPromise = null;
        captureError(err, { area: "temporal_connect" });
        throw new AppError("reminders_unavailable", USER_MESSAGES.reminders, { cause: err });
      }
    })();
  }

  return connectingPromise;
}
