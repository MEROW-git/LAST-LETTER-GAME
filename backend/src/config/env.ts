import fs from 'fs';
import path from 'path';

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const fileContents = fs.readFileSync(filePath, 'utf8');
  const parsed: Record<string, string> = {};

  for (const rawLine of fileContents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    value = value.replace(/\\n/g, '\n');
    parsed[key] = value;
  }

  return parsed;
}

function loadBackendEnv() {
  const backendRoot = path.resolve(__dirname, '..', '..');
  const originalEnvKeys = new Set(Object.keys(process.env));
  const envFiles = [
    path.join(backendRoot, '.env'),
    path.join(backendRoot, '.env.local'),
  ];

  for (const envFile of envFiles) {
    const values = parseEnvFile(envFile);

    for (const [key, value] of Object.entries(values)) {
      if (!originalEnvKeys.has(key)) {
        process.env[key] = value;
      }
    }
  }
}

loadBackendEnv();

function parsePort(rawPort: string | undefined, fallback: number): number {
  const parsedPort = Number(rawPort);
  return Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : fallback;
}

function parseCorsOrigins(rawOrigins: string | undefined): string[] {
  if (!rawOrigins) {
    return ['http://localhost:3000'];
  }

  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parsePort(process.env.PORT, 3001),
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
};
