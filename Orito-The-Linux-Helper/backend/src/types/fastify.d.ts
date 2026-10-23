import { FastifyRequest, FastifyInstance } from 'fastify';
import { JWT } from '@fastify/jwt';

declare module 'fastify' {
    interface FastifyRequest {
        user: {
            userId: string | null;
            sessionId: string;
            tier: string;
        }
    }

    interface FastifyInstance {
        jwt: JWT;
        authenticate: (request: FastifyRequest, reply: any) => Promise<void>;
    }
}
