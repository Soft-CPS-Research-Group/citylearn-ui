export function ImportProgress({ progress, onCancel }) {
  return (
    <section className="import-progress" aria-label="Import progress">
      <div role="status" aria-live="polite">
        <strong>Importing folders</strong>
        <span>{progress?.folder || "Preparing selected files"}</span>
        {progress?.file && <span className="import-progress-file">{progress.file}</span>}
        {progress?.totalFiles > 0 && (
          <span>
            {progress.files || 0}/{progress.totalFiles} files started · {progress.completed || 0}{" "}
            folders completed
          </span>
        )}
        {(progress?.mode === "foreground" || progress?.phase === "fallback") && (
          <span>Background reading unavailable; reading files in sequence.</span>
        )}
      </div>
      <button className="button button-secondary" type="button" onClick={onCancel}>
        Cancel import
      </button>
    </section>
  );
}
