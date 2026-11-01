import { parseResultGroups } from "../results/import.js";
import { packResult } from "../results/worker-wire.js";

self.onmessage = async ({ data }) => {
  if (data.type !== "import") return;
  try {
    const result = await parseResultGroups(data.groups, undefined, {
      onProgress: (progress) => self.postMessage({ type: "progress", progress }),
      onSimulation: (simulation) =>
        self.postMessage({ type: "simulation", payload: packResult(simulation) }),
      retain: false,
    });
    self.postMessage({ type: "done", rejected: result.rejected });
  } catch (error) {
    self.postMessage({ type: "error", message: error.message });
  }
};
