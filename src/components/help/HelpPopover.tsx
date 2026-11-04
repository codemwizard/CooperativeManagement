import { useEffect, useId, useRef } from 'react';
import { Info } from 'lucide-react';
import { useHelp } from './HelpProvider';

export function HelpPopover({ id, values }: { id: string; values?: Record<string, string | number> }) {
  const help = useHelp();
  const contentId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const open = help.openId === id;
  const entry = help.entry(id);
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
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [help]);
  return (
    <span className="help-wrap" ref={wrapRef}>
      <button
        type="button"
        className="icon-button"
        data-help-id={id}
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => help.setOpenId(open ? null : id)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') help.setOpenId(null);
        }}
      >
        <Info size={16} aria-hidden="true" />
        <span className="sr-only">More information</span>
      </button>
      {open ? (
        <span id={contentId} className="help-bubble help-popover" role="region" aria-label="Help">
          {help.text(id, values)}
          {entry.see_more ? (
            <button type="button" className="see-more" onClick={() => help.setOpenId(null)}>
              {entry.see_more.label}
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
