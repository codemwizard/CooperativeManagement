import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';
import helpData from '../../../data/help.json';
import metaData from '../../../data/meta.json';
import destinationsData from '../../../data/destinations.json';
import interventionsData from '../../../data/interventions.json';
import { useCapture } from '../../capture';

type Pattern = 'tooltip' | 'popover' | 'helper';

interface HelpEntry {
  id: string;
  pattern: Pattern;
  screens: string[];
  text?: string;
  text_ref?: string;
  see_more?: { label: string; target_screen: string };
  value_tokens?: string[];
}

interface RequiredVisibleText {
  id: string;
  text: string;
  must_appear_on: string[];
}

interface HelpContextValue {
  openId: string | null;
  setOpenId: (id: string | null) => void;
  entry: (id: string) => HelpEntry;
  text: (id: string, values?: Record<string, string | number>) => string;
  requiredText: (id: string) => string;
}

const destinations = Object.fromEntries(destinationsData.destinations.map((destination) => [destination.id, destination]));
const tokenContext = {
  meta: metaData,
  destinations,
  interventions: interventionsData,
};

const HelpContext = createContext<HelpContextValue | null>(null);

function resolvePath(path: string): unknown {
  return path.split('.').reduce<unknown>((current, part) => {
    if (Array.isArray(current)) return current[Number(part)];
    if (current && typeof current === 'object') return (current as Record<string, unknown>)[part];
    return undefined;
  }, tokenContext);
}

function renderText(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{\{\s*([^}|]+?)\s*(?:\|\s*(\w+))?\s*\}\}/g, (_match, rawPath: string, filter: string | undefined) => {
    if (rawPath.startsWith('value.')) return String(values[rawPath.slice('value.'.length)] ?? '');
    const resolved = resolvePath(rawPath);
    if (filter === 'num') return Number(resolved).toLocaleString('en-US');
    return String(resolved ?? '');
  });
}

export function HelpProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const capture = useCapture();
  const entries = useMemo(() => new Map(helpData.entries.map((entry) => [entry.id, entry as HelpEntry])), []);
  const required = useMemo(() => new Map(helpData.required_visible_text.map((item) => [item.id, item as RequiredVisibleText])), []);

  const value = useMemo<HelpContextValue>(
    () => ({
      openId,
      setOpenId(id) {
        setOpenId(id);
        if (id) {
          const found = entries.get(id);
          if (found) capture?.emit('help_open', { help_id: id, pattern: found.pattern, via: 'tap' });
        }
      },
      entry(id) {
        const found = entries.get(id);
        if (!found) throw new Error(`Missing help entry: ${id}`);
        return found;
      },
      text(id, values) {
        const found = entries.get(id);
        if (!found) throw new Error(`Missing help entry: ${id}`);
        const source = found.text_ref ? String(resolvePath(found.text_ref) ?? '') : (found.text ?? '');
        return renderText(source, values);
      },
      requiredText(id) {
        const found = required.get(id);
        if (!found) throw new Error(`Missing required visible text: ${id}`);
        return found.text;
      },
    }),
    [capture, entries, openId, required],
  );

  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}

export function useHelp() {
  const value = useContext(HelpContext);
  if (!value) throw new Error('useHelp must be used inside HelpProvider');
  return value;
}
