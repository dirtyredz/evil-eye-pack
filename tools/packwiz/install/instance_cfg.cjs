'use strict';
// Pure instance.cfg reads, launcher-value normalization and key mutation.
function instanceCfgValue(value) {
  if (typeof value !== 'string' || /[\r\n]/.test(value)) throw Error('Unsafe instance.cfg value');
  return value.replaceAll('\\', '/');
}

function instanceCfgGet(text, key) {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key)) throw Error('Unsafe instance.cfg key');
  return (text.match(new RegExp('^' + key + '=([^\r\n]*)', 'm')) || [])[1];
}

function setInstanceCfgValue(text, key, value) {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key)) throw Error('Unsafe instance.cfg key');
  const line = new RegExp(`^${key}=[^\\r\\n]*$`, 'm');
  if (!line.test(text)) {
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    return text + (text && !text.endsWith('\n') ? eol : '') + key + '=' + instanceCfgValue(value) + eol;
  }
  return text.replace(line, `${key}=${instanceCfgValue(value)}`);
}

module.exports = { instanceCfgGet, instanceCfgValue, setInstanceCfgValue };
