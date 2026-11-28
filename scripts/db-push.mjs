#!/usr/bin/env node
// Brings a backend up to the migrations and edge functions in this repo.
//
//   node scripts/db-push.mjs local     new migrations into the running stack (keeps data)
//   node scripts/db-push.mjs staging   migrations + edge functions to staging
//   node scripts/db-push.mjs prod      the same to production, after staging, with a typed confirm
//   add --seed                         also run supabase/seed.sql (staging only; local gets it on db:reset)
//
// Hosted pushes need no database password: the CLI logs in with a temporary
// role through your `supabase login`. Each push links the CLI to that project
// first, so a leftover link can never send a migration to the wrong place.

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = JSON.parse(fs.readFileSync(path.join(root, 'supabase/targets.json'), 'utf8'));
const name = process.argv[2];
const seed = process.argv.includes('--seed');

const run = (cmd, opts = {}) => execSync(cmd, { cwd: root, stdio: 'inherit', ...opts });

if (name === 'local') {
  run('npx supabase migration up --local');
  console.log('\nLocal stack is up to date. Changed edge functions: `npm run db:stop && npm run db:start`.');
  process.exit(0);
}

const t = targets[name];
if (!t?.ref) {
  console.error('Usage: node scripts/db-push.mjs <local|staging|prod> [--seed]');
  process.exit(1);
}
if (seed && name === 'prod') {
  console.error('Never seed production: seed.sql holds test users and test events.');
  process.exit(1);
}

run(`npx supabase link --project-ref ${t.ref}`, { stdio: ['ignore', 'inherit', 'inherit'] });
console.log(`\nWhat would change on ${name} (${t.label}):`);
run('npx supabase db push --dry-run', { stdio: ['ignore', 'inherit', 'inherit'] });

if (name === 'prod') {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('\nThis goes to PRODUCTION. Was it pushed to staging and tried there? Type "prod" to continue: ');
  rl.close();
  if (answer.trim() !== 'prod') {
    console.log('Stopped. Nothing was changed.');
    process.exit(1);
  }
}

run(`npx supabase db push --yes${seed ? ' --include-seed' : ''}`, { stdio: ['ignore', 'inherit', 'inherit'] });
run(`npx supabase functions deploy --project-ref ${t.ref} --use-api`, { stdio: ['ignore', 'inherit', 'inherit'] });
console.log(`\n${name} is up to date with this branch's migrations and edge functions.`);
