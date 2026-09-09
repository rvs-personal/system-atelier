import type { Foundation } from './chapter-foundations';

/** Original worked example. Protocol references appear in the lesson's source section. */
export const requestFoundation: Foundation = {
  name: 'One request, followed end to end',
  sections: [
    {
      title: '1. Start with the user action and the message',
      paragraphs: [
        'Imagine a bookshop page with a “View book” button. Clicking it runs browser code that asks for GET /books/42. The request identifies an operation and a resource; it does not contain an instruction to open a particular database table. The browser knows the public API contract. The service decides how to fulfill that contract. This separation lets the implementation change without requiring every browser to understand a new storage schema.',
        'An HTTP request carries a method, a target, headers and sometimes a body. In this example, the method is GET, the target is /books/42, and an authentication cookie may accompany the request. The cookie is evidence to validate, not permission by itself. The browser and server exchange encoded bytes. JSON is a possible representation of the application data; HTTP defines the surrounding request and response semantics.',
        'Before sending those bytes, the browser needs a usable connection to the destination. Name resolution, connection establishment and encryption setup may be involved. A warm connection can reuse earlier work, so do not add a fresh lookup and handshake to every request in a capacity estimate. Also distinguish the original HTML navigation from the later API call: one visible page often causes many independent resource requests.',
      ],
      example:
        'The user intent is “show book 42.” The public operation is GET /books/42. A possible success body is {"id":42,"title":"Distributed Systems"}. How that record is stored remains a service implementation detail.',
    },
    {
      title: '2. Follow the request to the component that owns the decision',
      paragraphs: [
        'Suppose the deployment has a public edge in front of several API instances. The edge accepts the external connection and selects an available instance. Routing answers “which instance receives this request?” It does not answer “is this caller allowed to read this book?” The API still needs an explicit identity and authorization boundary, whether it verifies the original credential or trusts an authenticated assertion from the edge.',
        'The selected API validates the book identifier, checks the caller’s access, and invokes the operation responsible for reading the catalog. For a simple implementation, that operation asks a database for the record with ID 42. The database credentials belong to the service. Sending them to the browser would expose a much broader authority than this one read operation and make the application’s authorization rules easy to bypass.',
        'An API instance may be stateless with respect to the next request while still depending on stateful systems. “Stateless” does not mean the application has no state. It usually means any healthy API instance can handle the next call because authoritative records and required session information are stored or represented elsewhere. Adding instances helps only if the remaining dependencies can handle the resulting workload.',
      ],
      example:
        'With four API instances, the edge can route one request to instance B and the next to D. Both must enforce the same book-access rule and read the same authoritative catalog. A local variable on B cannot be the only record of a customer’s purchase.',
    },
    {
      title: '3. Return the data through the API, then render it',
      paragraphs: [
        'The API obtains a database connection, sends a parameterized query and waits for a result. Waiting for an available connection is different from executing the query. A full connection pool can delay a request even when the query itself is fast. Separating pool wait, query execution and network time is essential: adding an index cannot directly remove time spent waiting for the API’s pool.',
        'The database returns rows to the API that issued the query. It does not send the page straight to the browser in this architecture. The API maps the row into its public response shape, omitting internal fields, choosing an HTTP status and serializing the body. The edge forwards that response on the browser-facing connection. The return path is database → API → edge → browser. The API owns the public response contract.',
        'A response arriving at the browser is still not the same event as a usable screen. Browser code must check the outcome, decode the representation and update the view. A server can return a valid response while the frontend fails to render it. Conversely, a loading indicator can keep spinning because the client never clears its loading state after an error. Investigate the user’s observed symptom across the whole path instead of assuming every blank page is a database outage.',
      ],
      example:
        'For a 250 ms deadline, suppose pool wait is 35 ms, query work 70 ms, API validation and serialization 20 ms, and the remaining network/edge time 45 ms. The modeled total is 170 ms, leaving 80 ms of headroom. Cutting query work in half saves 35 ms, not half of the entire request.',
    },
    {
      title: '4. Locate the failure before choosing a repair',
      paragraphs: [
        'Use the same request identity to connect observations at each boundary. If the browser has no completed connection, inspect destination resolution and reachability. If the edge sees the request but no API does, inspect routing and health selection. If the API starts the operation and waits for storage, inspect pool saturation and the query. If the API logs a completed response but the browser reports a timeout, inspect response delivery and the client deadline. These observations narrow the investigation; a missing log alone is not proof that an event never occurred.',
        'Now change the example to POST /orders, which creates an effect. The database may commit an order just before the connection breaks. The customer sees a timeout, yet the order exists. Repeating the operation with a new identity could create another order. A safe recovery design preserves the original intent identity and provides a way to discover or return its existing outcome. A retry is a new attempt to resolve the same intent, not permission to invent a second purchase.',
        'Compare repairs against the symptom and the requirement. More API instances can help an API bottleneck but can also add database connections and worsen storage saturation. A cache can reduce repeated catalog reads but introduces freshness and invalidation decisions. A longer timeout may allow slow work to finish while consuming concurrency for longer. Record which resource or uncertainty the repair addresses, then test the original failing sequence under the same workload.',
      ],
      example:
        'At 180 ms the order commits; at 200 ms the client gives up; at 220 ms the server tries to send its response. Both “the request timed out” and “the purchase succeeded” are true. The next action is to reconcile that purchase identity, not blindly create another order.',
    },
  ],
  checks: [
    {
      afterSection: 1,
      q: 'The edge routed a request to a healthy API instance. What has this established?',
      options: [
        'The caller is automatically authorized to read every book',
        'The request reached an instance; its identity and access still need a defined check',
        'The database has already committed the operation',
      ],
      answer: 1,
      why: 'Routing selects an instance. Authorization decides whether this caller may perform this operation. These are separate boundaries even if a trusted edge supplies a verified identity.',
    },
    {
      afterSection: 3,
      q: 'A request spends 100 ms waiting for a database connection and 10 ms executing its query. Which first investigation best matches the evidence?',
      options: [
        'Rewrite the JSON serializer without measuring it',
        'Inspect pool occupancy, connection hold time and downstream capacity',
        'Double the HTTP timeout and declare the incident solved',
      ],
      answer: 1,
      why: 'Most of the observed delay occurs before query execution. Check why connections remain occupied and whether the pool limit or downstream capacity is the constraint; blindly adding connections can worsen an already saturated database.',
    },
  ],
};
