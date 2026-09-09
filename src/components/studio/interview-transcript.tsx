'use client';
import { useEffect, useRef } from 'react';
import type { Message } from '@/lib/studio/interview';
import Replying from './replying';

export default function InterviewTranscript({
  messages,
  thinking,
  replyStarted,
  critical,
}: {
  messages: Message[];
  thinking: boolean;
  replyStarted: number;
  critical: boolean;
}) {
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const transcript = body.current;
    if (transcript)
      transcript.scrollTo({
        top: transcript.scrollHeight,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
  }, [messages.length, thinking]);
  return (
    <div
      className="messages continuous-transcript"
      ref={body}
      aria-live="polite"
    >
      {messages.map((message) => (
        <article className={'message ' + message.role} key={message.id}>
          <span>
            {message.role === 'candidate'
              ? 'You'
              : message.role === 'interviewer'
                ? 'Interviewer'
                : 'Session update'}
          </span>
          {message.text.split(/\n\s*\n/).map((part, index) => (
            <p key={index}>{part}</p>
          ))}
        </article>
      ))}
      {thinking && <Replying startedAt={replyStarted} critical={critical} />}
    </div>
  );
}
