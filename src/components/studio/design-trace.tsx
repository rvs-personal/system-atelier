const traces: Record<string, [string, string, string, string]> = {
  lru: ['get(A)', 'B · A · C', 'A · B · C', 'Most recent → least recent'],
  parking: [
    'assign(vehicle)',
    'A1 · available',
    'A1 · occupied',
    'One space, one owner',
  ],
  bucket: ['take(1)', '2 tokens', '1 token', 'Bounded burst · timed refill'],
  order: ['pay()', 'pending', 'paid', 'Only valid transitions'],
  elevator: ['request(5)', 'floor 2', 'target 5', 'Intent is not movement'],
  vending: ['vend()', 'credit held', 'item dispensed', 'Commit or refund'],
  library: [
    'checkout(copy)',
    'available',
    'on loan',
    'Track the physical copy',
  ],
  'split-expense': [
    'split(100, 3)',
    '100 cents',
    '34 + 33 + 33',
    'Every cent accounted for',
  ],
  scheduler: ['claim(job)', 'pending', 'leased', 'One active claim'],
  pubsub: [
    'publish(event)',
    '2 subscribers',
    '2 callbacks',
    'Independent listener lifetimes',
  ],
  filesystem: ['resolve(/a/b)', '/a', 'child b', 'Names within a parent'],
  logging: [
    'log(message)',
    'structured event',
    'formatted record',
    'Policy separate from output',
  ],
  chess: [
    'move(e2, e4)',
    'white to move',
    'black to move',
    'Validate before changing state',
  ],
  reservation: [
    'confirm(hold)',
    'held',
    'confirmed',
    'Confirm once, safely retry',
  ],
  'connection-pool': [
    'acquire()',
    '1 available',
    '0 available',
    'Always release ownership',
  ],
};
export default function DesignTrace({ id }: { id: string }) {
  const trace = traces[id];
  if (!trace) return null;
  return (
    <div
      className="design-trace"
      aria-label={
        'Example: ' + trace[0] + ', ' + trace[1] + ' becomes ' + trace[2]
      }
    >
      <span className="trace-caption">EXAMPLE</span>
      <code>{trace[0]}</code>
      <div className={'trace-states trace-' + id}>
        {id === 'lru' ? (
          <>
            <span className="cache-order">
              <b>B</b>
              <b>A</b>
              <b>C</b>
            </span>
            <span aria-hidden="true">↓ get(A)</span>
            <strong className="cache-order">
              <b>A</b>
              <b>B</b>
              <b>C</b>
            </strong>
          </>
        ) : id === 'bucket' ? (
          <>
            <span className="token-units">
              <i />
              <i />
              <i data-empty />
            </span>
            <span aria-hidden="true">↓ take 1</span>
            <strong className="token-units">
              <i />
              <i data-empty />
              <i data-empty />
            </strong>
          </>
        ) : (
          <>
            <span>{trace[1]}</span>
            <span aria-hidden="true">↓</span>
            <strong>{trace[2]}</strong>
          </>
        )}
      </div>
      <small>{trace[3]}</small>
    </div>
  );
}
