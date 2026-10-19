'use strict';
// Pure log analysis for the server smoke: no I/O, no process handling.
// Groups ERROR/FATAL lines and exception lines by a normalized signature and
// separates known boot noise (known_noise.json) from new findings.

const DONE_RE = /Done \(([\d.]+)s\)!/;
const LEVEL_RE = /^\[[^\]]*\] \[[^\]]*\/(ERROR|FATAL)\]/;
const EXCEPTION_RE = /^(?:Caused by: )?[\w.$]+(?:Exception|Error)\b/;
const LOADING_FAILED_RE = /Mod loading has failed|Failed to load mod|LoadingFailedException|ModLoadingException|Missing or unsupported mandatory dependencies|Mod File .* needs to be/i;

function normalize(line) {
  return line
    .replace(/^\[[^\]]*\] \[[^\]/]*\//, '[')               // drop timestamp and thread name
    .replace(/#?\b[a-z0-9_.-]+:[a-z0-9_/.-]+/gi, '<id>')   // namespaced ids: tags, recipes, paths
    .replace(/0x[0-9a-f]+/gi, '0x#')
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27}\b/gi, '<uuid>')
    .replace(/\d+(\.\d+)?/g, '#')
    .trim()
    .slice(0, 240);
}

function analyze(logText, knownNoise) {
  const lines = logText.split(/\r?\n/);
  const done = lines.map((l) => DONE_RE.exec(l)).find(Boolean);
  const groups = new Map();
  let loadingFailed = false;
  for (const line of lines) {
    if (LOADING_FAILED_RE.test(line)) loadingFailed = true;
    const isErr = LEVEL_RE.test(line);
    const isExc = !isErr && EXCEPTION_RE.test(line);
    if (!isErr && !isExc) continue;
    const key = normalize(line);
    const g = groups.get(key) || { signature: key, sample: line.slice(0, 400), count: 0 };
    g.count += 1;
    groups.set(key, g);
  }
  const known = [];
  const fresh = [];
  for (const g of groups.values()) {
    const rule = knownNoise.find((n) => new RegExp(n.pattern, 'i').test(g.sample));
    if (rule) known.push({ ...g, why: rule.why });
    else fresh.push(g);
  }
  const byCount = (a, b) => b.count - a.count;
  known.sort(byCount);
  fresh.sort(byCount);
  return { doneSeconds: done ? Number(done[1]) : null, loadingFailed, known, fresh };
}

module.exports = { analyze, normalize, DONE_RE };
