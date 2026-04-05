/* eslint-disable no-undef */
import { logCacheEmitter } from './logCache.js';
import LokiCloudTransport from './lokiCloudTransport.js';

const MESSAGE = Symbol.for('message');

const transport = new LokiCloudTransport({
  username: 'testuser',
  apiKey: 'testapikey',
  logCacheLimit: 100,
});

let capturedBody = null;

function onLog (body) {
  capturedBody = body;
}

beforeEach(() => {
  capturedBody = null;
  logCacheEmitter.on('log', onLog);
});

afterEach(() => {
  logCacheEmitter.removeListener('log', onLog);
});

function makeInfo (overrides) {
  const info = {
    level: 'info',
    message: 'test',
    service: 'test-svc',
    label: 'test-label',
    timestamp: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
  info[MESSAGE] = JSON.stringify(info);
  return info;
}

test('string message produces valid JSON log line', (done) => {
  const info = makeInfo({ message: 'hello world' });

  transport.log(info, () => {
    const [, logLine] = capturedBody.values[0];
    expect(() => JSON.parse(logLine)).not.toThrow();

    const parsed = JSON.parse(logLine);
    expect(parsed.message).toBe('hello world');
    expect(parsed.level).toBe('info');
    done();
  });
});

test('object message produces valid JSON log line', (done) => {
  const info = makeInfo({ message: { foo: 'bar', nested: { a: 1 } } });

  transport.log(info, () => {
    const [, logLine] = capturedBody.values[0];
    expect(() => JSON.parse(logLine)).not.toThrow();

    const parsed = JSON.parse(logLine);
    expect(parsed.message).toEqual({ foo: 'bar', nested: { a: 1 } });
    done();
  });
});

test('metadata fields are included in log line', (done) => {
  const info = makeInfo({ requestId: '12345', duration: 250 });

  transport.log(info, () => {
    const parsed = JSON.parse(capturedBody.values[0][1]);
    expect(parsed.requestId).toBe('12345');
    expect(parsed.duration).toBe(250);
    done();
  });
});

test('values array has correct [[timestamp, jsonString]] structure', (done) => {
  const info = makeInfo();

  transport.log(info, () => {
    expect(Array.isArray(capturedBody.values)).toBe(true);
    expect(capturedBody.values).toHaveLength(1);
    expect(capturedBody.values[0]).toHaveLength(2);

    const [tsStr, logLine] = capturedBody.values[0];
    expect(typeof tsStr).toBe('string');
    expect(typeof logLine).toBe('string');

    const expectedNs = new Date('2024-01-01T00:00:00.000Z').getTime() * 1000000;
    expect(tsStr).toBe(`${expectedNs}`);
    done();
  });
});

test('stream contains service, level, and label', (done) => {
  const info = makeInfo({ service: 'my-svc', level: 'error', label: 'router.ts' });

  transport.log(info, () => {
    expect(capturedBody.stream).toEqual({
      service: 'my-svc',
      level: 'error',
      label: 'router.ts',
    });
    done();
  });
});
