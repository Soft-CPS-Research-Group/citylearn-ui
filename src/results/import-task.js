import { groupResultFiles, parseResultGroups } from "./import.js";
import { unpackResult } from "./worker-wire.js";

export function createImportTask(
  files,
  {
    onSimulation = () => {},
    onProgress = () => {},
    workerFactory = () =>
      new Worker(new URL("../workers/import.worker.js", import.meta.url), { type: "module" }),
  } = {},
) {
  const groups = groupResultFiles(files),
    controller = new AbortController();
  const completed = new Set();
  let worker,
    settled = false,
    rejectTask;
  const stopWorker = () => {
    if (!worker) return;
    worker.onmessage = null;
    worker.onerror = null;
    worker.onmessageerror = null;
    worker.terminate();
    worker = null;
  };
  const promise = new Promise((resolve, reject) => {
    rejectTask = reject;
    if (!groups.length) {
      settled = true;
      reject(new Error("No CSV or Parquet result files were found in the selected folder."));
      return;
    }
    const deliver = (simulation) => {
      if (settled || completed.has(simulation.path)) return;
      completed.add(simulation.path);
      onSimulation(simulation);
    };
    const finish = (result) => {
      if (settled) return;
      settled = true;
      stopWorker();
      resolve(result);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      stopWorker();
      reject(error);
    };
    let fallbackStarted = false;
    const fallback = async () => {
      if (settled || fallbackStarted) return;
      fallbackStarted = true;
      stopWorker();
      onProgress({ phase: "fallback", folders: groups.length, completed: completed.size });
      try {
        const result = await parseResultGroups(
          groups.filter((g) => !completed.has(g.path)),
          undefined,
          {
            signal: controller.signal,
            yield: true,
            onSimulation: deliver,
            onProgress: (progress) => {
              if (!settled) onProgress({ ...progress, mode: "foreground" });
            },
            retain: false,
          },
        );
        finish(result);
      } catch (error) {
        fail(error);
      }
    };
    try {
      worker = workerFactory();
      worker.onmessage = ({ data }) => {
        if (settled) return;
        try {
          if (data.type === "progress") onProgress(data.progress);
          else if (data.type === "simulation") deliver(unpackResult(data.payload));
          else if (data.type === "done") finish({ rejected: data.rejected });
          else if (data.type === "error") fail(new Error(data.message));
        } catch (error) {
          fail(error);
        }
      };
      worker.onerror = (event) => {
        event.preventDefault?.();
        fallback();
      };
      worker.onmessageerror = () =>
        fail(
          new Error(
            "The background import could not be decoded. Existing imports remain available.",
          ),
        );
      worker.postMessage({ type: "import", groups });
    } catch {
      fallback();
    }
  });
  return {
    promise,
    cancel() {
      if (settled) return;
      settled = true;
      controller.abort();
      stopWorker();
      rejectTask(
        new DOMException("Import cancelled. Completed folders remain available.", "AbortError"),
      );
    },
  };
}
