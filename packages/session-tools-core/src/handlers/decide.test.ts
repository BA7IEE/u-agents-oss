import { describe, it, expect } from 'bun:test';
import { handleDecide, compactDecisionAnswers, formatDecisionError } from './decide.ts';
import type { SessionToolContext, DecisionToolCallbacks, DecisionToolRequest, DecisionToolResult, DecisionToolQuestion } from '../context.ts';

const QUESTIONS: Record<string, DecisionToolQuestion> = {
  topic: { type: 'choice', instructions: 'Which topic?', criteria: { billing: 'money', shipping: 'delivery', other: null } },
  urgent: { type: 'noul', instructions: 'Is it urgent?' },
};

function okResult(state: unknown): DecisionToolResult {
  const text = typeof state === 'string' ? state : JSON.stringify(state);
  const billing = text.includes('charge') ? 0.91234 : 0.05;
  return {
    ok: true,
    model: 'jev-1.13.0',
    answers: {
      topic: { type: 'choice', choice: billing > 0.5 ? 'billing' : 'shipping', confidence: 0.87654, probabilities: { billing, shipping: 1 - billing - 0.01, other: 0.01 } },
      urgent: { type: 'noul', noul: 0.33333 },
    },
    usage: { inputTokens: 100, outputTokens: 10 },
    latencyMs: 120,
    truncated: false,
  };
}

function createCtx(impl?: (request: DecisionToolRequest) => Promise<DecisionToolResult>): { ctx: SessionToolContext; requests: DecisionToolRequest[] } {
  const requests: DecisionToolRequest[] = [];
  const decide: DecisionToolCallbacks = {
    decide: async (request) => {
      requests.push(request);
      return impl ? impl(request) : okResult(request.state);
    },
  };
  return { ctx: { decide } as unknown as SessionToolContext, requests };
}

// U-API: the product denies all decision invocations before validation or callbacks.
describe('decide handler', () => {
  it('rejects single, batch and malformed requests without invoking a configured model', async () => {
    const { ctx, requests } = createCtx();
    for (const args of [
      { state: 'charge', questions: QUESTIONS },
      { items: ['a', 'b'], questions: QUESTIONS },
      { state: 'x', items: ['y'], questions: QUESTIONS },
      { questions: {} },
    ]) {
      for (const context of [ctx, {} as SessionToolContext]) {
        const result = await handleDecide(context, args as never);
        expect(result.isError).toBe(true);
        expect(result.content[0]!.text).toContain('U Agents 不支持独立决策模型');
      }
    }
    expect(requests).toHaveLength(0);
  });

  it('compacts answers and drops the legend', () => {
    const compact = compactDecisionAnswers({
      sev: { type: 'score', score: 1.23456, confidence: 0.5, probabilities: { '0': 0.11111, '1': 0.88889 }, legend: { '0': 'a', '1': 'b' } },
    });
    expect(compact.sev).toEqual({ type: 'score', score: 1.235, confidence: 0.5, probabilities: { '0': 0.111, '1': 0.889 } });
    expect(formatDecisionError({ kind: 'timeout', message: 'x' })).toContain('deadlineMs');
  });
});
