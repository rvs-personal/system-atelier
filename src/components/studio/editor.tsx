'use client';
import { useCallback, useState } from 'react';
import {
  Plus,
  Trash2,
  Link2,
  Layers3,
  Undo2,
  AlertTriangle,
} from 'lucide-react';
import Diagram from './diagram';
import { changeNode, installComponent } from '@/lib/studio/canvas-actions';
import { Choice } from './shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { describeDisruption, type Disruption } from '@/lib/studio/disruption';
import type { Design, DesignNode, NodeKind } from '@/lib/studio/model';
import { Switch } from '@/components/ui/switch';
const kinds: NodeKind[] = [
  'client',
  'balancer',
  'service',
  'cache',
  'database',
  'queue',
  'worker',
  'class',
];
export default function Editor({
  design,
  onChange: commit,
  onDecision,
  hot = [],
  compact = false,
}: {
  design: Design;
  onChange: (d: Design) => void;
  onDecision?: (reason: string) => void;
  hot?: string[];
  compact?: boolean;
}) {
  const [history, setHistory] = useState<Design[]>([]),
    [disruption, setDisruption] = useState<
      (Disruption & { before: Design }) | null
    >(null),
    [reason, setReason] = useState('');
  function onChange(next: Design) {
    setHistory((h) => [design, ...h].slice(0, 20));
    const issue = describeDisruption(design, next);
    commit(next);
    if (issue) {
      setDisruption({ ...issue, before: design });
      setReason('');
    }
  }
  function undo() {
    const previous = history[0];
    if (!previous) return;
    commit(previous);
    setHistory((h) => h.slice(1));
    setDisruption(null);
    setSelected('');
  }
  const [selected, setSelected] = useState(''),
    [kind, setKind] = useState<NodeKind>('service'),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [label, setLabel] = useState('Request'),
    [async, setAsync] = useState(false),
    [tools, setTools] = useState(false),
    [toolTab, setToolTab] = useState('inspect');
  const select = useCallback((id: string) => {
    setSelected(id);
    setTools(true);
    setToolTab('inspect');
  }, []);
  const node = design.nodes.find((n) => n.id === selected);
  function update(p: Partial<DesignNode>) {
    onChange({
      ...design,
      nodes: design.nodes.map((n) => (n.id === selected ? { ...n, ...p } : n)),
    });
  }
  function add() {
    if (design.nodes.length >= 24) return;
    const id = crypto.randomUUID();
    const node: DesignNode = {
      id,
      name: kind === 'class' ? 'NewClass' : 'New ' + kind,
      kind,
      detail:
        kind === 'class'
          ? 'id: string\nexecute(): void'
          : 'Define responsibility',
      capacity: kind === 'service' ? 2000 : 1000,
      replicas: 1,
    };
    onChange({ ...design, nodes: [...design.nodes, node] });
    select(id);
  }
  function connect() {
    if (
      !from ||
      !to ||
      from === to ||
      !label.trim() ||
      design.edges.some((e) => e.from === from && e.to === to)
    )
      return;
    onChange({
      ...design,
      edges: [
        ...design.edges,
        { id: crypto.randomUUID(), from, to, label: label.slice(0, 60), async },
      ],
    });
  }
  return (
    <div className="editor">
      <div className="editor-toolbar">
        <span>
          <Layers3 size={16} />
          Design canvas
        </span>
        <button
          className="text-button"
          disabled={!history.length}
          onClick={undo}
        >
          <Undo2 size={15} />
          Undo
        </button>
        <button className="text-button" onClick={() => setTools(!tools)}>
          {tools ? 'Hide controls' : 'Edit design'}
          <Plus size={15} />
        </button>
      </div>
      <Diagram
        design={design}
        hot={hot}
        onSelect={select}
        compact={compact}
        onAction={(id, action) => onChange(changeNode(design, id, action))}
      />
      <div
        className="canvas-palette"
        aria-label="Install and connect a component"
      >
        {(
          [
            'client',
            'balancer',
            'service',
            'database',
            'read-replica',
            'cache',
            'queue',
            'worker',
          ] as const
        ).map((k) => (
          <button key={k} onClick={() => onChange(installComponent(design, k))}>
            <Plus size={14} />
            {
              {
                client: 'Clients',
                balancer: 'Gateway / ingress',
                service: 'API pod',
                database: design.nodes.some(
                  (n) => n.kind === 'database' && n.role !== 'read-replica',
                )
                  ? 'DB standby'
                  : 'Primary DB',
                'read-replica': 'Read replica',
                cache: 'Cache',
                queue: 'Queue',
                worker: 'Worker',
              }[k]
            }
          </button>
        ))}
      </div>
      <div className="editor-help">
        {!design.nodes.some((n) => n.kind === 'client') &&
          design.nodes.some((n) => n.kind === 'service') && (
            <p className="feedback amber">
              <strong>Clients are missing.</strong> Use + Clients above to
              restore the entry point and connect it to the gateway or API.
            </p>
          )}
        <span>How to edit</span>
        <p>
          Use + / − inside a component to resize its fleet; × deletes it and its
          connections. The palette installs and connects common components.
          Click a component for capacity and custom connections. A database
          standby is for recovery; a read replica serves reads.
        </p>
        <div>
          {[
            ['inspect', 'Inspect component'],
            ['add', 'Add component'],
            ['connect', 'Connect components'],
          ].map(([id, title]) => (
            <button
              className={tools && toolTab === id ? 'selected' : ''}
              key={id}
              onClick={() => {
                setToolTab(id);
                setTools(true);
              }}
            >
              {title}
            </button>
          ))}
        </div>
        {tools && (
          <div className={'editor-bottom editor-mode-' + toolTab}>
            <div className="component-list">
              <div className="mini-heading">
                Components <span>{design.nodes.length}/24</span>
              </div>
              <div className="component-chips">
                {design.nodes.map((n) => (
                  <button
                    key={n.id}
                    className={
                      selected === n.id
                        ? 'component-chip selected'
                        : 'component-chip'
                    }
                    onClick={() => select(n.id)}
                  >
                    <span className={'kind-dot ' + n.kind} />
                    {n.name}
                  </button>
                ))}
              </div>
              <div className="add-component">
                <Choice
                  label="Component type"
                  value={kind}
                  options={kinds}
                  onChange={(v) => setKind(v as NodeKind)}
                />
                <button
                  className="secondary"
                  onClick={add}
                  disabled={design.nodes.length >= 24}
                >
                  <Plus size={16} />
                  Add
                </button>
              </div>
              {!node && toolTab === 'inspect' && (
                <p className="inspector-empty">
                  Select a component above to see its name, responsibility,
                  capacity and replicas.
                </p>
              )}
              {node && (
                <div className="node-form">
                  <label className="field">
                    <span>Name</span>
                    <input
                      maxLength={60}
                      value={node.name}
                      onChange={(e) => update({ name: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>
                      {node.kind === 'class'
                        ? 'Fields and methods (one per line)'
                        : 'Responsibility'}
                    </span>
                    <textarea
                      rows={3}
                      maxLength={400}
                      value={node.detail}
                      onChange={(e) => update({ detail: e.target.value })}
                    />
                  </label>
                  {['service', 'database', 'worker', 'cache'].includes(
                    node.kind,
                  ) && (
                    <div className="two-fields">
                      <label className="field">
                        <span>Capacity / second</span>
                        <input
                          type="number"
                          min={1}
                          max={1000000}
                          value={node.capacity}
                          onChange={(e) =>
                            update({
                              capacity: Math.max(
                                1,
                                Math.min(1000000, Number(e.target.value) || 1),
                              ),
                            })
                          }
                        />
                      </label>
                      {['service', 'database', 'worker', 'cache'].includes(
                        node.kind,
                      ) && (
                        <label className="field">
                          <span>Replicas</span>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={node.replicas}
                            onChange={(e) =>
                              update({
                                replicas: Math.max(
                                  1,
                                  Math.min(100, Number(e.target.value) || 1),
                                ),
                              })
                            }
                          />
                        </label>
                      )}
                    </div>
                  )}
                  <button
                    className="text-button danger"
                    onClick={() => {
                      onChange({
                        nodes: design.nodes.filter((n) => n.id !== node.id),
                        edges: design.edges.filter(
                          (e) => e.from !== node.id && e.to !== node.id,
                        ),
                      });
                      setSelected('');
                    }}
                  >
                    <Trash2 size={15} />
                    Remove component
                  </button>
                </div>
              )}
            </div>
            <div className="connection-list">
              <div className="mini-heading">Connections</div>
              <div className="two-fields">
                <Choice
                  label="From"
                  value={from}
                  options={design.nodes.map((n) => ({
                    value: n.id,
                    label: n.name,
                  }))}
                  onChange={setFrom}
                />
                <Choice
                  label="To"
                  value={to}
                  options={design.nodes.map((n) => ({
                    value: n.id,
                    label: n.name,
                  }))}
                  onChange={setTo}
                />
              </div>
              <label className="field">
                <span>Protocol or relationship</span>
                <input
                  value={label}
                  maxLength={60}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="HTTPS, publishes, depends on…"
                />
              </label>
              <label className="switch-row">
                <Switch checked={async} onCheckedChange={setAsync} />
                Asynchronous / dashed
              </label>
              <button
                className="secondary"
                disabled={
                  !from ||
                  !to ||
                  from === to ||
                  !label.trim() ||
                  design.edges.some((e) => e.from === from && e.to === to)
                }
                onClick={connect}
              >
                <Link2 size={16} />
                Connect
              </button>
              <div className="edge-list">
                {design.edges.map((e) => (
                  <div className="edge-row" key={e.id}>
                    <span>
                      {design.nodes.find((n) => n.id === e.from)?.name} →{' '}
                      {design.nodes.find((n) => n.id === e.to)?.name}
                      <small>
                        {e.label} · {e.async ? 'async' : 'sync'}
                      </small>
                    </span>
                    <button
                      aria-label={'Remove connection ' + e.label}
                      onClick={() =>
                        onChange({
                          ...design,
                          edges: design.edges.filter((x) => x.id !== e.id),
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <Dialog open={!!disruption} onOpenChange={() => {}}>
        <DialogContent showCloseButton={false} className="disruption-dialog">
          <DialogHeader>
            <span className="incident-alert-label">
              <AlertTriangle size={18} />
              Customer journey interrupted
            </span>
            <DialogTitle>{disruption?.title}</DialogTitle>
            <DialogDescription>{disruption?.cause}</DialogDescription>
          </DialogHeader>
          <div className="disruption-impact">
            <strong>What happens now</strong>
            <p>{disruption?.impact}</p>
          </div>
          <p>{disruption?.repair}</p>
          <button
            className="primary wide"
            onClick={() => {
              if (disruption) {
                commit(disruption.before);
                setHistory((h) => h.slice(1));
                setDisruption(null);
                setSelected('');
                onDecision?.(
                  'Restored the previous design after breaking a customer journey.',
                );
              }
            }}
          >
            <Undo2 size={16} />
            Restore component and connections
          </button>
          <label className="field">
            <span>
              Keeping this change? Explain your alternative and how you will
              repair the path.
            </span>
            <textarea
              rows={3}
              maxLength={1500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="I removed it because… The replacement path will be… I will verify…"
            />
          </label>
          <small>
            The lab stays paused here until you restore the change or record
            your reasoning. This records intent; it does not mark the system
            healthy.
          </small>
          <button
            className="secondary wide"
            disabled={reason.trim().length < 30}
            onClick={() => {
              onDecision?.(reason.trim());
              setDisruption(null);
            }}
          >
            Record reasoning & return to repair
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
