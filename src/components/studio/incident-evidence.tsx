import { extraDossiers } from '@/lib/studio/incident-library';
export default function IncidentEvidence({ index }: { index: number }) {
  return (
    <div className="incident-evidence">
      <span>OPENING EVIDENCE</span>
      {index === 0 ? (
        <div className="evidence-capacity">
          <div>
            <strong>9,000</strong>
            <small>requests/s arriving</small>
          </div>
          <div className="evidence-bar">
            <i style={{ width: '44.44%' }} />
          </div>
          <small>API capacity: 4,000 requests/s</small>
        </div>
      ) : index === 1 ? (
        <div className="replica-evidence">
          <span>
            <i />
            API 1 <strong>Online</strong>
          </span>
          <span data-failed>
            <i />
            API 2 <strong>Offline</strong>
          </span>
        </div>
      ) : index === 2 ? (
        <div className="freshness-evidence">
          <div>
            <span>Cache TTL</span>
            <i style={{ width: '100%' }} />
            <strong>900 s</strong>
          </div>
          <div>
            <span>Allowed</span>
            <i style={{ width: '6.67%' }} />
            <strong>60 s</strong>
          </div>
        </div>
      ) : index === 3 ? (
        <div className="replica-evidence">
          <span data-failed>
            <i />
            Primary <strong>Unavailable</strong>
          </span>
          <span>
            <strong>Writes blocked</strong>
          </span>
        </div>
      ) : index === 4 ? (
        <div className="budget-evidence">
          <strong>$600</strong>
          <span>
            monthly ceiling
            <br />
            protect checkout while reducing spend
          </span>
        </div>
      ) : index === 5 ? (
        <div className="queue-evidence">
          <span>
            <strong>24,000</strong>waiting jobs
          </span>
          <span>
            <strong>30/s</strong>provider quota
          </span>
          <span>
            <strong>10%</strong>invalid payloads
          </span>
        </div>
      ) : (
        <div className="dossier-evidence">
          {extraDossiers[index - 6]?.evidence
            .slice(0, 2)
            .map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
