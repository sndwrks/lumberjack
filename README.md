# lumberjack

It logs.

You can configure lumberjack to log to the console (multiple formats), files, and Loki. It uses winston for logging and axios for http transport.

This package has a custom Loki integration to specifically integrate with the Grafana Cloud API ([winston-loki](https://github.com/JaniAnttonen/winston-loki) has problems with authenticating to Grafana Cloud). The Loki integration also includes a cache that holds messages and sends them in groups to the Grafana endpoint. Being a cloud native, I haven't checked this against a local Loki instance 😭.

## usage

### installation

```sh
npm i @sndwrks/lumberjack
```

### configuration

The logger can be configured only once. Once `configureLogger()` is called the subsequent configuration object is frozen. Additionally, `configureLogger()` should be called before you call `beginLogging()` to return a logger instance.

Configuration is passed as an object to `configureLogger()`. None of the parameters are explicitly required, but you should specify at least one option as true. If you don't specify at least one [winston](https://github.com/winstonjs/winston) will store the logs in memory which may not be what you wanted.

If `lokiConfig.apiKey`, `lokiConfig.host`, or `lokiConfig.username` are not included, Loki Transport is turned off.

There are a few formats for the console logging: pretty, google cloud (`gcp`), or string. `pretty` is all fancy-like most useful for development, but terrible in production. `gcp` uses the [google cloud log format](https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry). `string` is a single line json string for more generic production use if you logging to the console. 

#### parameters
| name                       | type    | required | description                                        |
| -------------------------- | ------- | -------- | -------------------------------------------------- |
| `logToConsole`             | Object  | No       | Console configuration object                       |
| `logToConsole.enable       | Boolean | No       | Should lumberjack log to the console?              |
| `logToConsole.type         | Enum    | No       | What format should log to the console? `'pretty', 'gcp', 'string'`|
| `logToFiles`               | Boolean | No       | Should lumberjack log to the file system? It logs to two files any error messages to `./error.log` and any other messages (less sever than error) to `./combined.log`. |
| `logLevel`                 | Enum    | No       | `'error','warn', 'info', 'http', 'verbose', 'debug', 'silly'` The default is `silly`|
| `service`                  | String  | No       | The name of the service to include this is included in the metadata that is sent to Loki so it is queryable. Default is `my-saucy-logger`  |
| -------------------------- | ------- | -------- | -------------------------------------------------- |
| `lokiConfig`               | Object  | No       | Configuration for Loki.                            |
| `lokiConfig.apiKey`        | String  | Yes      | The API you receive from Grafana.                  |
| `lokiConfig.host`          | String  | Yes      | The URL of the host lumberjack should send the logs to. |
| `lokiConfig.username`      | String  | Yes      | The username to receive from Grafana.              |
| `lokiConfig.sendLogs`      | Boolean | No       | Should the transport send logs to Loki? Default is `false` |
| `lokiConfig.logCacheLimit` | Number  | No       | Sets how many logs are stored before the transport sends them. Default is `10` |

#### example

**Logger Configuration**

```js
import { configureLogger } from '@sndwrks/lumberjack';

// full configuration or "whole hog" as they say in the biz
configureLogger({
  logToConsole: {
    enabled: true,
    type: 'pretty', // <pretty | gcp | string>
  },
  logToFiles: true,
  lokiConfig: {
    sendLogs: true,
    host: process.env.LOKI_HOST,
    username: process.env.LOKI_USERNAME,
    apiKey: process.env.LOKI_API_KEY,
    logCacheLimit: 10,
  },
  logLevel: 'silly',
  service: 'lumberjack-dev-test',
});
```

**Logging**

```js
import { beginLogging } from '@sndwrks/lumberjack';

const logger = beginLogging({ name: 'myImportantFile.js' });

logger.error();
logger.warn();
logger.info();
logger.http();
logger.verbose();
logger.debug();
logger.silly();
```

## contributing

If you like this and want to contribute, well sweet. Just slap up a pr.

### to-do & desires

 - Moar Tests
 - Handle shutdown in some fashion
 - More formats