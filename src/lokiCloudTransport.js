import Transport from 'winston-transport';

import { logCacheEmitter } from './logCache.js';

/**
 * Connects with Grafana Loki in the Cloud
 */

class LokiCloudTransport extends Transport {
  /**
   * @param {Object} opts options
   * @param {String} opts.username Grafana Username
   * @param {String} opts.apiKey Grafana apiKey
   * @param {number} opts.logCacheLimit The number of logs the cache holds. Default of 10
   */
  constructor (opts) {
    super(opts);
    this.username = opts.username;
    this.apiKey = opts.apiKey;
    this.logCacheLimit = opts.logCacheLimit;
  }

  log (info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    const { service, level, timestamp, label } = info;
    const logLine = info[Symbol.for('message')] || JSON.stringify(info);

    const url = 'https://logs-prod3.grafana.net/loki/api/v1/push';

    logCacheEmitter.emit('instantiate', {
      url, username: this.username, password: this.apiKey, logCacheLimit: this.logCacheLimit,
    });

    const tsUnixNs = new Date(timestamp).getTime() * 1000000;

    const body = {
      stream: {
        service,
        level,
        label,
      },
      values: [
        [`${tsUnixNs}`, logLine],
      ],
    };

    logCacheEmitter.emit('log', body);

    callback();
  }
}

export default LokiCloudTransport;
