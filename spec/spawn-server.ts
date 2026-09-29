import { type ChildProcess, spawn } from "node:child_process";
import { type AddressInfo, createServer } from "node:net";

/** Boot the built server (dist/server/entry.mjs) on a free port against a
 *  given database file. Used where a test needs its own server process — for
 *  example, proving a session survives an actual process restart on the same
 *  database — rather than the one shared server spec/global-setup.ts boots
 *  for every other spec test. `extraEnv` is added to the server's environment
 *  (for example a different TZ). */
export async function spawnServer(
  databasePath: string,
  extraEnv: Record<string, string> = {},
): Promise<{ baseUrl: string; stop: () => Promise<void> }> {
  // The port is free when probed but not reserved: another spec file's server
  // can take it before this one binds, and this one then exits. Try a new port.
  for (let attempt = 1; ; attempt++) {
    const started = await startOnFreePort(databasePath, extraEnv);
    if (started) return started;
    if (attempt >= 5) throw new Error("server did not come up, on 5 ports");
  }
}

async function startOnFreePort(
  databasePath: string,
  extraEnv: Record<string, string>,
): Promise<{ baseUrl: string; stop: () => Promise<void> } | null> {
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
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "ignore"],
  });

  // Up means this child said it is listening on this port: a 200 from the port
  // could come from another server, and a child that lost the port exits
  // quietly. Its exit is listened for from the start, too: registered after an
  // early exit, it would never fire and stop() would wait forever (#43).
  const baseUrl = `http://127.0.0.1:${port}`;
  // "error" too: a child that never started (no `node`) emits it and never exits
  const exited = new Promise<void>((resolve) => {
    server.once("exit", () => resolve());
    server.once("error", () => resolve());
  });
  let output = "";
  const up = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 10_000);
    server.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      if (output.includes(`listening on ${baseUrl}`)) {
        clearTimeout(timer);
        resolve(true);
      }
    });
    void exited.then(() => {
      clearTimeout(timer);
      resolve(false);
    });
  });
  // one request as well: the server opens and migrates its database on the
  // first, and some tests read the file directly once this returns
  if (!up || !(await fetch(baseUrl, { signal: AbortSignal.timeout(10_000) }).then((res) => res.ok, () => false))) {
    server.kill();
    await exited;
    return null;
  }

  // stop() resolves once the process has exited, so a test can touch the
  // database file knowing nothing else holds it
  return {
    baseUrl,
    stop: () => {
      server.kill();
      return exited;
    },
  };
}
