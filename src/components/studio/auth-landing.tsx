'use client';
import { useEffect, useState } from 'react';
import {
  Blocks,
  Moon,
  Sun,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Network,
  AudioLines,
} from 'lucide-react';
import NetworkBackdrop from './network-backdrop';
import './auth-landing.css';
const experiences = [
  {
    name: 'Learn',
    icon: BookOpen,
    title: 'Follow a request from browser to database.',
    detail:
      'Trace each boundary, experiment with a failure, then check your understanding before moving on.',
    label: 'A guided learning path',
  },
  {
    name: 'Build',
    icon: Network,
    title: 'Investigate a production incident.',
    detail:
      'Change the architecture. See what happens to checkout, latency, delivery and the monthly bill.',
    label: 'Architecture lab + LLD workbench',
  },
  {
    name: 'Interview',
    icon: AudioLines,
    title: 'Practice a design interview at your level.',
    detail:
      'Clarify the brief, defend a design and adapt as your interviewer introduces new constraints.',
    label: 'Adaptive interview practice',
  },
];
export default function AuthLanding({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState('light'),
    [screen, setScreen] = useState('landing'),
    [experience, setExperience] = useState(0);
  useEffect(() => {
    const next =
      localStorage.getItem('atelier-theme') ??
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(next);
    document.documentElement.dataset.theme = next;
    const sync = () =>
      setScreen(location.hash === '#signin' ? 'signin' : 'landing');
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const changeTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem('atelier-theme', next);
  };
  const openSignIn = () => {
    setScreen('signin');
    location.hash = 'signin';
    window.scrollTo({ top: 0 });
  };
  const openLanding = () => {
    setScreen('landing');
    location.hash = '';
    window.scrollTo({ top: 0 });
  };
  const current = experiences[experience];
  return (
    <main
      className={
        'entry-page public-entry precision-entry ' +
        (screen === 'signin' ? 'signin-page' : 'landing-page')
      }
    >
      {screen === 'landing' && <NetworkBackdrop />}
      <header className="entry-header">
        <a className="entry-brand" href="#" onClick={openLanding}>
          <Blocks size={26} />
          <span>
            system<span>atelier</span>
          </span>
        </a>
        <div className="public-header-actions">
          {screen === 'landing' && (
            <button className="landing-signin" onClick={openSignIn}>
              Sign in <ArrowRight size={15} />
            </button>
          )}
          <button
            className="entry-theme"
            onClick={changeTheme}
            aria-label={
              theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
            }
          >
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>
        </div>
      </header>
      {screen === 'signin' ? (
        <div className="signin-shell">
          <button className="signin-back" onClick={openLanding}>
            <ArrowLeft size={15} />
            Back to overview
          </button>
          <section className="entry-form-panel">{children}</section>
        </div>
      ) : (
        <>
          <section className="precision-hero">
            <div className="precision-copy">
              <span className="precision-eyebrow">
                A WORKSPACE FOR SYSTEM DESIGN
              </span>
              <h1>
                See the system.
                <br />
                <span>
                  Understand
                  <br />
                  the decision.
                </span>
              </h1>
              <p>
                Build an architecture. Break it under load. Learn why one design
                works—and what it costs you.
              </p>
              <button className="landing-explore" onClick={openSignIn}>
                Enter the workspace <ArrowRight size={18} />
              </button>
              <div className="precision-audience">
                From first principles to technical leadership.
              </div>
            </div>
          </section>
          <section
            className="precision-tour"
            aria-label="Explore the workspace"
          >
            <div
              className="precision-tabs"
              role="tablist"
              aria-label="Workspace experiences"
            >
              {experiences.map((e, i) => (
                <button
                  key={e.name}
                  role="tab"
                  aria-selected={experience === i}
                  tabIndex={experience === i ? 0 : -1}
                  aria-controls="experience-panel"
                  id={'experience-tab-' + i}
                  onClick={() => setExperience(i)}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'ArrowRight' ||
                      event.key === 'ArrowLeft'
                    ) {
                      event.preventDefault();
                      const next =
                        (i + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
                      setExperience(next);
                      document
                        .getElementById('experience-tab-' + next)
                        ?.focus();
                    }
                  }}
                >
                  <e.icon size={20} />
                  <span>{e.name}</span>
                  <ArrowRight size={15} />
                </button>
              ))}
            </div>
            <div
              className="precision-tour-detail"
              id="experience-panel"
              role="tabpanel"
              aria-labelledby={'experience-tab-' + experience}
            >
              <div>
                <span>{current.label}</span>
                <h2>{current.title}</h2>
              </div>
              <p>{current.detail}</p>
              <button
                onClick={openSignIn}
                aria-label={'Explore ' + current.name}
              >
                <ArrowRight size={22} />
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
