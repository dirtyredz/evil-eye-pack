'use strict';
// Loader-base installation with checksum verification and the runtime stamps that stop cross-runtime reuse.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const rt = require('../../runtime_env/server/runtime.cjs');
const { ensureLoaderBase } = require('../loader_base.cjs');
const { prepareRunDir } = require('../run_dir.cjs');

const tmp = (t) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'loader-base-')); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; };

function fakeInstall(neo) {
  return { run: async (java, args) => {
    const base = args[args.indexOf('--installServer') + 1];
    fs.mkdirSync(path.join(base, path.dirname(neo.argsFile)), { recursive: true });
    fs.writeFileSync(path.join(base, neo.argsFile), 'args');
    fs.mkdirSync(path.join(base, 'libraries/x'), { recursive: true });
    return { code: 0, out: 'installed' };
  } };
}
const http = (routes) => async (url) => (routes[url] ? { ok: true, arrayBuffer: async () => Buffer.from(routes[url]) } : { ok: false, status: 404 });

test('the loader base is installed per runtime from a checksum-verified installer and stamped', async (t) => {
  const cache = tmp(t);
  const neo = rt.describe({ loader: 'neoforge', minecraft: '1.21.1', loaderVersion: '21.1.265' });
  const installer = 'installer bytes';
  const sum = crypto.createHash('sha256').update(installer).digest('hex');
  await assert.rejects(ensureLoaderBase(cache, neo, 'java', () => {}, fakeInstall(neo), { http: http({ [`${neo.installerUrl}.sha256`]: '0'.repeat(64), [neo.installerUrl]: installer }) }), /installer checksum mismatch/);
  const base = await ensureLoaderBase(cache, neo, 'java', () => {}, fakeInstall(neo), { http: http({ [`${neo.installerUrl}.sha256`]: `${sum}  neoforge-21.1.265-installer.jar`, [neo.installerUrl]: installer }) });
  assert.equal(base, path.join(cache, 'loader-base', neo.id));
  assert.equal(rt.readStamp(base).id, neo.id);
  // Reuse needs no network; a base stamped for another runtime is refused.
  assert.equal(await ensureLoaderBase(cache, neo, 'java', () => {}, fakeInstall(neo), { http: http({}) }), base);
  const other = { ...neo, java: 17 };
  await assert.rejects(ensureLoaderBase(cache, other, 'java', () => {}, fakeInstall(neo), { http: http({}) }), /was built for neoforge-1\.21\.1-21\.1\.265 \(Java 21\)/);
});

test('a run dir prepared from the base carries the base runtime stamp', async (t) => {
  const cache = tmp(t);
  const neo = rt.describe({ loader: 'neoforge', minecraft: '1.21.1', loaderVersion: '21.1.265' });
  const installer = 'installer bytes';
  const sum = crypto.createHash('sha256').update(installer).digest('hex');
  const base = await ensureLoaderBase(cache, neo, 'java', () => {}, fakeInstall(neo), { http: http({ [`${neo.installerUrl}.sha256`]: sum, [neo.installerUrl]: installer }) });
  const run = path.join(cache, 'run');
  prepareRunDir(base, run, 1, '1G', '7');
  rt.assertStamp(run, neo);
});
