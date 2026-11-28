#!/usr/bin/env node
// Switches which Supabase backend the app (mobile/.env) and the website's web
// camera (web/.env) talk to:
//
//   node scripts/target.mjs local     the Docker stack on this PC (LAN IP found here)
//   node scripts/target.mjs staging   the hosted test project
//   node scripts/target.mjs prod      production — real users
//   node scripts/target.mjs           print the current one
//
// Only the two Supabase lines are rewritten; everything else in the .env files
// stays. Restart Expo with `npx expo start --clear` afterwards: EXPO_PUBLIC_*
// is baked in at bundle time. Migrations are a separate step (scripts/db-push.mjs).

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = JSON.parse(fs.readFileSync(path.join(root, 'supabase/targets.json'), 'utf8'));

const FILES = [
  {
    file: path.join(root, 'mobile/.env'),
    example: path.join(root, 'mobile/.env.example'),
    url: 'EXPO_PUBLIC_SUPABASE_URL',
    key: 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  },
  {
    file: path.join(root, 'web/.env'),
    example: path.join(root, 'web/.env.example'),
    url: 'PUBLIC_SUPABASE_URL',
    key: 'PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  },
];

function lanIp() {
  const skip = /vethernet|wsl|docker|virtualbox|vmware|hyper-v|loopback|tailscale|zerotier/i;
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (skip.test(name)) continue;
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) return a.address;
    }
  }
  return '127.0.0.1';
}

function localTarget() {
  let out;
  try {
    out = execSync('npx supabase status -o env', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch {
    console.error('The local stack is not running. Start Docker Desktop, then `npm run db:start`.');
    process.exit(1);
  }
  const read = (k) => out.match(new RegExp(`^${k}="?([^"\\n]+)"?`, 'm'))?.[1];
  const key = read('PUBLISHABLE_KEY') ?? read('ANON_KEY');
  const port = (read('API_URL') ?? 'http://127.0.0.1:54321').split(':').pop();
  return { label: targets.local.label, url: `http://${lanIp()}:${port}`, key };
}

function current() {
  const env = fs.existsSync(FILES[0].file) ? fs.readFileSync(FILES[0].file, 'utf8') : '';
  const url = env.match(/^EXPO_PUBLIC_SUPABASE_URL=(.*)$/m)?.[1]?.trim();
  if (!url) return 'none';
  for (const [name, t] of Object.entries(targets)) if (t.url && t.url === url) return name;
  return /:54321$/.test(url) ? 'local' : `unknown (${url})`;
}

function setLines(text, pairs) {
  let out = text;
  for (const [k, v] of pairs) {
    const line = `${k}=${v}`;
    const re = new RegExp(`^${k}=.*$`, 'm');
    out = re.test(out) ? out.replace(re, line) : `${line}\n${out}`;
  }
  return out;
}

const name = process.argv[2];
if (!name) {
  console.log(`Current backend: ${current()}`);
  process.exit(0);
}
if (!(name in targets) || name.startsWith('_')) {
  console.error(`Unknown target "${name}". Use one of: local, staging, prod.`);
  process.exit(1);
}

const t = name === 'local' ? localTarget() : targets[name];
for (const f of FILES) {
  const base = fs.existsSync(f.file) ? fs.readFileSync(f.file, 'utf8') : fs.readFileSync(f.example, 'utf8');
  fs.writeFileSync(f.file, setLines(base, [[f.url, t.url], [f.key, t.key]]));
}

console.log(`Backend is now ${name} — ${t.label}\n  ${t.url}`);
if (name === 'prod') console.log('  Careful: everything you do now lands next to real users.');
console.log('Restart Expo with `npx expo start --clear` (the values are baked into the bundle).');
