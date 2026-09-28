import { type ChildProcess, spawn } from "node:child_process";
import { type AddressInfo, createServer } from "node:net";

/** Boot the built server (dist/server/entry.mjs) on a free port against a
 *  given database file. Used where a test needs its own server process — for
 *  example, proving a session survives an actual process restart on the same
 *  database — rather than the one shared server spec/global-setup.ts boots
 *  for every other spec test. */
export async function spawnServer(databasePath: string): Promise<{ baseUrl: string; stop: () => void }> {
  const port = await new Promise<number>((resolve) => {
    const probe = createServer();
    probe.listen(0, () => {
      const address = probe.address() as AddressInfo;
      probe.close(() => resolve(address.port));
    });
  });

  const server: ChildProcess = spawn("node", ["./dist/server/entry.mjs"], {
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      DATABASE_PATH: databasePath,
    },
    stdio: "ignore",
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(baseUrl);
      if (res.ok) break;
    } catch {
      // not up yet
    }
    if (attempt >= 50) {
      server.kill();
      throw new Error(`server did not come up at ${baseUrl}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return { baseUrl, stop: () => server.kill() };
}
