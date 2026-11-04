import { useHelp } from './HelpProvider';

export function HelpHint({ id, controlId }: { id: string; controlId: string }) {
  const help = useHelp();
  return (
    <p id={`${controlId}-hint`} className="helper-text" data-help-id={id}>
      {help.text(id)}
    </p>
  );
}
