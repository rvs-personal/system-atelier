'use client';
import { ArrowRight, Check, Clock, Network, MessageSquare } from 'lucide-react';
import { Choice } from './shared';
import './interview-entry.css';
const levels = [
  {
    name: 'SDE 2',
    scope: 'APIs, demand estimates, and one failure.',
    expectation:
      'Build a coherent system and explain how a request moves through it.',
  },
  {
    name: 'Senior engineer',
    scope: 'Concurrency, bottlenecks, and recovery.',
    expectation:
      'Quantify the limits of your design and recover safely under load.',
  },
  {
    name: 'Staff / Principal',
    scope: 'Boundaries, migrations, and cross-team decisions.',
    expectation: 'Defend system boundaries and a migration plan across teams.',
  },
  {
    name: 'Architect / CTO',
    scope: 'Business priorities, cost, and delivery risk.',
    expectation:
      'Balance customer commitments, staffing, and reliability under a budget.',
  },
];
export default function InterviewEntry({
  role,
  onRole,
  mode,
  onMode,
  ready,
  available,
  onStart,
}: {
  role: string;
  onRole: (value: string) => void;
  mode: string;
  onMode: (value: string) => void;
  ready: boolean;
  available: boolean | null;
  onStart: () => void;
}) {
  const selected = levels.find((level) => level.name === role) ?? levels[0];
  return (
    <div className="interview-entry-grid">
      <section className="interview-levels">
        <h2>Choose your level</h2>
        <fieldset className="interview-level-group">
          <legend className="sr-only">Interview level</legend>
          {levels.map((level) => (
            <label
              className="interview-level"
              data-selected={role === level.name}
              key={level.name}
            >
              <input
                type="radio"
                name="interview-level"
                value={level.name}
                checked={role === level.name}
                onChange={() => onRole(level.name)}
              />
              <span>
                <strong>{level.name}</strong>
                <span>{level.scope}</span>
              </span>
              <span className="interview-level-mark" aria-hidden="true">
                {role === level.name && <Check size={14} />}
              </span>
            </label>
          ))}
        </fieldset>
        <p className="interview-entry-guidance">
          The interviewer assigns one problem. Follow-up constraints change as
          you explain and refine your design.
        </p>
      </section>
      <section className="interview-session-card">
        <span className="interview-session-label">YOUR SESSION</span>
        <h2>{role}</h2>
        <p>{selected.expectation}</p>
        <fieldset disabled={!ready}>
          <Choice
            label="Session mode"
            value={mode}
            options={[
              { value: 'mock', label: 'Mock interview' },
              { value: 'guided', label: 'Guided practice' },
            ]}
            onChange={onMode}
          />
          <p className="interview-mode-detail">
            <strong>45–60 minutes.</strong>{' '}
            {mode === 'mock'
              ? 'Timed conversation. Coaching comes in your debrief.'
              : 'Pause when you need to. Ask for coaching during the session.'}
          </p>
          <button className="primary wide" onClick={onStart}>
            Start interview
            <ArrowRight size={17} />
          </button>
        </fieldset>
        <p
          className="interview-connection"
          data-state={
            available === null ? 'pending' : available ? 'ready' : 'offline'
          }
          role="status"
        >
          <span />
          {available === null
            ? 'Connecting to interviewer…'
            : available
              ? 'Interviewer connected'
              : 'Live replies require model access for your account.'}
        </p>
        <div className="interview-session-details">
          <span>
            <Network size={16} />
            Shared canvas
          </span>
          <span>
            <MessageSquare size={16} />
            Adaptive follow-ups
          </span>
        </div>
        <p className="interview-leave-note">
          {mode === 'mock'
            ? 'Leaving the room pauses and saves your interview.'
            : 'Pause the session before stepping away.'}
        </p>
      </section>
    </div>
  );
}
