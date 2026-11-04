import type { ReactElement } from 'react';
import { cloneElement, useEffect, useId, useRef } from 'react';
import { useHelp } from './HelpProvider';

export function HelpTip({ id, children, values }: { id: string; children: ReactElement; values?: Record<string, string | number> }) {
  const help = useHelp();
  const tooltipId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const open = help.openId === id;
  const clearTimers = () => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  };
  const scheduleOpen = () => {
    clearTimers();
    openTimer.current = window.setTimeout(() => help.setOpenId(id), 300);
  };
  const scheduleClose = () => {
    clearTimers();
    closeTimer.current = window.setTimeout(() => help.setOpenId(null), 100);
  };

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) help.setOpenId(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') help.setOpenId(null);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimers();
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [help]);

  const trigger = cloneElement(children, {
    'data-help-id': id,
    'aria-describedby': open ? tooltipId : undefined,
    onFocus: () => help.setOpenId(id),
    onBlur: scheduleClose,
    onMouseEnter: scheduleOpen,
    onMouseLeave: scheduleClose,
    onPointerDown: () => help.setOpenId(open ? null : id),
  });

  return (
    <span className="help-wrap" ref={wrapRef}>
      {trigger}
      {open ? (
        <span id={tooltipId} role="tooltip" className="help-bubble help-tooltip">
          {help.text(id, values)}
        </span>
      ) : null}
    </span>
  );
}
