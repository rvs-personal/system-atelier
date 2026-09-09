import {
  freshTour,
  tourReady,
  tourAction,
  tourMetrics,
  restoreTourGateway,
} from '../src/lib/studio/lab-tour';
import test from 'node:test';
import assert from 'node:assert/strict';
import { parentRoute } from '../src/lib/studio/navigation';
import { lldLibrary } from '../src/lib/studio/lld-library';
import {
  inferenceAllowed,
  readBounded,
  creditsExhausted,
  providerFailure,
  CreditsExhaustedError,
} from '../src/lib/inference/policy';
test('contextual back paths do not trap incidents or expose raw history IDs', () => {
  assert.equal(parentRoute('learn/request'), 'learn');
  assert.equal(parentRoute('lld/practice/lru'), 'lld/practice');
  assert.equal(parentRoute('lld/lru'), 'lld/simulations');
  assert.equal(parentRoute('lab/0/1'), 'lab');
  assert.equal(parentRoute('lab/0/3'), 'lab/0/2');
  assert.equal(parentRoute('interview/session'), 'interview');
  assert.equal(parentRoute('interview/history/abc'), 'interview/history');
  assert.equal(parentRoute('learn'), 'studio');
});
test('15 complete LLD cases include contracts, traces, failure checks and tradeoffs', () => {
  assert.equal(lldLibrary.length, 15);
  assert.equal(new Set(lldLibrary.map((c) => c.id)).size, 15);
  for (const c of lldLibrary) {
    assert.ok(c.invariants.length >= 3, c.id);
    assert.ok(c.sections.length >= 4, c.id);
    assert.ok(
      c.sections.every((s) => s.text.length > 150 && s.code.length > 30),
      c.id,
    );
    assert.ok(c.tests.length >= 4, c.id);
    assert.ok(c.extension.length > 30 && c.tradeoff.length > 80, c.id);
    assert.ok(c.starter.length > 40, c.id);
  }
});
test('model approval fails closed and matches full account IDs rather than names/substrings', () => {
  assert.equal(inferenceAllowed('account-a', undefined), false);
  assert.equal(inferenceAllowed('account-a', ''), false);
  assert.equal(inferenceAllowed('account-a', 'account-aa'), false);
  assert.equal(inferenceAllowed('account-a', 'account-b, account-a'), true);
  assert.equal(inferenceAllowed('charan', 'account-a'), false);
});
test('body limit measures actual stream bytes even without a content length', async () => {
  const request = (text: string) =>
    new Request('https://example.test', { method: 'POST', body: text });
  assert.equal(await readBounded(request('abc'), 3), 'abc');
  await assert.rejects(() => readBounded(request('abcd'), 3));
  await assert.rejects(() => readBounded(request('éé'), 3));
});

test('public AI access requires an explicit server flag and a real account', () => {
  assert.equal(inferenceAllowed('account-a', undefined, 'true'), true);
  assert.equal(inferenceAllowed('account-a', undefined, 'false'), false);
  assert.equal(inferenceAllowed('account-a', undefined, 'TRUE'), false);
  assert.equal(inferenceAllowed('account-a', '*'), false);
  assert.equal(inferenceAllowed('', undefined, 'true'), false);
  assert.equal(inferenceAllowed('  ', undefined, 'true'), false);
});

test('provider credit exhaustion is distinct from outages and rate throttling', async () => {
  assert.equal(creditsExhausted(402, null), true);
  assert.equal(
    creditsExhausted(429, { error: { code: 'insufficient_quota' } }),
    true,
  );
  assert.equal(
    creditsExhausted(0, { error: { message: 'Credit balance is too low' } }),
    true,
  );
  assert.equal(
    creditsExhausted(429, { error: { code: 'rate_limit_exceeded' } }),
    false,
  );
  assert.equal(
    creditsExhausted(500, { error: 'Internal server error' }),
    false,
  );
  assert.equal(creditsExhausted(0, { result: 'Credits exhausted' }), false);
  assert.ok(
    (await providerFailure(
      new Response('not json', { status: 402 }),
      'Inference',
    )) instanceof CreditsExhaustedError,
  );
  assert.equal(
    (await providerFailure(new Response('{}', { status: 404 }), 'Inference'))
      .message,
    'Inference HTTP 404',
  );
});

test('guided café tour gates actions and demonstrates capacity, cost and ingress recovery', () => {
  let s = freshTour();
  const untouched = freshTour();
  assert.equal(tourReady(s), false);
  assert.equal(tourAction(s, 'lb', 'remove'), s);
  s = { ...s, inspected: true };
  assert.equal(tourReady(s), true);
  s = { ...s, step: 1 };
  assert.equal(tourReady(s), false);
  s = { ...s, load: 150 };
  assert.equal(tourReady(s), true);
  assert.equal(tourMetrics(s).completed, 100);
  const baselineBill = tourMetrics(s).bill;
  s = { ...s, step: 2 };
  assert.equal(tourReady(s), false);
  s = tourAction(s, 'api', 'plus');
  assert.equal(tourReady(s), true);
  assert.equal(tourMetrics(s).completed, 150);
  assert.equal(tourMetrics(s).bill, baselineBill + 20);
  s = { ...s, step: 3 };
  assert.equal(tourReady(s), false);
  s = tourAction(s, 'api', 'minus');
  assert.equal(tourMetrics(s).completed, 100);
  assert.equal(tourReady(s), false);
  s = tourAction(s, 'api', 'plus');
  assert.equal(tourReady(s), true);
  s = { ...s, step: 4 };
  assert.equal(tourReady(s), false);
  s = tourAction(s, 'lb', 'remove');
  assert.equal(tourMetrics(s).completed, 0);
  assert.equal(tourReady(s), true);
  s = { ...s, step: 5 };
  assert.equal(tourReady(s), false);
  s = restoreTourGateway(s);
  assert.equal(tourReady(s), true);
  assert.equal(tourMetrics(s).completed, 150);
  assert.equal(restoreTourGateway(s), s);
  assert.equal(s.design.edges.length, untouched.design.edges.length);
  assert.deepEqual(freshTour(), untouched);
  assert.equal(parentRoute('lab/tour'), 'lab');
});
