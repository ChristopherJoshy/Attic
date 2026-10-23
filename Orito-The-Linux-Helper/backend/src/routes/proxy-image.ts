import type { FastifyInstance } from 'fastify';
import fetch from 'node-fetch';

export async function proxyImageRoutes(app: FastifyInstance) {
    app.get('/api/proxy-image', async (request, reply) => {
        try {
            const { url } = request.query as { url?: string };
            
            if (!url) {
                return reply.code(400).send({ error: 'URL parameter is required' });
            }

            // Only allow Google profile images
            if (!url.startsWith('https://lh3.googleusercontent.com/')) {
                return reply.code(403).send({ error: 'Only Google profile images are allowed' });
            }

            // Fetch the image
            const response = await fetch(url);
            
            if (!response.ok) {
                app.log.warn({ 
                    event: 'proxy_image_fetch_failed',
                    url,
                    status: response.status
                }, 'Failed to fetch proxied image');
                return reply.code(response.status).send({ error: 'Failed to fetch image' });
            }

            // Get content type
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.startsWith('image/')) {
                return reply.code(400).send({ error: 'URL does not point to an image' });
            }

            // Stream the image
            const buffer = await response.buffer();
            reply.header('Content-Type', contentType);
            reply.header('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
            return reply.send(buffer);
        } catch (error) {
            app.log.error({ 
                event: 'proxy_image_error',
                error: error instanceof Error ? error.message : 'Unknown error'
            }, 'Error proxying image');
            return reply.code(500).send({ error: 'Failed to proxy image' });
        }
    });
}
