/**
 * Type definitions for @sndwrks/lumberjack
 * A winston-based logger with console, file, and Loki transport support
 */

declare module '@sndwrks/lumberjack' {
  import { Logger as WinstonLogger } from 'winston';

  /**
   * Console output format types
   */
  export type ConsoleType = 'pretty' | 'gcp' | 'string';

  /**
   * Winston log levels
   */
  export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';

  /**
   * Console logging configuration
   */
  export interface ConsoleConfig {
    /**
     * Enable console logging
     * @default true
     */
    enabled?: boolean;
    
    /**
     * Console output format
     * - 'pretty': Colorful, formatted output for development (uses chalk)
     * - 'gcp': Google Cloud Platform log format (compatible with GCP logging)
     * - 'string': Single-line JSON string for generic production use
     * @default 'string'
     */
    type?: ConsoleType;
  }

  /**
   * Loki transport configuration for Grafana Cloud
   */
  export interface LokiConfig {
    /**
     * Enable sending logs to Loki
     * @default false
     */
    sendLogs?: boolean;
    
    /**
     * Grafana Cloud Loki host URL
     * Required if sendLogs is true
     */
    host?: string;
    
    /**
     * Grafana Cloud username
     * Required if sendLogs is true
     */
    username?: string;
    
    /**
     * Grafana Cloud API key
     * Required if sendLogs is true
     */
    apiKey?: string;
    
    /**
     * Number of log messages to cache before sending to Loki
     * Must be a positive number
     * @default 10
     */
    logCacheLimit?: number;
  }

  /**
   * Main logger configuration options
   * Call this before beginLogging() to set global defaults
   */
  export interface LoggerConfig {
    /**
     * Console logging configuration
     */
    logToConsole?: ConsoleConfig;
    
    /**
     * Enable file system logging with daily rotation
     * Creates rotating log files in ./logs/ directory:
     * - log-YYYY-MM-DD-HH.log (rotates hourly, keeps 7 days, max 10MB per file)
     * @default false
     */
    logToFiles?: boolean;
    
    /**
     * Loki transport configuration for Grafana Cloud
     */
    lokiConfig?: LokiConfig;
    
    /**
     * Minimum log level to record
     * @default 'silly'
     */
    logLevel?: LogLevel;
    
    /**
     * Service name to include in log metadata
     * Used for querying in Loki and as defaultMeta service name
     * @default 'my-saucy-logger'
     */
    service?: string;
  }

  /**
   * Logger instance creation options
   * These options can override global configuration for a specific logger instance
   */
  export interface BeginLoggingOptions {
    /**
     * Name identifier for the logger instance
     * Typically the filename or module name
     * Used as the label in log entries
     */
    name: string;
    
    /**
     * Override global console configuration for this logger
     */
    logToConsole?: ConsoleConfig;
    
    /**
     * Override global log level for this logger
     */
    logLevel?: LogLevel;
    
    /**
     * Override global file logging setting for this logger
     */
    logToFiles?: boolean;
  }

  /**
   * Logger instance - a winston Logger with all standard log methods
   * Supports format strings with %s, %d, %j, %o, %O style interpolation
   */
  export type Logger = WinstonLogger;

  /**
   * Global environment configuration state
   * Frozen after first call to configureLogger()
   */
  export const globalEnv: Readonly<{
    logLevel: LogLevel | null;
    logToConsole: ConsoleConfig | false;
    lokiConfig: LokiConfig | null;
    service: string | null;
    logToFiles: boolean;
  }>;

  /**
   * Pretty format for console output with colors
   * Uses chalk for colorization
   */
  export const hawtFormat: any;

  /**
   * Google Cloud Platform format for console output
   * Compatible with GCP logging standards
   * @see https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry
   */
  export const gcpFormat: any;

  /**
   * Configure the logger globally
   * Must be called before beginLogging() for best results
   * Configuration is frozen after first call - subsequent calls will log an error
   * 
   * Note: If lokiConfig.apiKey, host, or username are missing, Loki transport is disabled
   * Note: If logCacheLimit is not a positive number, it defaults to 10
   * 
   * @param config - Logger configuration options
   * 
   * @example
   * ```typescript
   * import { configureLogger } from '@sndwrks/lumberjack';
   * 
   * configureLogger({
   *   logToConsole: {
   *     enabled: true,
   *     type: 'pretty',
   *   },
   *   logToFiles: true,
   *   lokiConfig: {
   *     sendLogs: true,
   *     host: process.env.LOKI_HOST,
   *     username: process.env.LOKI_USERNAME,
   *     apiKey: process.env.LOKI_API_KEY,
   *     logCacheLimit: 10,
   *   },
   *   logLevel: 'silly',
   *   service: 'lumberjack-dev-test',
   * });
   * ```
   */
  export function configureLogger(config: LoggerConfig): void;

  /**
   * Create and return a logger instance
   * Should be called after configureLogger() for proper configuration
   * If called without prior configuration, uses defaults and logs a warning
   * 
   * @param options - Options for the logger instance
   * @returns A winston Logger instance with all log level methods
   * 
   * @example
   * ```typescript
   * import { beginLogging } from '@sndwrks/lumberjack';
   * 
   * const logger = beginLogging({ name: 'myImportantFile.js' });
   * 
   * logger.error('Something went wrong', { errorCode: 500 });
   * logger.warn('This is a warning');
   * logger.info('Server started on port 3000');
   * logger.http('GET /api/users 200');
   * logger.verbose('Detailed operation info');
   * logger.debug('Debug information', { userId: 123 });
   * logger.silly('Everything including kitchen sink');
   * ```
   */
  export function beginLogging(options: BeginLoggingOptions): Logger;
}