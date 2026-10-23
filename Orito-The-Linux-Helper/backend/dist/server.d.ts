declare module 'fastify' {
    interface FastifyInstance {
        authenticate: any;
    }
}
declare module '@fastify/jwt' {
    interface FastifyJWT {
        payload: {
            userId: string | null;
            sessionId: string;
            tier: string;
            isAdmin: boolean;
        };
        user: {
            userId: string | null;
            sessionId: string;
            tier: string;
            isAdmin: boolean;
        };
    }
}
export {};
//# sourceMappingURL=server.d.ts.map