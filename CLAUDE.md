# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

@sndwrks/lumberjack — A Winston-based logger with Grafana Cloud Loki integration. Pure JavaScript (ESM) with TypeScript type definitions.

## Commands

- **Test:** `npm run test` (Jest with `--experimental-vm-modules` for ESM support)
- **Single test:** `node --experimental-vm-modules node_modules/.bin/jest src/logger.test.js`
- **Dev:** `npm run dev` (runs `dev.js` with nodemon)
- **Lint:** `npx eslint .` (airbnb-base config)

## Architecture

The library exports two public functions from `index.js`: `configureLogger` and `beginLogging`.

### Flow

1. **`configureLogger(config)`** (`src/logger.js`) — Called once to set global frozen state (`globalEnv`). Configures log level, console format, file logging, and Loki credentials. Subsequent calls are rejected.
2. **`beginLogging(options)`** (`src/logger.js`) — Creates Winston logger instances with the configured transports (console, file, Loki). Returns a Winston logger.

### Key Modules

- **`src/logger.js`** — Core module. Builds Winston transports, defines console format functions (`hawtFormat` for pretty/colorized, `gcpFormat` for GCP-structured, string format for single-line JSON). Manages the singleton `globalEnv` config object.
- **`src/lokiCloudTransport.js`** — Custom Winston transport (extends `winston-transport`). Formats log entries into Loki's push API shape and emits them to the log cache.
- **`src/logCache.js`** — EventEmitter-based batch cache. Accumulates logs up to a configurable limit, then sends the batch to Loki via axios. Includes retry logic on failure.

### Design Patterns

- **Singleton config:** `globalEnv` is frozen after first `configureLogger()` call — it cannot be reconfigured.
- **ESM throughout:** All files use `import`/`export`. The `"type": "module"` field is set in package.json.
- **Three console formats:** `pretty` (chalk-colorized), `gcp` (Google Cloud Logging structure), `string` (single-line JSON).

## Types

TypeScript declarations live in `types.d.ts` at the project root. This is not a TypeScript project — types are hand-maintained for consumers.

## CI

GitHub Actions (`.github/workflows/unit-test.yaml`) runs `npm run test` on push and PR.
