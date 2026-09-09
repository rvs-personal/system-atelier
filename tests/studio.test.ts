import {
  extraDossiers,
  applyResponse,
} from '../src/lib/studio/incident-library';
import { incidents, replayVerification } from '../src/lib/studio/operations';
import { foundationFor } from '../src/lib/studio/chapter-foundations';
import { chapterReading } from '../src/lib/studio/reading-time';
import { lldGuide } from '../src/lib/studio/lld-guide';
import { describeDisruption } from '../src/lib/studio/disruption';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialDesign,
  simulate,
  queueModel,
  quorumModel,
  graphDot,
  reachable,
  type Design,
} from '../src/lib/studio/model';
import {
  cacheGet,
  cachePut,
  consumeToken,
  transitionOrder,
  reviewModel,
  lldTemplates,
} from '../src/lib/studio/lld';
import {
  newSession,
  respond,
  presentDesign,
  scenarios,
  debrief,
  assignedScenario,
  roles,
  type Session,
} from '../src/lib/studio/interview';
import { lessons, stages } from '../src/lib/studio/curriculum';
import { instance } from '@viz-js/viz';
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('work/diagrams', { recursive: true });
test('model finds DB bottleneck, overload and one-node failover', () => {
  const r = simulate(initialDesign, {
    rps: 1500,
    reads: 90,
    hit: 90,
    failed: false,
  });
  assert.ok(r.valid);
  assert.equal(r.bottleneck, 'Database');
  assert.equal(r.completed, 1000);
  assert.equal(r.mean, null);
  const loss = simulate(
    {
      ...initialDesign,
      nodes: initialDesign.nodes.map((n) =>
        n.kind === 'service' ? { ...n, replicas: 1 } : n,
      ),
    },
    { rps: 100, reads: 90, hit: 90, failed: true },
  );
  assert.ok(loss.valid);
  assert.equal(loss.completed, 0);
  assert.equal(loss.mean, null);
});
test('only connected cache influences demand; writes bypass hits', () => {
  const cache = {
    id: 'cache',
    name: 'Cache',
    kind: 'cache' as const,
    detail: '',
    replicas: 1,
    capacity: 0,
  };
  const d: Design = {
    nodes: [...initialDesign.nodes, cache],
    edges: [...initialDesign.edges],
  };
  const a = simulate(d, { rps: 1000, reads: 90, hit: 90, failed: false });
  assert.ok(a.valid);
  assert.equal(a.dbDemand, 1000);
  d.edges.push(
    { id: 'ac', from: 'api', to: 'cache', label: 'read', async: false },
    { id: 'cd', from: 'cache', to: 'db', label: 'miss', async: false },
  );
  const b = simulate(d, { rps: 1000, reads: 90, hit: 90, failed: false });
  assert.ok(b.valid);
  assert.ok(Math.abs(b.dbDemand - 190) < 0.001);
  const writes = simulate(d, { rps: 1000, reads: 0, hit: 99, failed: false });
  assert.ok(writes.valid);
  assert.equal(writes.dbDemand, 1000);
});
test('disconnected and cyclic graph handling', () => {
  assert.equal(
    simulate(
      { nodes: initialDesign.nodes, edges: [] },
      { rps: 100, reads: 50, hit: 0, failed: false },
    ).valid,
    false,
  );
  assert.equal(
    reachable(
      {
        nodes: initialDesign.nodes,
        edges: [
          ...initialDesign.edges,
          {
            id: 'cycle',
            from: 'api',
            to: 'client',
            label: 'cycle',
            async: false,
          },
        ],
      },
      'client',
      'missing',
    ),
    false,
  );
});
test('queue and quorum calculations enforce their assumptions', () => {
  assert.deepEqual(queueModel(800, 3, 200, 60), {
    capacity: 600,
    backlog: 12000,
    drainSeconds: 20,
    growth: 200,
  });
  assert.equal(queueModel(100, 3, 200, 60).backlog, 0);
  assert.equal(quorumModel(3, 2, 2, 1).writeAvailable, true);
  assert.equal(quorumModel(3, 2, 2, 2).readAvailable, false);
  assert.equal(quorumModel(3, 1, 1, 0).overlap, false);
});
test('LRU ordering, updates, miss and capacity zero', () => {
  let s = cachePut({ capacity: 2, entries: [] }, 'A', '1');
  s = cachePut(s, 'B', '2');
  s = cacheGet(s, 'A').state;
  s = cachePut(s, 'C', '3');
  assert.deepEqual(
    s.entries.map(([k]) => k),
    ['C', 'A'],
  );
  assert.equal(cacheGet(s, 'B').value, undefined);
  assert.equal(cachePut(s, 'A', '9').entries.length, 2);
  assert.deepEqual(
    cachePut({ capacity: 0, entries: [] }, 'A', '1').entries,
    [],
  );
});
test('token bucket clamps refill and does not spend on rejection', () => {
  assert.deepEqual(consumeToken(0, 5, 1, 0), { allowed: false, tokens: 0 });
  assert.deepEqual(consumeToken(0, 5, 1, 100), { allowed: true, tokens: 4 });
  assert.deepEqual(consumeToken(0, 5, 1, -100), { allowed: false, tokens: 0 });
});
test('order transition protects lifecycle', () => {
  assert.equal(transitionOrder('pending', 'shipped').valid, false);
  assert.equal(transitionOrder('pending', 'paid').state, 'paid');
  assert.equal(transitionOrder('paid', 'shipped').state, 'shipped');
  assert.equal(transitionOrder('shipped', 'pending').valid, false);
});
test('all curriculum lessons have unique identities, complete exercises, valid quizzes', () => {
  assert.equal(lessons.length, 108);
  assert.equal(new Set(lessons.map((l) => l.id)).size, 108);
  for (let i = 0; i < stages.length; i++)
    assert.equal(lessons.filter((l) => l.stage === i).length, 18);
  for (const l of lessons) {
    assert.ok(l.answer >= 0 && l.answer < l.options.length);
    assert.ok(
      l.idea.length > 100 && l.exercise.length > 20 && l.solution.length > 50,
    );
  }
});
test('clarifying questions get scenario facts without advancing phase', () => {
  for (const scenario of scenarios) {
    let s = newSession(scenario, 'SDE 2', 'mock', 1000);
    assert.equal(s.deadline, 1000 + scenario.duration * 60000);
    s = respond(s, 'How many users and what latency target?');
    assert.equal(s.phase, 0);
    assert.ok(s.messages.at(-1)?.text.includes(scenario.scale));
    assert.ok(s.messages.at(-1)?.text.includes(scenario.quality));
  }
});
test('adaptive follow-ups inspect design and queue/cache discussion', () => {
  let s = newSession(scenarios[0], 'Senior engineer', 'mock');
  s = {
    ...s,
    phase: 3,
    design: {
      ...initialDesign,
      nodes: [
        ...initialDesign.nodes,
        {
          id: 'c',
          name: 'Read cache',
          kind: 'cache',
          detail: '',
          capacity: 1,
          replicas: 1,
        },
      ],
    },
  };
  s = respond(s, 'I cache reads to reduce database load.');
  assert.match(s.messages.at(-1)!.text, /exact key/);
  s = respond(
    s,
    'The key includes the link code and tenant; expiry is bounded.',
  );
  assert.match(s.messages.at(-1)!.text, /collision handling/);
});
test('guided mode coaches; mock does not reveal coaching', () => {
  let guided = newSession(scenarios[0], 'SDE 2', 'guided');
  guided = respond(guided, 'Help me understand');
  assert.match(guided.messages.at(-1)!.text, /Coaching pause/);
  const mock = respond(
    newSession(scenarios[0], 'SDE 2', 'mock'),
    'Help me understand',
  );
  assert.doesNotMatch(mock.messages.at(-1)!.text, /Coaching pause/);
});
test('weak answers and move-on requests cannot bypass the audit', () => {
  let s = newSession(scenarios[0], 'SDE 2', 'mock');
  for (let i = 0; i < 8; i++) s = respond(s, "Let's move on " + i);
  assert.equal(s.phase, 0);
  assert.equal(s.disrupted, false);
  assert.equal(s.audit?.length, 8);
});
test('scenario assignment rotates within level without a question picker', () => {
  for (const role of roles) {
    const first = assignedScenario(role, []);
    const second = assignedScenario(role, [newSession(first, role, 'mock')]);
    assert.notEqual(first.id, second.id);
  }
});
test('evidence accumulates across replies, then one same-case constraint unlocks another', () => {
  let s = newSession(scenarios[0], 'SDE 2', 'mock');
  s = respond(
    s,
    'The customer will create a link and share it with other users. Analytics is out of scope for the first release because redirect reliability matters more.',
  );
  assert.equal(s.phase, 0);
  s = respond(
    s,
    'Our redirect target is under 100 ms for the p95 response. I would measure that in the serving region and keep abuse removal within 60 seconds.',
  );
  assert.equal(s.phase, 1);
  assert.equal(s.audit?.length, 2);
  s = { ...s, phase: 4 };
  s = respond(
    s,
    'We detect impact with an alert on more than 1% failed requests. I isolate the cache dependency and recover by restoring a warm replica, but this adds cost and stale-read risk.',
  );
  assert.equal(s.phase, 4);
  assert.equal(s.extensions, 1);
  assert.match(s.messages.at(-1)!.text, /peak demand doubles/);
  const count = s.audit!.length;
  s = respond(
    s,
    'We detect impact with an alert on more than 1% failed requests. I isolate the cache dependency and recover by restoring a warm replica, but this adds cost and stale-read risk.',
  );
  assert.equal(s.audit!.length, count);
  assert.equal(s.phase, 4);
  s = respond(
    s,
    'We monitor 1% errors and limit optional analytics to recover the redirect path. Since demand doubles with a fixed budget, we reduce cost through cached reads, but accept stale-read risk.',
  );
  assert.equal(s.phase, 5);
  assert.equal(s.scenarioId, 'shortener');
});
test('principal interview adds migration pressure and requires an answer to that constraint', () => {
  let s: Session = {
    ...newSession(scenarios[0], 'Staff / Principal', 'mock'),
    phase: 4,
    extensions: 1,
  };
  s = respond(
    s,
    'We monitor the 2% error alert and isolate the dependency to recover. Because peak traffic doubles under the fixed budget, cached reads save cost but add invalidation risk.',
  );
  assert.equal(s.extensions, 2);
  assert.match(s.messages.at(-1)!.text, /second region/);
  s = respond(
    s,
    'We detect errors above 1% and pause requests to recover by rollback, but there is a cost and a substantial residual risk to users during this incident.',
  );
  assert.equal(s.phase, 4);
  assert.ok(s.audit!.at(-1)!.missing.length > 0);
});
test('Graphviz renders all templates, long labels and adversarial text as inert labels', async () => {
  const viz = await instance();
  for (const t of lldTemplates) {
    assert.ok(reviewModel(t.design).every((r) => r.pass));
    const svg = viz.renderString(graphDot(t.design), { format: 'svg' });
    assert.match(svg, /<svg/);
    writeFileSync('work/diagrams/' + t.id + '.svg', svg);
  }
  const hostile: Design = {
    nodes: [
      {
        id: 'x',
        name: '<script>alert(1)</script> " \\ long',
        kind: 'service',
        detail: 'Line one\nLine two',
        capacity: 1,
        replicas: 1,
      },
    ],
    edges: [],
  };
  const output = viz.renderString(graphDot(hostile), { format: 'svg' });
  assert.doesNotMatch(output, /<script>/);
  const svg = viz.renderString(graphDot(initialDesign), { format: 'svg' });
  writeFileSync('work/diagrams/architecture.svg', svg);
});
import {
  initialOps,
  injectIncident,
  operations,
  advanceOps,
  recoveryChecks,
  monthlyBill,
  productionDesign,
} from '../src/lib/studio/operations';
test('production removal breaks customer paths but disconnected capacity still costs', () => {
  const broken = {
    ...productionDesign,
    nodes: productionDesign.nodes.filter((n) => n.kind !== 'balancer'),
  };
  assert.equal(operations(broken, initialOps.config).syncSuccess, 0);
  assert.ok(monthlyBill(broken) > 0);
  const qBroken = {
    ...productionDesign,
    edges: productionDesign.edges.filter((e) => e.id !== 'qw'),
  };
  assert.equal(operations(qBroken, initialOps.config).workerCapacity, 0);
});
test('every incident starts with a violated target and has a feasible modeled recovery', () => {
  for (let i = 0; i < 6; i++) {
    let d = injectIncident(structuredClone(initialOps), i);
    assert.ok(
      recoveryChecks(d).some((c) => !c.pass),
      'incident ' + i + ' starts unhealthy',
    );
    if (i === 0)
      d.design.nodes = d.design.nodes.map((n) =>
        n.kind === 'service'
          ? { ...n, replicas: 5 }
          : n.kind === 'database'
            ? { ...n, capacity: 2000 }
            : n.kind === 'worker'
              ? { ...n, replicas: 3 }
              : n,
      );
    if (i === 1)
      d.design.nodes = d.design.nodes.map((n) =>
        n.kind === 'service' ? { ...n, replicas: 3 } : n,
      );
    if (i === 2) d.config.ttl = 60;
    if (i === 3) {
      d.design.nodes = d.design.nodes.map((n) =>
        n.kind === 'database' ? { ...n, replicas: 2 } : n,
      );
      d.config.dbDown = false;
    }
    if (i === 4)
      d.design.nodes = d.design.nodes.map((n) =>
        n.kind === 'service'
          ? { ...n, replicas: 2 }
          : n.kind === 'database' || n.kind === 'worker'
            ? { ...n, replicas: 1 }
            : n,
      );
    if (i === 5) {
      d.config.workerDown = false;
      d.config.providerLimit = 300;
      d.config.boundedRetries = true;
      d.config.payloadFixed = true;
      d = advanceOps(d, 180);
    }
    assert.ok(
      recoveryChecks(d).every((c) => c.pass),
      'feasible recovery ' +
        i +
        ': ' +
        JSON.stringify(recoveryChecks(d).filter((c) => !c.pass)),
    );
  }
});
test('more capacity costs money and simulation spend accrues at displayed rates', () => {
  const d = structuredClone(initialOps);
  const base = monthlyBill(d.design);
  d.design.nodes = d.design.nodes.map((n) =>
    n.kind === 'service' ? { ...n, replicas: n.replicas + 1 } : n,
  );
  assert.equal(monthlyBill(d.design), base + 60);
  assert.equal(advanceOps(d, 30 * 24 * 3600).spend, base + 60);
});
test('traffic controls cannot quietly weaken incident recovery requirements', () => {
  const d = injectIncident(structuredClone(initialOps), 0);
  d.config.rps = 100;
  assert.ok(
    recoveryChecks(d).some(
      (c) => !c.pass && c.label.includes('offered traffic'),
    ),
  );
});
import { shouldReview, validReview } from '../src/lib/studio/interview-review';
test('Opus is reserved for critical rounds, never ordinary estimates or lab reasoning', () => {
  const answer =
    'If a payment times out after authorization, I will not blindly retry the charge at another provider. That could double charge the customer. I reconcile the provider attempt using the same idempotency key.';
  assert.equal(shouldReview({ phase: 1 }, answer), false);
  assert.equal(shouldReview({ phase: 3 }, answer), true);
  assert.equal(
    shouldReview(
      { phase: 3, audit: [{ phase: 3, extension: 0, model: 'claude-opus-5' }] },
      answer,
    ),
    false,
  );
  assert.equal(shouldReview({ phase: 3 }, 'What are the requirements?'), false);
  assert.equal(
    validReview({
      passed: [7],
      followUp: 'A long enough follow-up question?',
      rationale: 'Some reasoning here',
      model: 'claude-opus-5',
    }),
    false,
  );
});
test('critical semantic review can reject superficial earlier rule evidence', () => {
  let s: Session = {
    ...newSession(scenarios[4], 'Senior engineer', 'mock'),
    phase: 3,
  };
  s = respond(
    s,
    'The input payment key returns a response. Two concurrent requests use a transaction because it should prevent duplicate charges, but I have not specified the provider behavior.',
  );
  const review = {
    passed: [0],
    followUp:
      'The provider charged but the reply was lost. Which durable identity prevents a second charge?',
    rationale:
      'Input is stated, but transaction boundaries do not include the provider.',
    model: 'claude-opus-5',
  };
  s = { ...s, phase: 3 };
  s = respond(
    s,
    'My input is the payment key. I return pending after the provider times out, but the uncertain payment attempt needs more thought before we define how another retry should work.',
    review,
  );
  assert.equal(s.phase, 3);
  assert.equal(s.audit!.at(-1)!.model, 'claude-opus-5');
  assert.equal(s.messages.at(-1)!.text, review.followUp);
});
import { atlas } from '../src/lib/studio/lesson-atlas';
import { customerExperience } from '../src/lib/studio/customer';
test('every chapter has a connected diagram, three explanations, an exact example and a failure case', async () => {
  const viz = await instance();
  for (const lesson of lessons.filter((l) => atlas[l.id])) {
    const a = atlas[lesson.id];
    assert.ok(a, lesson.id);
    assert.equal(a.trace.length, 3);
    assert.ok(
      a.trace.every((t) => t.length > 150),
      lesson.id + ' trace',
    );
    assert.ok(a.failure.length > 150);
    assert.ok(a.contract.length > 70);
    assert.ok(a.decision.length > 100);
    const svg = viz.renderString(graphDot(a.design), { format: 'svg' });
    assert.match(svg, /<svg/);
    writeFileSync('work/diagrams/lesson-' + lesson.id + '.svg', svg);
  }
});
test('customer consequences depend on actual connectivity, not a forbidden architecture choice', () => {
  const s = structuredClone(initialOps);
  s.design.nodes = s.design.nodes.filter((n) => n.kind !== 'balancer');
  assert.equal(customerExperience(s).kind, 'blank');
  s.design.edges.push({
    id: 'direct',
    from: 'client',
    to: 'api',
    label: 'Direct request',
    async: false,
  });
  assert.equal(customerExperience(s).kind, 'healthy');
  assert.equal(customerExperience(injectIncident(initialOps, 2)).kind, 'stale');
  assert.equal(
    customerExperience(injectIncident(initialOps, 3)).kind,
    'checkout',
  );
  assert.equal(customerExperience(injectIncident(initialOps, 4)).kind, 'bill');
  assert.equal(
    customerExperience(injectIncident(initialOps, 5)).kind,
    'notification',
  );
});

import { chapterRows } from '../src/lib/studio/curriculum-expanded';
import { changeNode, installComponent } from '../src/lib/studio/canvas-actions';
test('expanded chapters provide distinct concrete failures and repairs', () => {
  assert.equal(chapterRows.length, 72);
  assert.equal(new Set(chapterRows.map((r) => r[5])).size, 72);
  for (const r of chapterRows) {
    assert.ok(r[3].length > 100, r[1]);
    assert.ok(r[4].length > 60, r[1]);
    assert.ok(r[5].length > 60, r[1]);
    assert.ok(r[6].length > 60, r[1]);
    assert.ok(r[8].length > 25, r[1]);
  }
});
test('canvas installs connected capacity and distinguishes reads from writes', () => {
  let d = installComponent(structuredClone(productionDesign), 'read-replica');
  const replica = d.nodes.find((n) => n.role === 'read-replica')!;
  assert.ok(replica);
  const reads = simulate(d, { rps: 2000, reads: 100, hit: 0, failed: false });
  assert.ok(reads.valid);
  assert.equal(reads.readCapacity, 1000);
  d = changeNode(d, replica.id, 'plus');
  const scaled = simulate(d, { rps: 2000, reads: 100, hit: 0, failed: false });
  assert.ok(scaled.valid);
  assert.equal(scaled.completed, 2000);
  const writes = simulate(d, { rps: 2000, reads: 0, hit: 0, failed: false });
  assert.ok(writes.valid);
  assert.equal(writes.completed, 1000);
  d = changeNode(d, replica.id, 'remove');
  assert.ok(!d.edges.some((e) => e.from === replica.id || e.to === replica.id));
});
test('adding workers cannot overcome provider quota or poison messages', () => {
  let d = injectIncident(structuredClone(initialOps), 5);
  d.config.workerDown = false;
  const first = operations(d.design, d.config, d.backlog);
  d.design.nodes = d.design.nodes.map((n) =>
    n.kind === 'worker' ? { ...n, replicas: 30 } : n,
  );
  const more = operations(d.design, d.config, d.backlog);
  assert.equal(first.workerCapacity, more.workerCapacity);
  assert.ok(!more.healthy);
  d.config.quarantine = true;
  d = advanceOps(d, 10);
  assert.ok((d.deadLetters ?? 0) > 0);
  d.config.providerLimit = 500;
  d.config.boundedRetries = true;
  d.config.payloadFixed = true;
  assert.ok(
    recoveryChecks(d).some((c) => !c.pass && c.label.includes('Quarantined')),
  );
  d.design.nodes = d.design.nodes.map((n) =>
    n.kind === 'worker' ? { ...n, replicas: 2 } : n,
  );
  d.backlog += d.deadLetters ?? 0;
  d.deadLetters = 0;
  d = advanceOps(d, 120);
  assert.ok(recoveryChecks(d).every((c) => c.pass));
});
test('all 30 interview cases rotate before repeating', () => {
  assert.equal(scenarios.length, 30);
  const history: Session[] = [];
  for (let i = 0; i < 30; i++) {
    const c = assignedScenario(roles[0], history);
    assert.ok(!history.some((h) => h.scenarioId === c.id));
    history.push(newSession(c, roles[0], 'mock'));
  }
});

test('deleting ingress interrupts the journey and reinstalling reconnects it', () => {
  const broken = changeNode(initialDesign, 'lb', 'remove');
  assert.match(
    describeDisruption(initialDesign, broken)!.impact,
    /no longer reach/,
  );
  const restored = installComponent(broken, 'balancer');
  assert.equal(
    simulate(restored, { rps: 100, reads: 90, hit: 0, failed: false }).valid,
    true,
  );
});
test('clients can be restored and deliberate gateway bypass is not called an outage', () => {
  const broken = changeNode(initialDesign, 'client', 'remove');
  assert.ok(describeDisruption(initialDesign, broken));
  assert.equal(
    simulate(installComponent(broken, 'client'), {
      rps: 100,
      reads: 90,
      hit: 0,
      failed: false,
    }).valid,
    true,
  );
  const bypass = {
    ...initialDesign,
    edges: [
      ...initialDesign.edges,
      {
        id: 'direct',
        from: 'client',
        to: 'api',
        label: 'Direct HTTPS',
        async: false,
      },
    ],
  };
  assert.equal(
    describeDisruption(bypass, changeNode(bypass, 'lb', 'remove')),
    null,
  );
});

test('expanded incident library has distinct causes and recoveries that retain offered load', () => {
  assert.equal(incidents.length, 22);
  assert.equal(new Set(extraDossiers.map((d) => d.fault)).size, 16);
  for (let i = 6; i < incidents.length; i++) {
    let s = injectIncident(structuredClone(initialOps), i);
    const offered = s.config.rps;
    assert.ok(
      recoveryChecks(s).some((c) => !c.pass),
      incidents[i].title,
    );
    s = applyResponse(s, extraDossiers[i - 6].actions[0]);
    s = advanceOps(s, 600);
    s = replayVerification(s);
    assert.equal(s.config.rps, offered);
    assert.ok(
      recoveryChecks(s).every((c) => c.pass),
      incidents[i].title +
        JSON.stringify(recoveryChecks(s).filter((c) => !c.pass)),
    );
  }
});
test('unrelated scaling cannot fix expired TLS and unsafe recovery remains unresolved', () => {
  let s = injectIncident(structuredClone(initialOps), 10);
  s = applyResponse(s, extraDossiers[4].actions[2]);
  assert.equal(operations(s.design, s.config, s.backlog).syncSuccess, 0);
  assert.ok(recoveryChecks(s).some((c) => !c.pass));
  s = injectIncident(structuredClone(initialOps), 17);
  s = applyResponse(s, extraDossiers[11].actions[2]);
  assert.equal(operations(s.design, s.config, s.backlog).businessSafe, false);
});
test('chapter estimates derive from reading content and all LLD guides include concrete sequences', () => {
  for (const l of lessons) {
    const f = foundationFor(l);
    assert.ok(f.sections.length >= 2);
    assert.ok(chapterReading(l).words > 400);
    assert.equal(
      chapterReading(l).minutes,
      Math.ceil(chapterReading(l).words / 200),
    );
  }
  for (const t of lldTemplates) {
    const g = lldGuide[t.id];
    assert.equal(g.steps.length, 4);
    assert.ok(g.steps.every((s) => s.text.length > 200 && s.code.length > 30));
    assert.equal(g.cases.length, 4);
  }
});

import { nextIncident } from '../src/lib/studio/operations';
test('next incident traverses the complete library before repeating', () => {
  let state = structuredClone(initialOps);
  const seen = new Set<number>();
  for (let run = 0; run < incidents.length; run++) {
    const i = nextIncident(state);
    assert.ok(!seen.has(i));
    seen.add(i);
    state = injectIncident(state, i);
    state.resolved.push(i);
  }
  assert.equal(seen.size, incidents.length);
  assert.notEqual(nextIncident(state), state.incident);
});
test('repeat incidents vary visible constraints and preserve offered-traffic checks', () => {
  for (let i = 0; i < incidents.length; i++) {
    let state = structuredClone(initialOps);
    const loads = new Set<number>();
    for (let run = 0; run < 3; run++) {
      state = injectIncident(state, i);
      loads.add(state.config.rps);
      assert.equal(state.variation, run);
      assert.ok(
        recoveryChecks(state).some((c) => !c.pass),
        incidents[i].title,
      );
      const weakened = {
        ...state,
        config: { ...state.config, rps: state.config.rps - 100 },
      };
      assert.equal(
        recoveryChecks(weakened).find((c) =>
          c.label.includes('offered traffic'),
        )?.pass,
        false,
      );
      if (i >= 6) {
        let repaired = applyResponse(state, extraDossiers[i - 6].actions[0]);
        repaired = advanceOps(repaired, 900);
        repaired = replayVerification(repaired);
        assert.ok(
          recoveryChecks(repaired).every((c) => c.pass),
          incidents[i].title + ' variation ' + run,
        );
      }
    }
    assert.equal(loads.size, 3);
  }
});

test('interview minimum brief preserves canonical workload and guarantees across all cases', async () => {
  const { minimumInterviewBrief } =
    await import('../src/lib/studio/interview-brief');
  for (const scenario of scenarios) {
    const brief = minimumInterviewBrief(scenario);
    assert.equal(
      brief.requirements.find((x) => x.label === 'Workload')?.text,
      scenario.scale,
    );
    assert.equal(
      brief.requirements.find(
        (x) => x.label === 'Correctness & service targets',
      )?.text,
      scenario.quality,
    );
    assert.ok(brief.requirements[0].text.length > 20);
  }
  const links = minimumInterviewBrief(
    scenarios.find((x) => x.id === 'shortener')!,
  );
  assert.match(links.requirements[0].text, /redirect/);
  assert.match(links.requirements[0].text, /abusive/);
  assert.doesNotMatch(links.requirements[0].text, /aliases/);
  assert.match(links.flexibility, /aliases may be deferred/);
  const payments = minimumInterviewBrief(
    scenarios.find((x) => x.id === 'payments')!,
  );
  assert.match(payments.requirements[0].text, /refunds/);
});

import { reviewedPhase } from '../src/lib/studio/interview-review';
test('interview phase follows complete distinct audit evidence', () => {
  assert.equal(reviewedPhase(0, [0, 1, 2]), 1);
  assert.equal(reviewedPhase(0, [0, 1]), 0);
  assert.equal(reviewedPhase(0, [0, 0, 0]), 0);
  assert.equal(reviewedPhase(3, [2, 0, 1]), 4);
  assert.equal(reviewedPhase(5, [0, 1, 2]), 5);
});

import { interviewTargetRows } from '../src/lib/studio/interview-brief';
test('every interview case has a compact numeric reference without changing its canonical brief', () => {
  for (const scenario of scenarios) {
    const before = JSON.stringify(scenario),
      rows = interviewTargetRows(scenario);
    assert.ok(rows && rows.length >= 2, scenario.id);
    assert.equal(new Set(rows.map((r) => r.label)).size, rows.length);
    assert.ok(rows.every((r) => r.value.length > 0));
    assert.equal(JSON.stringify(scenario), before);
  }
  const shortener = interviewTargetRows(
    scenarios.find((s) => s.id === 'shortener')!,
  )!;
  assert.ok(
    shortener.some(
      (r) =>
        r.label === 'Regional redirect latency' && r.value === 'p95 ≤ 100 ms',
    ),
  );
  assert.ok(
    shortener.some(
      (r) => r.label === 'Retention' && r.value.includes('unless expired'),
    ),
  );
});
