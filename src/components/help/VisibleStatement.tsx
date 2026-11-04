import { useHelp } from './HelpProvider';

export function VisibleStatement({ id }: { id: string }) {
  const help = useHelp();
  return (
    <p className="visible-statement" data-required-text={id}>
      {help.requiredText(id)}
    </p>
  );
}
