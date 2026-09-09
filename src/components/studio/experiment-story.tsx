'use client';
import { useState } from 'react';
export type StoryStep = { name: string; action: () => void; observe: string };
export default function ExperimentStory({
  title,
  customer,
  why,
  steps,
  consequence,
}: {
  title: string;
  customer: string;
  why: string;
  steps: StoryStep[];
  consequence: string;
}) {
  const [selected, setSelected] = useState(-1),
    [prediction, setPrediction] = useState(''),
    [reveal, setReveal] = useState(false);
  return (
    <section className="experiment-story">
      <div className="story-heading">
        <span className="eyebrow green">A REAL REASON TO USE THIS LAB</span>
        <h2>{title}</h2>
        <p>{customer}</p>
      </div>
      <div className="story-purpose">
        <strong>The decision you are making</strong>
        <p>{why}</p>
      </div>
      <div className="story-steps">
        {steps.map((step, i) => (
          <button
            className={selected === i ? 'selected' : ''}
            key={step.name}
            onClick={() => {
              step.action();
              setSelected(i);
              setReveal(false);
              setPrediction('');
            }}
          >
            <b>{i + 1}</b>
            <span>
              {step.name}
              <small>Apply this experiment ↓</small>
            </span>
          </button>
        ))}
      </div>
      {selected >= 0 && (
        <div className="story-observation" aria-live="polite">
          <strong>
            Experiment {selected + 1}: {steps[selected].name}
          </strong>
          <label className="field">
            <span>
              Before reading the explanation: what do you expect to change, and
              why?
            </span>
            <input
              value={prediction}
              onChange={(e) => setPrediction(e.target.value)}
              placeholder="My prediction… (optional)"
              maxLength={800}
            />
          </label>
          <button className="text-button" onClick={() => setReveal(!reveal)}>
            {reveal ? 'Hide explanation' : 'Explain the expected result'}
          </button>
          {reveal && <p>{steps[selected].observe}</p>}
        </div>
      )}
      <p className="story-tradeoff">
        <strong>There is no universal winner.</strong> {consequence}
      </p>
    </section>
  );
}
