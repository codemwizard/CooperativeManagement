import type { FastifyPluginAsync } from 'fastify';
import { verifiedFindingListSchema, workspaceContextFactsSchema } from '@symphony/contracts';
import type { PostgresVerifiedFindingRepository, PostgresWorkspaceContextRepository } from '@symphony/db';

/** WP2.2 returns trusted persisted facts; WP6.1 owns presentation mapping. */
export function createWorkspaceContextRoutes(
  repository: PostgresWorkspaceContextRepository,
  verifiedFindings: PostgresVerifiedFindingRepository,
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

    fastify.get<{ Querystring: { organizationId?: string } }>('/workspace/verified-findings', async (request, reply) => {
      reply.header('Cache-Control', 'no-store, private');
      const session = request.authSession;
      if (!session) {
        await reply.status(401).send({ code: 'UNAUTHENTICATED' });
        return;
      }
      const organizationId = request.query.organizationId;
      if (!organizationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId)) {
        await reply.status(400).send({ code: 'INVALID_REQUEST' });
        return;
      }
      const findings = await verifiedFindings.listForAssignedVerifier(session.userId, session.tenantId, organizationId);
      return { data: verifiedFindingListSchema.parse(findings) };
    });

  };
}
