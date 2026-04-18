import { Injectable } from '@nestjs/common';
import type { RetrievalHit } from '@assistai/shared';
import { STRUCTURAL_CONFIG } from '@assistai/shared';
import { Subject } from 'rxjs';
import type { SseMessageEvent } from './completion.service';
import { RetrievalService } from '../retrieval/retrieval.service';

/**
 * Structural match fast-path — bypasses LLM when a high-similarity
 * chunk (≥ 0.85) exists in the workspace's document corpus.
 *
 * The structural threshold (0.85) is significantly higher than the
 * default retrieval threshold (0.72), ensuring the match is a close
 * structural replica of existing content — not just topically similar.
 */
@Injectable()
export class StructuralMatchService {
  constructor(private readonly retrievalService: RetrievalService) {}

  /**
   * Find a high-similarity structural match for the query embedding.
   *
   * @param workspaceId - Tenant scope for retrieval
   * @param queryEmbedding - The query vector; if empty, short-circuits to null
   * @returns The best hit if similarity ≥ 0.85, or null
   */
  async findMatch(
    workspaceId: string,
    queryEmbedding: number[],
  ): Promise<RetrievalHit | null> {
    if (queryEmbedding.length === 0) {
      return null;
    }

    const hits = await this.retrievalService.findSimilarChunks(
      workspaceId,
      queryEmbedding,
      { topK: STRUCTURAL_CONFIG.topK, similarityThreshold: STRUCTURAL_CONFIG.similarityThreshold },
    );

    return hits[0] ?? null;
  }

  /**
   * Stream a structural match result directly to the SSE subject,
   * bypassing the LLM provider entirely.
   *
   * Emits:
   * 1. A single `token` event with the full chunk content
   * 2. A `done` event with completion metadata and grounding info
   */
  streamTokens(
    subject: Subject<SseMessageEvent>,
    hit: RetrievalHit,
    completionId: string,
    startMs: number,
  ): void {
    subject.next({
      type: 'token',
      data: JSON.stringify({ text: hit.content }),
    });

    subject.next({
      type: 'done',
      data: JSON.stringify({
        completionId,
        latencyMs: Date.now() - startMs,
        isGrounded: true,
        structuralMatch: true,
        retrievalHits: [
          {
            rank: 1,
            chunkId: hit.chunkId,
            documentId: hit.documentId,
            documentTitle: hit.documentTitle,
            similarity: hit.similarity,
            excerpt: hit.content.slice(0, 200),
            metadata: hit.metadata ?? null,
          },
        ],
      }),
    });
  }
}
