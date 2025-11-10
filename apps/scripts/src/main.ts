import { Client, Connection } from "@temporalio/client";
import { nanoid } from "nanoid";
import { example } from "@kianax/workers";

async function run() {
  const connection = await Connection.connect({ address: "localhost:7233" });

  const client = new Client({
    connection,
  });

  const handle = await client.workflow.start(example, {
    taskQueue: "default",
    args: [{ name: "Temporal" }],
    workflowId: `workflow-${nanoid()}`,
  });

  console.log(`Started workflow ${handle.workflowId}`);

  console.log(`Workflow result:\n${await handle.result()}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
