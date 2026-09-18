'use client';
import { useEffect, useState } from 'react';
import {
  Blocks,
  Moon,
  Sun,
  ArrowRight,
  ArrowUpRight,
  ArrowLeft,
  BookOpen,
  Network,
  Code2,
  AudioLines,
} from 'lucide-react';
import Diagram from './diagram';
import type { Design } from '@/lib/studio/model';
import { lessons } from '@/lib/studio/curriculum';
import { incidents } from '@/lib/studio/operations';
import { lldLibrary } from '@/lib/studio/lld-library';
import './auth-landing.css';
import './public-overview.css';
const paths = [
  {
    title: 'Learn the foundations',
    href: '#learn',
    icon: BookOpen,
    count: `${lessons.length} lessons`,
    text: 'From the first request to distributed systems. Know what each component does, and when it earns its place.',
  },
  {
    title: 'Operate a live system',
    href: '#lab',
    icon: Network,
    count: `${incidents.length} incidents`,
    text: 'Investigate symptoms, change the architecture, and see what happens to customers and the bill.',
  },
  {
    title: 'Work through the code',
    href: '#lld',
    icon: Code2,
    count: `${lldLibrary.length} design cases`,
    text: 'Model contracts, trace state changes, and write an implementation you can defend.',
  },
  {
    title: 'Take the interview',
    href: '#interview',
    icon: AudioLines,
    count: 'Adaptive conversations',
    text: 'Clarify a brief, make your case, and respond as the constraints change. Sign in when you are ready.',
  },
];
export default function AuthLanding({
  children,
  signedIn = false,
  forceSignIn = false,
}: {
  children: React.ReactNode;
  signedIn?: boolean;
  forceSignIn?: boolean;
}) {
  const [theme, setTheme] = useState('light');
  const [traffic, setTraffic] = useState(false);
  const [scaled, setScaled] = useState(false);
  const demand = traffic ? 160 : 80;
  const capacity = scaled ? 200 : 100;
  const previewDesign: Design = {
    nodes: [
      {
        id: 'visitors',
        name: 'Customers',
        kind: 'client',
        detail: demand + ' req/s',
        replicas: 1,
        capacity: 0,
      },
      {
        id: 'handler',
        name: 'API service',
        kind: 'service',
        detail: scaled ? '2 pods × 100/s' : '1 pod × 100/s',
        replicas: 1,
        capacity: capacity,
      },
      {
        id: 'records',
        name: 'Database',
        kind: 'database',
        detail: '1,000 ops/s',
        replicas: 1,
        capacity: 1000,
      },
    ],
    edges: [
      {
        id: 'request',
        from: 'visitors',
        to: 'handler',
        label: 'Request',
        async: false,
      },
      {
        id: 'storage',
        from: 'handler',
        to: 'records',
        label: 'Read / write',
        async: false,
      },
    ],
  };
  useEffect(() => {
    const next = localStorage.getItem('atelier-theme') ?? 'light';
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);
  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem('atelier-theme', next);
  }
  return (
    <main className={'public-overview' + (forceSignIn ? ' public-auth' : '')}>
      <header className="public-nav">
        <a className="public-wordmark" href="/">
          <Blocks size={23} />
          <span>
            system<span>atelier</span>
          </span>
        </a>
        <nav aria-label="Public navigation">
          <a href="#learn">Learning path</a>
          <a href="#lab">Architecture lab</a>
          <a href="#lld">LLD workbench</a>
        </nav>
        <div>
          <button
            className="public-theme"
            onClick={toggleTheme}
            aria-label={
              theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
            }
          >
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <a className="public-account" href={signedIn ? '#studio' : '#signin'}>
            {signedIn ? 'My workspace' : 'Sign in'}
            <ArrowUpRight size={15} />
          </a>
        </div>
      </header>
      {forceSignIn ? (
        <section className="public-signin">
          <a href="#learn" className="public-back">
            <ArrowLeft size={16} /> Continue exploring
          </a>
          <div className="entry-form-panel">{children}</div>
          <p>
            Learning, architecture labs and coding practice are open without an
            account.
          </p>
        </section>
      ) : (
        <>
          <section className="open-hero">
            <p className="public-eyebrow">
              A working understanding of system design
            </p>
            <div className="hero-introduction">
              <h1>
                Good systems start
                <br />
                with better questions.
              </h1>
              <div className="hero-intro-aside">
                <p className="open-intro">
                  Learn the mechanisms. Test your assumptions. Understand the
                  cost of every design decision.
                </p>
                <div className="open-actions">
                  <a className="public-primary" href="#learn">
                    Explore the learning path <ArrowRight size={18} />
                  </a>
                  <a href="#lab/tour">
                    Try the guided lab <ArrowUpRight size={16} />
                  </a>
                </div>
              </div>
            </div>
            <div className="hero-study" data-busy={traffic && !scaled}>
              <div className="hero-study-art">
                <div className="preview-model-title">
                  A small service <span>Interactive model</span>
                </div>
                <Diagram
                  design={previewDesign}
                  hot={traffic && !scaled ? ['handler'] : []}
                  legend="Response returns through the API to the customer"
                />
                <div
                  className="capacity-strip"
                  aria-label={
                    'API demand ' +
                    demand +
                    ' of ' +
                    capacity +
                    ' requests per second capacity'
                  }
                >
                  <span>Demand / API capacity</span>
                  <div>
                    <i
                      style={{
                        width: Math.min(100, (demand / capacity) * 100) + '%',
                      }}
                    />
                  </div>
                  <strong>{Math.round((demand / capacity) * 100)}%</strong>
                </div>
                <div className="preview-meter" aria-live="polite">
                  <div>
                    <span>Offered traffic</span>
                    <strong>
                      {demand}
                      <small> req/s</small>
                    </strong>
                  </div>
                  <div>
                    <span>API capacity</span>
                    <strong>
                      {capacity}
                      <small> req/s</small>
                    </strong>
                  </div>
                  <div className={demand > capacity ? 'overloaded' : ''}>
                    <span>
                      {demand > capacity ? 'Excess demand' : 'Headroom'}
                    </span>
                    <strong>
                      {Math.abs(capacity - demand)}
                      <small> req/s</small>
                    </strong>
                  </div>
                </div>
              </div>
              <div className="hero-study-note">
                <span>Try a small thought experiment</span>
                <h2>
                  {scaled
                    ? 'Capacity restored. At a cost.'
                    : traffic
                      ? 'Twice the traffic. Same capacity.'
                      : 'What changes when traffic doubles?'}
                </h2>
                <p>
                  {scaled
                    ? 'A second API pod restores headroom. You pay for another pod; the database still has room. Real services also need failure and latency headroom.'
                    : traffic
                      ? 'Demand is now 160 requests/s, but this API handles 100. Adding a database replica will not fix this bottleneck.'
                      : 'An API handles 100 requests/s. Customers send 80. Before buying another server, change one assumption.'}
                </p>
                <button
                  className="experiment-primary"
                  onClick={() => {
                    setTraffic(!traffic);
                    setScaled(false);
                  }}
                >
                  {traffic ? 'Reset traffic' : 'Double the traffic'}{' '}
                  <ArrowRight size={16} />
                </button>
                {traffic && !scaled && (
                  <button
                    className="preview-repair"
                    onClick={() => setScaled(true)}
                  >
                    Add an API pod <ArrowRight size={16} />
                  </button>
                )}
                <p className="preview-assumption">
                  Illustrative steady-state model. One database operation per
                  request.
                </p>
              </div>
            </div>
          </section>
          <section className="open-directory">
            <div className="directory-heading">
              <h2>Choose how you want to learn.</h2>
              <p>
                Read a concept, test it in a system, then explain your decision.
              </p>
            </div>
            <div className="public-paths">
              {paths.map((p) => (
                <a key={p.href} href={p.href}>
                  <p.icon size={23} />
                  <div>
                    <h3>{p.title}</h3>
                    <p>{p.text}</p>
                    <span>{p.count}</span>
                  </div>
                  <ArrowUpRight className="path-arrow" size={20} />
                </a>
              ))}
            </div>
          </section>
          <section className="open-method">
            <div>
              <span className="public-eyebrow">The part after the diagram</span>
              <h2>
                A design is a set
                <br />
                of consequences.
              </h2>
              <p>
                Keep correctness, customer experience and cost in the same
                conversation. There is rarely one perfect answer.
              </p>
              <a href="#lab/tour">
                See it in the guided tour <ArrowRight size={16} />
              </a>
            </div>
            <ol>
              <li>
                <strong>Predict</strong>
                <p>
                  Write down what you expect to happen before changing the
                  system.
                </p>
              </li>
              <li>
                <strong>Experiment</strong>
                <p>
                  Remove a gateway. Lose a replica. Watch demand outgrow a
                  queue.
                </p>
              </li>
              <li>
                <strong>Explain</strong>
                <p>
                  Use the evidence to defend the repair, including what it makes
                  worse.
                </p>
              </li>
            </ol>
          </section>
          <footer className="public-footer">
            <span>System Atelier</span>
            <p>
              Learning and building are open. An account is needed for AI
              interviews and code reviews.
            </p>
            <a href="#learn/request">
              Start with one request <ArrowRight size={16} />
            </a>
          </footer>
        </>
      )}
    </main>
  );
}
