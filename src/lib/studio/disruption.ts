import { reachable, type Design } from './model';
const path = (d: Design, a: string, b: string) =>
  d.nodes
    .filter((n) => n.kind === a)
    .some((x) =>
      d.nodes
        .filter((n) => n.kind === b && n.role !== 'read-replica')
        .some((y) => reachable(d, x.id, y.id)),
    );
export type Disruption = {
  title: string;
  cause: string;
  impact: string;
  repair: string;
};
export function describeDisruption(
  before: Design,
  after: Design,
): Disruption | null {
  const removed = before.nodes.filter(
    (n) => !after.nodes.some((x) => x.id === n.id),
  );
  const names = removed.map((n) => n.name).join(', ');
  const cause = names
    ? `You removed ${names} and its connections.`
    : 'You removed a connection used by this journey.';
  if (path(before, 'client', 'service') && !path(after, 'client', 'service'))
    return {
      title: 'The front door just disappeared.',
      cause,
      impact:
        'Clients can no longer reach the API. The simulated customer page goes blank; adding more API pods cannot restore a missing route.',
      repair:
        'Restore the deletion, or connect Clients → Ingress → API. A direct client-to-API route is also possible if you deliberately move routing, TLS and access controls elsewhere.',
    };
  if (
    path(before, 'service', 'database') &&
    !path(after, 'service', 'database')
  )
    return {
      title: 'The order has nowhere to be committed.',
      cause,
      impact:
        'The API has lost its path to authoritative storage. A cache or read replica alone cannot confirm new writes.',
      repair:
        'Restore the primary database path, or explain and build another authoritative write path before declaring recovery.',
    };
  if (path(before, 'service', 'worker') && !path(after, 'service', 'worker'))
    return {
      title: 'Checkout called. The email never did.',
      cause,
      impact:
        'The notification delivery path is broken. A successful checkout does not mean that a customer received the message.',
      repair:
        'Reconnect API → Queue → Worker. A different delivery path is valid if you account for durability, retries and provider limits.',
    };
  return null;
}
