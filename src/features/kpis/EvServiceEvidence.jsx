function EvServiceEvidence({ signal }) {
  if (signal?.kind !== "ev-service") return null;
  return (
    <ul className="ev-service-evidence" aria-label="EV service coverage">
      {signal.evidence.map((text, index) => (
        <li key={index}>{text}</li>
      ))}
    </ul>
  );
}

export { EvServiceEvidence };
