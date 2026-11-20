import { workspaceContextFactsSchema } from '@symphony/contracts';
import type { WorkspaceContextFactsContract } from '@symphony/contracts';

export async function readWorkspaceContext(): Promise<WorkspaceContextFactsContract> {
  const response = await fetch('/workspace/context', {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('WORKSPACE_CONTEXT_UNAVAILABLE');
  const envelope = await response.json() as { data?: unknown };
  return workspaceContextFactsSchema.parse(envelope.data);
}
