import type { FastifyPluginAsync } from 'fastify';
import { workspaceContextFactsSchema } from '@symphony/contracts';
import type { PostgresWorkspaceContextRepository } from '@symphony/db';

/** WP2.2 returns trusted persisted facts; WP6.1 owns presentation mapping. */
export function createWorkspaceContextRoutes(
  repository: PostgresWorkspaceContextRepository,
): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/workspace/context', async (request, reply) => {
      reply.header('Cache-Control', 'no-store, private');
      const session = request.authSession;
      if (!session) {
        await reply.status(401).send({ code: 'UNAUTHENTICATED' });
        return;
      }
      const facts = await repository.resolve(session.userId, session.tenantId);
      if (!facts) {
        await reply.status(401).send({ code: 'UNAUTHENTICATED' });
        return;
      }
      return { data: workspaceContextFactsSchema.parse(facts) };
    });

  };
}
