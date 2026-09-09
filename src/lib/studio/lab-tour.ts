import { initialDesign, reachable, type Design } from './model';
import { changeNode, type CanvasAction } from './canvas-actions';
export function tourDesign(): Design {
  return {
    nodes: initialDesign.nodes.map((n) => ({
      ...n,
      replicas: 1,
      capacity: n.kind === 'service' ? 100 : n.kind === 'database' ? 1000 : 0,
      name:
        n.id === 'client'
          ? 'Café customers'
          : n.id === 'lb'
            ? 'Gateway'
            : n.name,
    })),
    edges: initialDesign.edges.map((e) => ({ ...e })),
  };
}
export type TourState = {
  design: Design;
  step: number;
  load: number;
  inspected: boolean;
  reduced: boolean;
};
export const freshTour = (): TourState => ({
  design: tourDesign(),
  step: 0,
  load: 60,
  inspected: false,
  reduced: false,
});
export function tourMetrics(s: TourState) {
  const copies = s.design.nodes.find((n) => n.id === 'api')?.replicas ?? 0;
  const connected = reachable(s.design, 'client', 'db');
  const capacity = connected ? Math.min(copies * 100, 1000) : 0;
  return {
    copies,
    capacity,
    completed: Math.min(s.load, capacity),
    bill:
      40 + copies * 20 + (s.design.nodes.some((n) => n.id === 'lb') ? 10 : 0),
  };
}
export function tourReady(s: TourState) {
  const m = tourMetrics(s);
  return (
    [
      s.inspected,
      s.load === 150,
      m.copies === 2,
      s.reduced && m.copies === 2,
      !s.design.nodes.some((n) => n.id === 'lb'),
      s.design.nodes.some((n) => n.id === 'lb') && m.completed === 150,
      true,
    ][s.step] ?? false
  );
}
export function tourAction(
  s: TourState,
  id: string,
  action: CanvasAction,
): TourState {
  const permitted =
    (id === 'api' &&
      ((s.step === 2 && action === 'plus') ||
        (s.step === 3 && (action === 'minus' || action === 'plus')))) ||
    (s.step === 4 && id === 'lb' && action === 'remove');
  if (!permitted) return s;
  if (id === 'api' && action === 'plus' && tourMetrics(s).copies >= 2) return s;
  return {
    ...s,
    design: changeNode(s.design, id, action),
    reduced: s.reduced || (s.step === 3 && action === 'minus'),
  };
}
export function restoreTourGateway(s: TourState): TourState {
  if (s.step !== 5 || s.design.nodes.some((n) => n.id === 'lb')) return s;
  const original = tourDesign();
  return {
    ...s,
    design: {
      nodes: [...s.design.nodes, original.nodes.find((n) => n.id === 'lb')!],
      edges: [
        ...s.design.edges,
        ...original.edges.filter((e) => e.from === 'lb' || e.to === 'lb'),
      ],
    },
  };
}
