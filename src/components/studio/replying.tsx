'use client';
import { useEffect, useState } from 'react';

export default function Replying({
  startedAt,
  critical,
}: {
  startedAt: number;
  critical: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const update = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  return (
    <div className="replying-bubble" role="status" aria-live="polite">
      <div className="replying-heading">
        <span className="replying-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <strong>Interviewer is replying…</strong>
        <time aria-hidden="true">{elapsed}s</time>
      </div>
      <p>
        {critical
          ? 'Opus · reviewing the critical decision'
          : 'Sonnet · preparing your next follow-up'}
      </p>
      <small>
        {elapsed >= 25
          ? 'Still waiting for the cloud model. Your answer is saved; your interview clock is held.'
          : 'Your interview clock is held while you wait.'}
      </small>
    </div>
  );
}
