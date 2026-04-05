/* eslint-disable no-undef */
import { jest } from '@jest/globals';
import { createReadStream } from 'node:fs';
import * as readline from 'node:readline/promises';
import { globSync } from 'glob';

import { configureLogger, beginLogging, globalEnv } from './logger.js';
import { logCacheEmitter } from './logCache.js';

// --- helpers ---

function getLogFilePath () {
  const [logPath] = globSync(['./logs/*.log']);
  return new URL(`../${logPath}`, import.meta.url);
}

async function readLines (filePath) {
  const lines = [];
  const rl = readline.createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    lines.push(line);
  }
  return lines;
}

// --- config ---

const config = {
  logToConsole: { enabled: true, type: 'string' },
  logLevel: 'silly',
  service: 'integration-test',
  logToFiles: true,
  lokiConfig: {
    host: 'http://localhost:9999',
    sendLogs: true,
    username: 'testuser',
    apiKey: 'testapikey',
    logCacheLimit: 100, // high limit so cache doesn't try to POST
  },
};

let logger;

beforeAll(async () => {
  configureLogger(config);
  logger = beginLogging({ name: 'integration' });

  // log a few messages so file transport has content
  logger.error('int-error');
  logger.warn('int-warn');
  logger.info('int-info');
  logger.debug('int-debug');

  // give winston time to flush to disk
  return new Promise((resolve) => { setTimeout(resolve, 2000); });
});

// --- tests ---

test('configureLogger freezes globalEnv', () => {
  expect(Object.isFrozen(globalEnv)).toBe(true);
  expect(globalEnv.logLevel).toBe('silly');
  expect(globalEnv.service).toBe('integration-test');
  expect(globalEnv.logToFiles).toBe(true);
  expect(globalEnv.lokiConfig.sendLogs).toBe(true);
  expect(globalEnv.lokiConfig.logCacheLimit).toBe(100);
});

test('configureLogger rejects a second call', () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

  configureLogger({
    logToConsole: { enabled: false, type: 'gcp' },
    logLevel: 'error',
    service: 'should-not-change',
    logToFiles: false,
    lokiConfig: { sendLogs: false },
  });

  expect(spy).toHaveBeenCalled();
  expect(globalEnv.service).toBe('integration-test');

  spy.mockRestore();
});

test('beginLogging returns a logger with all three transports', () => {
  const transportTypes = logger.transports.map((t) => t.constructor.name);

  expect(transportTypes).toContain('Console');
  expect(transportTypes).toContain('DailyRotateFile');
  expect(transportTypes).toContain('LokiCloudTransport');
});

test('logger has all log level methods', () => {
  const levels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];

  levels.forEach((lvl) => {
    expect(typeof logger[lvl]).toBe('function');
  });
});

test('log messages reach the file transport as valid JSON', async () => {
  const lines = await readLines(getLogFilePath());

  expect(lines.length).toBeGreaterThanOrEqual(4);

  // filter to only lines from this test suite (log files are shared across test runs)
  const ours = lines
    .map((l) => JSON.parse(l))
    .filter((p) => p.service === 'integration-test');

  expect(ours.length).toBeGreaterThanOrEqual(4);

  ours.forEach((parsed) => {
    expect(parsed).toHaveProperty('level');
    expect(parsed).toHaveProperty('message');
    expect(parsed).toHaveProperty('service', 'integration-test');
  });
});

test('log messages reach Loki transport with correct shape', async () => {
  const captured = [];
  function onLog (body) { captured.push(body); }
  logCacheEmitter.on('log', onLog);

  logger.error('loki-1');
  logger.warn('loki-2');
  logger.info('loki-3');

  // give transport a tick to emit
  await new Promise((resolve) => { setTimeout(resolve, 200); });

  logCacheEmitter.removeListener('log', onLog);

  expect(captured.length).toBe(3);

  captured.forEach((entry) => {
    expect(entry).toHaveProperty('stream');
    expect(entry.stream).toHaveProperty('service', 'integration-test');
    expect(entry.stream).toHaveProperty('level');
    expect(entry.stream).toHaveProperty('label', 'integration');

    expect(entry).toHaveProperty('values');
    expect(entry.values).toHaveLength(1);
    const [tsNs, logLine] = entry.values[0];
    expect(typeof tsNs).toBe('string');
    expect(Number(tsNs)).toBeGreaterThan(0);
    expect(() => JSON.parse(logLine)).not.toThrow();
  });
});

test('log level filtering works', async () => {
  const captured = [];
  function onLog (body) { captured.push(body); }
  logCacheEmitter.on('log', onLog);

  // create a logger that only logs warn and above
  const warnLogger = beginLogging({ name: 'warn-only', logLevel: 'warn' });

  warnLogger.info('should-be-filtered');
  warnLogger.error('should-appear');

  // give transports a tick to emit
  await new Promise((resolve) => { setTimeout(resolve, 200); });

  logCacheEmitter.removeListener('log', onLog);

  const messages = captured.map((c) => JSON.parse(c.values[0][1]).message);
  expect(messages).not.toContain('should-be-filtered');
  expect(messages).toContain('should-appear');
});

test('beginLogging can override console type', () => {
  const gcpLogger = beginLogging({ name: 'gcp-test', logToConsole: { type: 'gcp' } });

  const consoleTransport = gcpLogger.transports.find((t) => t.constructor.name === 'Console');
  expect(consoleTransport).toBeDefined();
});

test('string, object, and error messages all produce valid Loki output', async () => {
  const captured = [];
  function onLog (body) { captured.push(body); }
  logCacheEmitter.on('log', onLog);

  logger.error('plain string message');
  logger.error('with metadata', { requestId: 'abc-123' });
  logger.error('error happened', new Error('test-error'));

  await new Promise((resolve) => { setTimeout(resolve, 200); });

  logCacheEmitter.removeListener('log', onLog);

  expect(captured.length).toBe(3);

  captured.forEach((entry) => {
    const [tsNs, logLine] = entry.values[0];
    expect(typeof tsNs).toBe('string');
    expect(Number(tsNs)).toBeGreaterThan(0);
    expect(() => JSON.parse(logLine)).not.toThrow();
  });

  // verify string message
  const stringMsg = JSON.parse(captured[0].values[0][1]);
  expect(stringMsg.message).toBe('plain string message');

  // verify metadata message
  const metaMsg = JSON.parse(captured[1].values[0][1]);
  expect(metaMsg.message).toBe('with metadata');
  expect(metaMsg.requestId).toBe('abc-123');

  // verify error message
  const errMsg = JSON.parse(captured[2].values[0][1]);
  expect(errMsg.message).toContain('error happened');
});
