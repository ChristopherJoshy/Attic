import { config } from '../config/index.js';
const VECTOR_QUERY_TIMEOUT_MS = 10000; // 10 second timeout
// Singleton Pinecone client — avoid re-instantiating on every query
let pineconeInstance = null;
let pineconeIndex = null;
async function getPineconeIndex() {
    if (pineconeIndex)
        return pineconeIndex;
    const { Pinecone } = await import('@pinecone-database/pinecone');
    pineconeInstance = new Pinecone({ apiKey: config.PINECONE_API_KEY });
    pineconeIndex = pineconeInstance.index(config.PINECONE_INDEX);
    return pineconeIndex;
}
export async function queryVectors(embedding, topK = 10) {
    if (!embedding || embedding.length === 0)
        return [];
    try {
        if (config.VECTOR_PROVIDER === 'pinecone') {
            return await queryPinecone(embedding, topK);
        }
        return await queryQdrant(embedding, topK);
    }
    catch (err) {
        console.error('Vector query failed:', err instanceof Error ? err.message : err);
        return [];
    }
}
async function queryPinecone(embedding, topK) {
    if (!config.PINECONE_API_KEY)
        return [];
    const index = await getPineconeIndex();
    // Race against timeout
    const result = await Promise.race([
        index.query({
            vector: embedding,
            topK,
            includeMetadata: true,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Pinecone query timed out')), VECTOR_QUERY_TIMEOUT_MS)),
    ]);
    return (result.matches || []).map((m) => ({
        id: m.id,
        score: m.score || 0,
        metadata: m.metadata || {},
    }));
}
async function queryQdrant(embedding, topK) {
    if (!config.QDRANT_URL)
        return [];
    const response = await fetch(`${config.QDRANT_URL}/collections/orito/points/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            vector: embedding,
            limit: topK,
            with_payload: true,
        }),
        signal: AbortSignal.timeout(VECTOR_QUERY_TIMEOUT_MS),
    });
    if (!response.ok) {
        throw new Error(`Qdrant returned ${response.status}`);
    }
    const data = await response.json();
    return (data.result || []).map((r) => ({
        id: String(r.id),
        score: r.score || 0,
        metadata: r.payload || {},
    }));
}
//# sourceMappingURL=vector-store.js.map