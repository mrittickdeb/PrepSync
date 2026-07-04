import { type HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import type { Domain } from '@prepsync/shared';

export type BadgeVariant = 'domain' | 'status';
type StatusType = 'active' | 'completed' | 'abandoned' | 'waiting' | 'ended';

interface DomainBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant: 'domain';
  domain: Domain;
}

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant: 'status';
  status: StatusType;
}

type BadgeProps = DomainBadgeProps | StatusBadgeProps;

const domainStyles: Record<Domain, string> = {
  dsa: 'bg-[rgba(124,58,237,0.12)] text-[#A78BFA]',
  systemDesign: 'bg-[rgba(14,165,233,0.12)] text-[#38BDF8]',
  backend: 'bg-[rgba(16,185,129,0.12)] text-[#34D399]',
  conceptual: 'bg-[rgba(245,158,11,0.12)] text-[#FCD34D]',
  behavioural: 'bg-[rgba(236,72,153,0.12)] text-[#F9A8D4]',
};

const domainLabels: Record<Domain, string> = {
  dsa: 'DSA',
  systemDesign: 'SYSTEM DESIGN',
  backend: 'BACKEND',
  conceptual: 'CONCEPTUAL',
  behavioural: 'BEHAVIOURAL',
};

const statusStyles: Record<StatusType, string> = {
  active: 'bg-[rgba(0,229,160,0.12)] text-success',
  completed: 'bg-[rgba(0,212,255,0.12)] text-accent',
  abandoned: 'bg-[rgba(255,68,68,0.12)] text-danger',
  waiting: 'bg-[rgba(255,176,32,0.12)] text-warning',
  ended: 'bg-bg-overlay text-text-secondary',
};

const statusLabels: Record<StatusType, string> = {
  active: 'ACTIVE',
  completed: 'COMPLETED',
  abandoned: 'ABANDONED',
  waiting: 'WAITING',
  ended: 'ENDED',
};

export default function Badge(props: BadgeProps) {
  const { variant, className, ...rest } = props;

  if (variant === 'domain') {
    const { domain } = props as DomainBadgeProps;
    return (
      <span
        className={clsx(
          'inline-flex items-center px-[10px] py-[3px] rounded-sm text-[11px] font-medium font-sans uppercase tracking-[0.03em]',
          domainStyles[domain],
          className,
        )}
        {...rest}
      >
        {domainLabels[domain]}
      </span>
    );
  }

  const { status } = props as StatusBadgeProps;
  return (
    <span
      className={clsx(
        'inline-flex items-center px-[10px] py-[3px] rounded-sm text-[11px] font-medium font-sans uppercase tracking-[0.03em]',
        statusStyles[status],
        className,
      )}
      {...rest}
    >
      {statusLabels[status]}
    </span>
  );
}
