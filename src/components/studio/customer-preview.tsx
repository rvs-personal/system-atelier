'use client';
import { useEffect, useState } from 'react';
import { X, Check, AlertTriangle, LoaderCircle } from 'lucide-react';
import { customerExperience } from '@/lib/studio/customer';
import type { OpsState } from '@/lib/studio/operations';
export default function CustomerPreview({ state }: { state: OpsState }) {
  const x = customerExperience(state),
    [dismissed, setDismissed] = useState('');
  const fingerprint = x.kind + ':' + state.incident;
  return (
    <div className="customer-preview">
      <div className="customer-browser">
        <div className="browser-chrome">
          <i />
          <i />
          <i />
          <span>shop.example / checkout</span>
          <strong>Customer view · simulation</strong>
        </div>
        <div className={'customer-page customer-' + x.kind}>
          {x.kind === 'blank' ? (
            <div
              className="blank-customer"
              aria-label="Blank customer page: required request path is disconnected"
            />
          ) : x.kind === 'loading' ? (
            <div className="customer-spinner">
              <LoaderCircle />
              <strong>Placing your order…</strong>
              <small>Still waiting for capacity</small>
            </div>
          ) : x.kind === 'checkout' ? (
            <div className="customer-state">
              <AlertTriangle />
              <strong>We couldn’t confirm your order.</strong>
              <p>Check the order status before trying again.</p>
            </div>
          ) : (
            <div className="customer-state">
              <Check />
              <strong>
                {x.kind === 'stale'
                  ? 'In stock · cached information'
                  : 'Order received'}
              </strong>
              <p>
                {x.kind === 'notification'
                  ? 'Confirmation email: waiting to be sent'
                  : x.kind === 'duplicate'
                    ? 'Two confirmation messages were sent for one logical event.'
                    : x.kind === 'stale'
                      ? 'This read can be older than the customer’s freshness contract.'
                      : 'Your order is confirmed.'}
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="customer-explanation" aria-live="polite">
        <span className="eyebrow">WHAT THE CUSTOMER EXPERIENCES</span>
        <h3>{x.title}</h3>
        <p>{x.detail}</p>
        <p>
          <strong>How to repair it:</strong> {x.action}
        </p>
      </div>
      {x.kind !== 'healthy' && dismissed !== fingerprint && (
        <div className="consequence-notice" role="status">
          <div>
            <strong>{x.title}</strong>
            <p>{x.action}</p>
          </div>
          <button
            aria-label="Dismiss failure notice"
            onClick={() => setDismissed(fingerprint)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
