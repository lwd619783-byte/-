// Byte transport is Python's bounded official-only urllib client. Parsing remains
// the same inert, offline parser as retained artifact replay; no parallel parser.
import { readFileSync } from 'node:fs';
import { parseNbsProduction } from './nbs-parser.mjs';
const html = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(0));
const period = process.argv[2];
console.log(JSON.stringify({
  absolute: parseNbsProduction(html, period, 'output'),
  officialYoY: parseNbsProduction(html, period, 'official_yoy'),
}));
