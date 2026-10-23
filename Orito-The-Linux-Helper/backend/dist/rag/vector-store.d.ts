interface VectorResult {
    id: string;
    score: number;
    metadata: Record<string, string>;
}
export declare function queryVectors(embedding: number[], topK?: number): Promise<VectorResult[]>;
export {};
//# sourceMappingURL=vector-store.d.ts.map