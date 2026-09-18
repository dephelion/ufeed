import { describe, expect, it } from 'vitest';
import { isEngineReply, isEngineRequest, nextRequestId } from './protocol';

describe('isEngineRequest', () => {
  it('accepts a score request', () => {
    expect(isEngineRequest({ id: 'r1', type: 'SCORE', texts: ['a'] })).toBe(true);
  });

  it('accepts a topics request', () => {
    expect(isEngineRequest({ id: 'r1', type: 'SET_TOPICS', topics: ['ai'] })).toBe(true);
  });

  it('rejects a request with no id, which could never be correlated', () => {
    expect(isEngineRequest({ type: 'SCORE', texts: ['a'] })).toBe(false);
  });

  it('rejects non-string payloads rather than passing them to the model', () => {
    expect(isEngineRequest({ id: 'r1', type: 'SCORE', texts: [1, 2] })).toBe(false);
  });

  it.each([null, undefined, 'SCORE', 42, {}])('rejects %s', (value) => {
    expect(isEngineRequest(value)).toBe(false);
  });

  it('rejects messages the host page might post', () => {
    expect(isEngineRequest({ id: 'x', type: 'webpackHotUpdate' })).toBe(false);
  });
});

describe('isEngineReply', () => {
  it('accepts scores with the line each came from', () => {
    expect(isEngineReply({ id: 'r1', type: 'SCORES', scores: [0.1], topics: [0] })).toBe(
      true,
    );
  });

  it('rejects scores that are not numbers', () => {
    expect(
      isEngineReply({ id: 'r1', type: 'SCORES', scores: ['0.1'], topics: [0] }),
    ).toBe(false);
  });

  it('rejects scores whose lines do not line up with them', () => {
    expect(
      isEngineReply({ id: 'r1', type: 'SCORES', scores: [0.1, 0.2], topics: [0] }),
    ).toBe(false);
  });

  it('accepts a status event, which carries no id', () => {
    expect(isEngineReply({ type: 'STATUS', state: 'ready' })).toBe(true);
  });

  it('accepts an error reply', () => {
    expect(isEngineReply({ id: 'r1', type: 'ERROR', message: 'boom' })).toBe(true);
  });

  it('rejects an unknown type', () => {
    expect(isEngineReply({ id: 'r1', type: 'SOMETHING' })).toBe(false);
  });
});

describe('nextRequestId', () => {
  it('never repeats, so concurrent batches cannot be confused', () => {
    const ids = new Set(Array.from({ length: 500 }, nextRequestId));
    expect(ids.size).toBe(500);
  });
});

describe('feedback messages', () => {
  it('accepts a correction', () => {
    expect(isEngineRequest({ id: 'r1', type: 'FEEDBACK', text: 'a', liked: true })).toBe(
      true,
    );
  });

  it('rejects one without a verdict, which would be stored as a guess', () => {
    expect(isEngineRequest({ id: 'r1', type: 'FEEDBACK', text: 'a' })).toBe(false);
  });

  it('accepts topics carrying their corrections', () => {
    expect(
      isEngineRequest({
        id: 'r1',
        type: 'SET_TOPICS',
        topics: ['software'],
        corrections: [{ liked: [[0.1, 0.2]], disliked: [] }],
      }),
    ).toBe(true);
  });

  it('accepts topics with no corrections at all', () => {
    expect(isEngineRequest({ id: 'r1', type: 'SET_TOPICS', topics: ['software'] })).toBe(
      true,
    );
  });

  it('rejects corrections that are not vectors', () => {
    expect(
      isEngineRequest({
        id: 'r1',
        type: 'SET_TOPICS',
        topics: [],
        corrections: [{ liked: ['nope'], disliked: [] }],
      }),
    ).toBe(false);
  });

  it('rejects a correction missing a side, which would read as undefined', () => {
    expect(
      isEngineRequest({
        id: 'r1',
        type: 'SET_TOPICS',
        topics: [],
        corrections: [{ liked: [] }],
      }),
    ).toBe(false);
  });

  it('accepts a returned vector with the line it belongs to', () => {
    expect(
      isEngineReply({ id: 'r1', type: 'VECTOR', vector: [0.1, 0.2], topic: 0 }),
    ).toBe(true);
  });

  it('rejects a vector with no line, which could not be filed', () => {
    expect(isEngineReply({ id: 'r1', type: 'VECTOR', vector: [0.1] })).toBe(false);
  });

  it('rejects a vector with non-numbers, which would poison the query', () => {
    expect(
      isEngineReply({ id: 'r1', type: 'VECTOR', vector: [0.1, null], topic: 0 }),
    ).toBe(false);
  });
});
