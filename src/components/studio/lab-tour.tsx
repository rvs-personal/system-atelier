'use client';
import { useState } from 'react';
import { ArrowRight, RotateCcw, Check, Compass } from 'lucide-react';
import Diagram from './diagram';
import {
  freshTour,
  tourAction,
  tourMetrics,
  tourReady,
  restoreTourGateway,
} from '@/lib/studio/lab-tour';
const chapters = [
  {
    title: 'Meet the request handler',
    action: 'Click the API service box in the diagram.',
    why: 'A customer sends an order through the gateway. The API validates it, writes it to the database, and returns the response through the gateway. The database never replies directly to the browser.',
    target: 'api',
  },
  {
    title: 'Bring in the lunch crowd',
    action: 'Click “Send lunch traffic” below.',
    why: 'The café normally receives 60 orders per second. Lunch raises demand to 150. Each API pod can handle 100 orders per second in this simplified model; the database can handle 1,000.',
    target: 'api',
  },
  {
    title: 'Add capacity on the diagram',
    action: 'Click + inside API service once.',
    why: 'One pod completes only 100 of the 150 incoming orders each second. A second pod raises API capacity to 200. Check the completed orders and the monthly estimate as you add it.',
    target: 'api',
  },
  {
    title: 'Try the tradeoff',
    action:
      'Click − inside API service, then click + to restore the second pod.',
    why: 'Removing a pod saves $20/month in this teaching model, but 50 orders per second lose capacity. Adding it back restores service. A cheaper design only helps if it still meets customer demand.',
    target: 'api',
  },
  {
    title: 'Break the entrance',
    action: 'Click × inside Gateway.',
    why: 'Customers reach this system through the gateway. Removing it also removes its connections. More API pods cannot fix a missing request path—even healthy servers are unreachable.',
    target: 'lb',
  },
  {
    title: 'Restore the missing component',
    action: 'Click “+ Restore gateway” below the diagram.',
    why: 'The component palette is how you bring a missing part back. This repair restores the gateway and its customer → gateway → API connections. Look for all 150 orders completing again.',
    target: 'lb',
  },
];
export default function LabTour() {
  const [state, setState] = useState(freshTour),
    [feedback, setFeedback] = useState('');
  const m = tourMetrics(state),
    ready = tourReady(state),
    chapter = chapters[state.step];
  return (
    <section className="lab-tour" aria-label="Architecture lab guided tour">
      <div className="tour-heading">
        <div>
          <span className="eyebrow">START HERE · A SEPARATE PRACTICE CASE</span>
          <h2>The café’s first lunch rush</h2>
          <p>
            Learn the controls on a small system. Your incident designs are
            untouched.
          </p>
        </div>
        <button
          className="text-button"
          onClick={() => {
            setState(freshTour());
            setFeedback('');
          }}
        >
          <RotateCcw size={16} />
          Restart tour
        </button>
      </div>
      <div className="tour-layout">
        <aside className="tour-guide" aria-label="Your next action">
          <div className="tour-progress">
            {chapter
              ? `Step ${state.step + 1} of ${chapters.length}`
              : 'Tour complete'}
            <progress max={6} value={state.step} aria-label="Tour progress" />
          </div>
          <h3>{chapter?.title ?? 'You’re ready for an incident'}</h3>
          <p className="tour-instruction">
            {chapter?.action ??
              'Read the customer symptom, inspect the request path, make one change, and check the outcome.'}
          </p>
          <p>
            {chapter?.why ??
              'Real incidents include cache freshness, delivery retries, database failures and cost pressure. More capacity is only one possible repair.'}
          </p>
          <div className="tour-feedback" role="status">
            {feedback ||
              (ready && chapter
                ? 'Done. Check the customer result, then continue.'
                : chapter
                  ? 'Follow the action above to continue.'
                  : 'Tour complete. Your practice system is healthy again.')}
          </div>
          {chapter ? (
            <button
              className="primary"
              disabled={!ready}
              onClick={() => {
                setState((s) => ({ ...s, step: s.step + 1 }));
                setFeedback('');
              }}
            >
              Continue <ArrowRight size={16} />
            </button>
          ) : (
            <a className="primary" href="#lab">
              Choose an on-call incident <ArrowRight size={16} />
            </a>
          )}
          <a className="tour-exit" href="#lab">
            {chapter ? 'Exit tour' : 'Back to architecture lab'}
          </a>
        </aside>
        <div className="tour-system">
          <div className="tour-customer" aria-live="polite">
            <span>CUSTOMER VIEW · SIMULATION</span>
            <strong>
              {m.capacity === 0
                ? 'The café cannot receive orders'
                : m.completed < state.load
                  ? 'Some orders are waiting'
                  : 'Order confirmed'}
            </strong>
            <p>
              {m.completed} of {state.load} orders/s complete ·{' '}
              {state.load - m.completed} orders/s exceed available capacity
            </p>
          </div>
          <div className="tour-metrics">
            <div>
              <span>Offered traffic</span>
              <strong>{state.load}/s</strong>
            </div>
            <div>
              <span>Usable capacity</span>
              <strong>{m.capacity}/s</strong>
            </div>
            <div>
              <span>Monthly estimate</span>
              <strong>${m.bill}</strong>
            </div>
          </div>
          <Diagram
            design={state.design}
            hot={chapter ? [chapter.target] : []}
            onSelect={(id) => {
              if (id === 'api' && state.step === 0) {
                setState((s) => ({ ...s, inspected: true }));
                setFeedback(
                  'API service: 1 pod × 100 orders/s. Click Continue to put it under load.',
                );
              } else
                setFeedback(
                  chapter?.action ?? 'Restart the tour to practice again.',
                );
            }}
            onAction={(id, action) => {
              const next = tourAction(state, id, action);
              if (next === state)
                setFeedback(
                  chapter?.action ?? 'Restart the tour to practice again.',
                );
              else {
                setState(next);
                setFeedback('');
              }
            }}
          />
          <div className="tour-tools">
            {state.step === 1 && (
              <button
                className="primary"
                disabled={ready}
                onClick={() => setState((s) => ({ ...s, load: 150 }))}
              >
                Send lunch traffic · 150 orders/s
              </button>
            )}
            {state.step === 5 && (
              <button
                className="primary"
                disabled={ready}
                onClick={() => setState(restoreTourGateway)}
              >
                + Restore gateway
              </button>
            )}
            {ready && chapter && (
              <span>
                <Check size={16} /> Step completed
              </span>
            )}
            <small>
              Teaching model: fixed capacities, one database operation per
              order, illustrative costs. Response path: database → API → gateway
              → customer.
            </small>
          </div>
        </div>
      </div>
    </section>
  );
}
export function LabTourInvitation() {
  return (
    <a className="tour-invitation" href="#lab/tour">
      <Compass size={25} />
      <div>
        <strong>New to the lab? Try a guided tour.</strong>
        <span>
          Practice adding, removing and restoring components in a tiny café
          system.
        </span>
      </div>
      <span className="tour-start">
        Start tour <ArrowRight size={17} />
      </span>
    </a>
  );
}
