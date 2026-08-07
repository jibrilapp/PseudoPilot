import { cn } from '@/lib/cn';

type IconProps = {
  className?: string;
};

const base = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function IconFiles({ className }: IconProps) {
  return (
    <svg className={cn('h-[18px] w-[18px]', className)} viewBox="0 0 24 24" aria-hidden {...base}>
      <path d="M4 6.2A2.2 2.2 0 0 1 6.2 4H11l2.2 2.2H17.8A2.2 2.2 0 0 1 20 8.4v9.4A2.2 2.2 0 0 1 17.8 20H6.2A2.2 2.2 0 0 1 4 17.8V6.2Z" />
    </svg>
  );
}

export function IconSearch({ className }: IconProps) {
  return (
    <svg className={cn('h-[18px] w-[18px]', className)} viewBox="0 0 24 24" aria-hidden {...base}>
      <circle cx="11" cy="11" r="6.25" />
      <path d="M16.2 16.2 20 20" />
    </svg>
  );
}

export function IconBug({ className }: IconProps) {
  return (
    <svg className={cn('h-[18px] w-[18px]', className)} viewBox="0 0 24 24" aria-hidden {...base}>
      <path d="M8.5 9.5h7v5.5a3.5 3.5 0 0 1-7 0V9.5Z" />
      <path d="M12 6v3.5M7.5 8 5 6.5M16.5 8 19 6.5M5.5 12.5H8M16 12.5h2.5M7 17l-1.8 1.8M17 17l1.8 1.8" />
    </svg>
  );
}

export function IconSpark({ className }: IconProps) {
  return (
    <svg className={cn('h-[18px] w-[18px]', className)} viewBox="0 0 24 24" aria-hidden {...base}>
      <path d="M12 4.5 13 9.5 18 10.5 13 11.5 12 16.5 11 11.5 6 10.5 11 9.5 12 4.5Z" />
    </svg>
  );
}

export function IconPlay({ className }: IconProps) {
  return (
    <svg className={cn('h-[14px] w-[14px]', className)} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8.2 5.8a1 1 0 0 1 1.52-.85l10.1 6.2a1 1 0 0 1 0 1.7l-10.1 6.2A1 1 0 0 1 8.2 18.2V5.8Z" />
    </svg>
  );
}

export function IconStop({ className }: IconProps) {
  return (
    <svg className={cn('h-[14px] w-[14px]', className)} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />
    </svg>
  );
}

export function IconPause({ className }: IconProps) {
  return (
    <svg className={cn('h-[14px] w-[14px]', className)} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6.5" y="5.5" width="3.5" height="13" rx="1" />
      <rect x="14" y="5.5" width="3.5" height="13" rx="1" />
    </svg>
  );
}

export function IconStepInto({ className }: IconProps) {
  return (
    <svg className={cn('h-[14px] w-[14px]', className)} viewBox="0 0 24 24" aria-hidden {...base}>
      <path d="M12 4v10" />
      <path d="m8 10 4 4 4-4" />
      <path d="M6 18h12" />
    </svg>
  );
}

export function IconStepOver({ className }: IconProps) {
  return (
    <svg className={cn('h-[14px] w-[14px]', className)} viewBox="0 0 24 24" aria-hidden {...base}>
      <path d="M6 12h9" />
      <path d="m12 8 4 4-4 4" />
      <path d="M6 18h12" />
    </svg>
  );
}

export function IconStepOut({ className }: IconProps) {
  return (
    <svg className={cn('h-[14px] w-[14px]', className)} viewBox="0 0 24 24" aria-hidden {...base}>
      <path d="M12 20V10" />
      <path d="m8 14 4-4 4 4" />
      <path d="M6 6h12" />
    </svg>
  );
}

export function IconContinue({ className }: IconProps) {
  return (
    <svg className={cn('h-[14px] w-[14px]', className)} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7.2 5.8a1 1 0 0 1 1.52-.85l9.1 5.6a1 1 0 0 1 0 1.7l-9.1 5.6A1 1 0 0 1 7.2 16.6V5.8Z" />
      <rect x="17.5" y="5.5" width="2.2" height="13" rx="0.8" />
    </svg>
  );
}

export function IconSplit({ className }: IconProps) {
  return (
    <svg className={cn('h-[18px] w-[18px]', className)} viewBox="0 0 24 24" aria-hidden {...base}>
      <rect x="3.75" y="4.75" width="6.5" height="14.5" rx="1.25" />
      <rect x="13.75" y="4.75" width="6.5" height="14.5" rx="1.25" />
    </svg>
  );
}

export function IconChevron({ className }: IconProps) {
  return (
    <svg className={cn('h-3.5 w-3.5', className)} viewBox="0 0 24 24" aria-hidden {...base}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function IconFile({ className }: IconProps) {
  return (
    <svg className={cn('h-3.5 w-3.5', className)} viewBox="0 0 24 24" aria-hidden {...base}>
      <path d="M7 3.75h7.25L19 8.5V20a1.25 1.25 0 0 1-1.25 1.25H7A1.25 1.25 0 0 1 5.75 20V5A1.25 1.25 0 0 1 7 3.75Z" />
      <path d="M14.25 3.75V8.5H19" />
    </svg>
  );
}

export function IconPanel({ className }: IconProps) {
  return (
    <svg className={cn('h-[18px] w-[18px]', className)} viewBox="0 0 24 24" aria-hidden {...base}>
      <rect x="3.75" y="4.75" width="16.5" height="14.5" rx="1.5" />
      <path d="M15.25 4.75v14.5" />
    </svg>
  );
}

export function IconTerminal({ className }: IconProps) {
  return (
    <svg className={cn('h-[18px] w-[18px]', className)} viewBox="0 0 24 24" aria-hidden {...base}>
      <rect x="3.75" y="5.25" width="16.5" height="13.5" rx="1.5" />
      <path d="m7.25 10 2.75 2-2.75 2M12.25 14h4.5" />
    </svg>
  );
}

export function IconVars({ className }: IconProps) {
  return (
    <svg className={cn('h-[18px] w-[18px]', className)} viewBox="0 0 24 24" aria-hidden {...base}>
      <path d="M7 7h10M7 12h10M7 17h6" />
      <circle cx="17.25" cy="17" r="1.75" />
    </svg>
  );
}

export function IconMenu({ className }: IconProps) {
  return (
    <svg className={cn('h-[18px] w-[18px]', className)} viewBox="0 0 24 24" aria-hidden {...base}>
      <path d="M5 7.5h14M5 12h14M5 16.5h14" />
    </svg>
  );
}

export function IconSidebar({ className }: IconProps) {
  return (
    <svg className={cn('h-[18px] w-[18px]', className)} viewBox="0 0 24 24" aria-hidden {...base}>
      <rect x="3.75" y="4.75" width="16.5" height="14.5" rx="1.5" />
      <path d="M8.75 4.75v14.5" />
    </svg>
  );
}

export function IconRestart({ className }: IconProps) {
  return (
    <svg className={cn('h-[14px] w-[14px]', className)} viewBox="0 0 24 24" aria-hidden {...base}>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v5h-5" />
    </svg>
  );
}

export function IconProblems({ className }: IconProps) {
  return (
    <svg className={cn('h-[14px] w-[14px]', className)} viewBox="0 0 24 24" aria-hidden {...base}>
      <path d="M12 4.75 20.25 19H3.75L12 4.75Z" />
      <path d="M12 10v4.5M12 17.25h.01" />
    </svg>
  );
}

export function IconBook({ className }: IconProps) {
  return (
    <svg className={cn('h-[18px] w-[18px]', className)} viewBox="0 0 24 24" aria-hidden {...base}>
      <path d="M5.5 5.25h10.25A2.25 2.25 0 0 1 18 7.5v11.25H7.75A2.25 2.25 0 0 0 5.5 21V5.25Z" />
      <path d="M5.5 5.25A2.25 2.25 0 0 1 7.75 3h8" />
      <path d="M9 9h6.5M9 12.5h6.5M9 16h4" />
    </svg>
  );
}
