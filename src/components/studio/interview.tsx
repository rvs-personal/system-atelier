'use client';
import { useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  ArrowRight,
  Send,
  Clock,
  Pause,
  Play,
  Flag,
  Check,
  BookOpen,
  FileText,
  Download,
  Lightbulb,
  Network,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useCloud, download } from '@/lib/studio/storage';
import {
  scenarios,
  roles,
  phases,
  newSession,
  respond,
  presentDesign,
  coaching,
  debrief,
  nextPrompt,
  assignedScenario,
  auditCriteria,
  type Session,
  type Message,
} from '@/lib/studio/interview';
import { PageTitle, CloudStatus, Choice } from './shared';
import Editor from './editor';
import Diagram from './diagram';
import InterviewTranscript from './interview-transcript';
import InterviewEntry from './interview-entry';
import './interview-room.css';
import {
  minimumInterviewBrief,
  interviewTargetRows,
} from '@/lib/studio/interview-brief';
import { lessons } from '@/lib/studio/curriculum';
import { useAccount } from '@/lib/auth/context';
import { validReview, shouldReview } from '@/lib/studio/interview-review';
const message = (role: Message['role'], text: string): Message => ({
  id: crypto.randomUUID(),
  role,
  text,
  at: Date.now(),
});
function emphasizeTargets(text: string) {
  return text
    .split(/(\b\d[\d,.]*(?:\s*(?:million|billion|ms|seconds|minutes|%|×))?)/g)
    .map((part, i) =>
      /^\d/.test(part) ? <strong key={i}>{part}</strong> : part,
    );
}
export default function Interview({ onLearn }: { onLearn: () => void }) {
  const auth = useAccount();
  const [retryTurn, setRetryTurn] = useState<{
    session: Session;
    text: string;
  } | null>(null);
  const cloud = useCloud('interview', {
    active: null as Session | null,
    history: [] as Session[],
  });
  const [scenarioId, setScenarioId] = useState('shortener'),
    [role, setRole] = useState('SDE 2'),
    [mode, setMode] = useState('mock'),
    [draft, setDraft] = useState(''),
    [now, setNow] = useState(0),
    [thinking, setThinking] = useState(false),
    [replyStarted, setReplyStarted] = useState(0),
    [criticalReply, setCriticalReply] = useState(false),
    [hint, setHint] = useState(false),
    [finishOpen, setFinishOpen] = useState(false),
    [past, setPast] = useState<Session | null>(null),
    [workspaceTab, setWorkspaceTab] = useState('brief');
  const [reviewAvailable, setReviewAvailable] = useState<boolean | null>(null),
    [reviewStatus, setReviewStatus] = useState('');
  useEffect(() => {
    fetch('/api/interview')
      .then((r) => r.json())
      .then((d) =>
        setReviewAvailable(
          !!d &&
            typeof d === 'object' &&
            'available' in d &&
            d.available === true,
        ),
      )
      .catch(() => setReviewAvailable(false));
  }, []);
  const s = cloud.data.active,
    scenario = scenarios.find((x) => x.id === (s?.scenarioId ?? scenarioId))!,
    pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      if (pending.current) clearTimeout(pending.current);
    };
  }, []);

  const remaining = s
    ? Math.max(
        0,
        Math.ceil(
          (s.deadline -
            (s.pausedAt ?? (thinking ? replyStarted : now || Date.now()))) /
            1000,
        ),
      )
    : 0;
  function finish(reason = 'You ended the session.') {
    if (!s || s.status !== 'active') return;
    const finished: Session = {
      ...s,
      status: 'finished',
      finishedAt: Date.now(),
      messages: [...s.messages, message('event', reason)],
    };
    cloud.setData((d) => ({
      ...d,
      active: finished,
      history: [finished, ...d.history].slice(0, 20),
    }));
    setFinishOpen(false);
    location.hash = 'interview/history/' + finished.id;
  }
  useEffect(() => {
    if (
      s?.status === 'active' &&
      now &&
      remaining === 0 &&
      !s.pausedAt &&
      !thinking
    ) {
      finish(
        'Time is up. The interview is complete; your design and transcript are preserved.',
      );
    }
  }, [remaining, now, s?.status]);
  async function send(override?: { session: Session; text: string }) {
    const base = override?.session ?? s,
      text = override?.text ?? draft.trim();
    if (!base || !text || thinking || base.status !== 'active') return;
    const waitStarted = Date.now();
    setReplyStarted(waitStarted);
    setCriticalReply(shouldReview(base, text));
    setDraft('');
    setThinking(true);
    setReviewStatus('The interviewer is reading your reasoning and design…');
    if (!override)
      cloud.setData((d) => ({
        ...d,
        active: d.active
          ? {
              ...d.active,
              messages: [...d.active.messages, message('candidate', text)],
            }
          : null,
      }));
    try {
      const response = await fetch('/api/interview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Atelier-Account': auth?.user.id ?? '',
        },
        body: JSON.stringify({ session: base, text }),
        signal: AbortSignal.timeout(185000),
      });
      const value = await response.json();
      if (!response.ok || !validReview(value))
        throw new Error(
          (value as { error?: string })?.error ?? 'No model reply received.',
        );
      const phase = value.phase ?? base.phase;
      const entry = {
        messageId: crypto.randomUUID(),
        phase: base.phase,
        passed: auditCriteria[base.phase].filter((_, i) =>
          value.passed.includes(i),
        ),
        missing: auditCriteria[base.phase].filter(
          (_, i) => !value.passed.includes(i),
        ),
        at: Date.now(),
        extension: base.extensions ?? 0,
        model: value.model,
        rationale: value.rationale,
      };
      cloud.setData((d) => ({
        ...d,
        active:
          d.active?.id === base.id && d.active.status === 'active'
            ? {
                ...d.active,
                phase,
                audit: [...(d.active.audit ?? []), entry],
                messages: [
                  ...d.active.messages,
                  message('interviewer', value.followUp),
                ],
              }
            : d.active,
      }));
      setRetryTurn(null);
      setReviewStatus('');
    } catch (error) {
      setRetryTurn({ session: base, text });
      setReviewStatus(
        error instanceof Error
          ? error.message
          : 'Inference unavailable. Your answer is saved.',
      );
    } finally {
      const waited = Date.now() - waitStarted;
      cloud.setData((d) => ({
        ...d,
        active:
          d.active?.id === base.id && d.active.status === 'active'
            ? { ...d.active, deadline: d.active.deadline + waited }
            : d.active,
      }));
      setThinking(false);
    }
  }
  function updateSession(p: Partial<Session>) {
    cloud.setData((d) => ({
      ...d,
      active: d.active ? { ...d.active, ...p } : null,
    }));
  }
  function start() {
    if (!cloud.ready || s?.status === 'active') return;
    setRoomRoute('interview/session');
    location.hash = 'interview/session';
    setPast(null);
    setHint(false);
    setDraft('');
    cloud.setData((d) => ({
      ...d,
      active: newSession(
        assignedScenario(role, d.history),
        role,
        mode as 'guided' | 'mock',
      ),
    }));
  }
  const [roomRoute, setRoomRoute] = useState('interview');
  useEffect(() => {
    const sync = () => setRoomRoute(location.hash.slice(1));
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  useEffect(() => {
    if (
      roomRoute !== 'interview/session' &&
      s?.status === 'active' &&
      !s.pausedAt &&
      !thinking
    )
      updateSession({ pausedAt: Date.now() });
  }, [roomRoute, s?.id, s?.pausedAt, thinking]);
  function resume() {
    if (!s) return;
    setRoomRoute('interview/session');
    if (s.pausedAt)
      updateSession({
        pausedAt: undefined,
        deadline: s.deadline + Date.now() - s.pausedAt,
      });
    location.hash = 'interview/session';
  }
  const pastId = roomRoute.startsWith('interview/history/')
    ? roomRoute.split('/')[2]
    : null;
  const finished =
    (pastId ? cloud.data.history.find((item) => item.id === pastId) : null) ??
    (roomRoute === 'interview/session' && s?.status === 'finished' ? s : null);
  if (finished)
    return (
      <>
        <nav className="session-nav">
          <a className="text-button" href="#interview">
            ← Interview room
          </a>
          <a className="text-button" href="#studio">
            Home
          </a>
        </nav>
        <PageTitle
          kicker="INTERVIEW DEBRIEF"
          title="The decisions are the story."
          description={
            scenarios.find((x) => x.id === finished.scenarioId)?.name +
            ' · ' +
            finished.role
          }
        />
        <CloudStatus {...cloud} />
        <div className="debrief-summary">
          <div>
            <strong>
              {finished.messages.filter((m) => m.role === 'candidate').length}
            </strong>
            <span>candidate contributions</span>
          </div>
          <div>
            <strong>{finished.design.nodes.length}</strong>
            <span>components modeled</span>
          </div>
          <div>
            <strong>
              {Math.max(
                1,
                Math.round(
                  ((finished.finishedAt ?? Date.now()) - finished.startedAt) /
                    60000,
                ),
              )}{' '}
              min
            </strong>
            <span>session elapsed</span>
          </div>
          <div>
            <strong>{finished.disrupted ? 'Introduced' : 'Not reached'}</strong>
            <span>changing constraint</span>
          </div>
        </div>
        <div className="feedback amber">
          <strong>Evidence-led self-review, not a hiring verdict</strong>
          <p>
            This simulator records structured evidence checks and, when
            connected, selective model reviews for critical reasoning.
            “Discussion found” means relevant text was detected, not that the
            reasoning is correct. Review the quoted evidence, challenge your
            assumptions, and compare with the rubric below. Any model review is
            labeled in the audit; both review paths can be wrong.
          </p>
        </div>
        <div className="rubric-grid">
          {debrief(finished).map((e) => (
            <article className="rubric-card" key={e.name}>
              <div>
                <h3>{e.name}</h3>
                <span className={e.observed ? 'tag green' : 'tag'}>
                  {e.observed ? 'Discussion found' : 'Revisit'}
                </span>
              </div>
              <blockquote>{e.evidence}</blockquote>
              <p>{e.next}</p>
            </article>
          ))}
        </div>
        <div className="panel">
          <h2>What would stronger reasoning include?</h2>
          <p>
            {finished.role === 'SDE 2'
              ? 'A coherent end-to-end design, defensible storage choices, explicit APIs, and correct handling of a concrete race or retry.'
              : finished.role === 'Senior engineer'
                ? 'Quantified bottlenecks, precise delivery and consistency semantics, operational protections, and justified alternatives.'
                : finished.role === 'Staff / Principal'
                  ? 'Cross-team boundaries, compatibility during migration, measurable reliability, ownership, and evidence for each added layer.'
                  : 'A phased technical strategy tied to business outcomes, unit economics, risk acceptance, team capacity, and reversible commitments.'}
          </p>
          <h3 className="mt-5">Recommended practice</h3>
          <p>
            {scenarios
              .find((x) => x.id === finished.scenarioId)
              ?.lesson.map(
                (id) => lessons.find((l) => l.id === id)?.title ?? id,
              )
              .join(' · ')}
          </p>
          <div className="inline-form">
            <button className="primary" onClick={onLearn}>
              <BookOpen size={16} />
              Return to the learning path
            </button>
            <button
              className="secondary"
              onClick={() => {
                setPast(null);
                location.hash = 'interview';
              }}
            >
              Set up another session
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
        <details className="audit-panel">
          <summary>
            Inspect the ongoing audit · {(finished.audit ?? []).length} entries
          </summary>
          {(finished.audit ?? []).map((a, i) => (
            <article key={i}>
              <strong>
                {phases[a.phase]} · constraint round {a.extension + 1}
              </strong>
              <p className="small">
                {a.model
                  ? 'Critical review · ' + a.model
                  : 'Structured evidence check'}
              </p>
              {a.rationale && <p>{a.rationale}</p>}
              <p>
                Observed: {a.passed.join('; ') || 'No rubric evidence detected'}
              </p>
              <p>
                Follow-up needed:{' '}
                {a.missing.join('; ') || 'All checks have evidence'}
              </p>
              <blockquote>
                {finished.messages.find((m) => m.id === a.messageId)?.text}
              </blockquote>
            </article>
          ))}
        </details>
        <details className="transcript-details">
          <summary>Read the full transcript</summary>
          {finished.messages.map((m) => (
            <div className={'message ' + m.role} key={m.id}>
              <span>{m.role}</span>
              <p>{m.text}</p>
            </div>
          ))}
        </details>
        <details className="transcript-details">
          <summary>Inspect the final design and contract</summary>
          <Diagram design={finished.design} compact />
          <pre className="contract-preview">
            {finished.contract || 'No contract recorded.'}
          </pre>
        </details>
      </>
    );
  if (!s || roomRoute !== 'interview/session')
    return (
      <>
        <div className="interview-entry">
          <PageTitle
            kicker="INTERVIEW ROOM"
            title="Practice a design interview"
            description="Explain your decisions. Adapt when the requirements change."
          />
          <CloudStatus {...cloud} />
          {s?.status === 'active' && (
            <section className="session-resume-card">
              <div>
                <span className="eyebrow">SAVED INTERVIEW</span>
                <h2>{scenario.name}</h2>
                <p>
                  {s.role} ·{' '}
                  {s.mode === 'mock' ? 'Mock interview' : 'Guided practice'} ·
                  Your transcript and design are preserved.
                </p>
              </div>
              <button className="primary" disabled={thinking} onClick={resume}>
                Resume interview
                <Play size={16} />
              </button>
            </section>
          )}
          {s?.status !== 'active' && (
            <InterviewEntry
              role={role}
              onRole={setRole}
              mode={mode}
              onMode={setMode}
              ready={cloud.ready}
              available={reviewAvailable}
              onStart={start}
            />
          )}
        </div>
        {cloud.data.history.length > 0 && (
          <div className="panel session-history">
            <div className="section-title">
              <h2>Past sessions</h2>
            </div>
            <p className="small">
              Your most recent 20 sessions are retained. Use the workspace menu
              to export histories you want to keep longer.
            </p>
            {cloud.data.history.map((h) => (
              <button
                key={h.id}
                className="history-row"
                onClick={() => {
                  setPast(h);
                  location.hash = 'interview/history/' + h.id;
                }}
              >
                <span>
                  {scenarios.find((x) => x.id === h.scenarioId)?.name}
                  <small>
                    {h.role} · {new Date(h.startedAt).toLocaleDateString()}
                  </small>
                </span>
                <span>
                  Read debrief
                  <ArrowRight size={16} />
                </span>
              </button>
            ))}
          </div>
        )}
      </>
    );
  return (
    <>
      <nav className="session-nav">
        <button
          className="text-button"
          disabled={thinking}
          onClick={() => {
            updateSession({ pausedAt: s.pausedAt ?? Date.now() });
            location.hash = 'interview';
          }}
        >
          ← Save & return to interviews
        </button>
      </nav>
      <div className="session-heading">
        <div>
          <span className="eyebrow">
            {s.mode === 'mock' ? 'MOCK INTERVIEW' : 'GUIDED PRACTICE'} ·{' '}
            {s.role}
          </span>
          <h1>{scenario.name}</h1>
        </div>
        <div className="session-clock">
          {s.pausedAt && <span className="clock-state">Paused</span>}
          <Clock size={17} />
          <strong>
            {String(Math.floor(remaining / 60)).padStart(2, '0')}:
            {String(remaining % 60).padStart(2, '0')}
          </strong>
          {(s.mode === 'guided' || s.pausedAt) && (
            <button
              disabled={thinking}
              aria-label={s.pausedAt ? 'Resume interview' : 'Pause interview'}
              onClick={() => {
                if (s.pausedAt) {
                  const delta = Date.now() - s.pausedAt;
                  updateSession({
                    pausedAt: undefined,
                    deadline: s.deadline + delta,
                    startedAt: s.startedAt + delta,
                  });
                } else updateSession({ pausedAt: Date.now() });
              }}
            >
              {s.pausedAt ? <Play size={16} /> : <Pause size={16} />}
            </button>
          )}
        </div>
        <button
          className="secondary"
          disabled={thinking}
          onClick={() => setFinishOpen(true)}
        >
          End & debrief
        </button>
      </div>
      <CloudStatus {...cloud} />
      {(reviewStatus || reviewAvailable !== true) && (
        <p className="interview-connection-status" role="status">
          {reviewStatus ||
            (reviewAvailable === null
              ? 'Connecting to the interviewer…'
              : 'The interviewer is temporarily unavailable. Your conversation is saved.')}
        </p>
      )}
      {retryTurn && (
        <button
          className="secondary"
          disabled={thinking}
          onClick={() => send(retryTurn)}
        >
          Retry model reply
        </button>
      )}
      <div className="interview-live" data-tool={workspaceTab}>
        <section className="conversation">
          <InterviewTranscript
            messages={s.messages}
            thinking={thinking}
            replyStarted={replyStarted}
            critical={criticalReply}
          />
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label htmlFor="interview-message" className="composer-label">
              Your response
            </label>
            <textarea
              id="interview-message"
              value={draft}
              maxLength={6000}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Explain your reasoning or ask the interviewer a question…"
              disabled={thinking || !!s.pausedAt}
            />
            <div>
              <span>
                {thinking
                  ? 'Reply in progress · interview clock held'
                  : '⌘ / Ctrl + Enter to send'}
              </span>
              <button
                className="primary"
                type="submit"
                disabled={
                  !draft.trim() || thinking || !!s.pausedAt || !!retryTurn
                }
              >
                <Send size={15} />
                {thinking ? 'Replying…' : 'Send'}
              </button>
            </div>
          </form>
        </section>
        <section className="shared-workbench">
          <Tabs value={workspaceTab} onValueChange={setWorkspaceTab}>
            <TabsList className="studio-tabs">
              <TabsTrigger value="brief">Must meet</TabsTrigger>
              <TabsTrigger value="canvas">Canvas</TabsTrigger>
              <TabsTrigger value="contract">Contract</TabsTrigger>
              <TabsTrigger value="notes">Scratchpad</TabsTrigger>
            </TabsList>
            <TabsContent value="brief">
              <section className="interview-fixed-brief">
                <p className="brief-introduction">
                  Keep these requirements. Choose how to meet them.
                </p>
                {interviewTargetRows(scenario) && (
                  <dl className="interview-targets">
                    {interviewTargetRows(scenario)!.map((row) => (
                      <div key={row.label}>
                        <dt>{row.label}</dt>
                        <dd>{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {minimumInterviewBrief(scenario)
                  .requirements.filter(
                    (item) =>
                      !interviewTargetRows(scenario) ||
                      item.label === 'Core scope' ||
                      (scenario.id !== 'shortener' &&
                        item.label === 'Correctness & service targets'),
                  )
                  .map((item) => (
                    <div key={item.label}>
                      <h3>{item.label}</h3>
                      <p>{emphasizeTargets(item.text)}</p>
                    </div>
                  ))}
                {interviewTargetRows(scenario) && (
                  <details className="brief-qualifiers">
                    <summary>Target definitions & qualifications</summary>
                    <p>{scenario.quality}</p>
                    <p>{scenario.scale}</p>
                  </details>
                )}
                <div>
                  <h3>Where you have flexibility</h3>
                  <p>{minimumInterviewBrief(scenario).flexibility}</p>
                </div>
              </section>
            </TabsContent>
            <TabsContent value="canvas">
              <Editor
                design={s.design}
                onChange={(design) => updateSession({ design })}
                compact
              />
            </TabsContent>
            <TabsContent value="contract">
              <label className="field">
                <span>API, schema, class contract, or pseudocode</span>
                <textarea
                  className="interview-contract"
                  value={s.contract}
                  maxLength={20000}
                  onChange={(e) => updateSession({ contract: e.target.value })}
                  spellCheck={false}
                  placeholder="POST /orders\nIdempotency-Key: client-intent-id\n\nInputs, outputs, invariants, states, errors…"
                />
              </label>
              <p className="small">
                Present your design to include this contract in the interview
                conversation.
              </p>
            </TabsContent>
            <TabsContent value="notes">
              <label className="field">
                <span>Private thinking space</span>
                <textarea
                  className="interview-contract"
                  value={s.notes}
                  maxLength={15000}
                  onChange={(e) => updateSession({ notes: e.target.value })}
                  placeholder="Requirements, estimates, assumptions, alternatives…"
                />
              </label>
              <p className="small">
                Scratch notes are saved but are not counted as spoken interview
                evidence.
              </p>
            </TabsContent>
          </Tabs>
          {(workspaceTab === 'canvas' || workspaceTab === 'contract') && (
            <button
              className="secondary wide"
              disabled={thinking || !!s.pausedAt}
              onClick={() =>
                send({
                  session: s,
                  text: 'Please review my current canvas and contract. I have updated the design; challenge the weakest assumption and ask me to explain it.',
                })
              }
            >
              <Network size={16} />
              Present current design
            </button>
          )}
        </section>
      </div>
      <Dialog open={finishOpen} onOpenChange={setFinishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finish this interview?</DialogTitle>
            <DialogDescription>
              Your transcript, canvas, and contracts will be saved with the
              debrief. This ends the active session.
            </DialogDescription>
          </DialogHeader>
          <div className="inline-form">
            <button className="secondary" onClick={() => setFinishOpen(false)}>
              Keep going
            </button>
            <button className="primary" onClick={() => finish()}>
              Finish & review
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
