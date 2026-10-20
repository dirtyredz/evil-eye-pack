'use strict';
// The machine environment for the server smoke. The only file that names paths or versions;
// each value can be overridden by an environment variable.
const e = process.env;

const FORGE = e.SMOKE_FORGE_VERSION || '1.20.1-47.4.10';

module.exports = {
  FORGE,
  FORGE_URL: e.SMOKE_FORGE_URL || `https://maven.minecraftforge.net/net/minecraftforge/forge/${FORGE}/forge-${FORGE}-installer.jar`,
  JAVA: e.SMOKE_JAVA || 'C:/Users/dirty/MultiMC/jdk-17_windows-x64_bin/jdk-17.0.10/bin/java.exe',
  JCMD: e.SMOKE_JCMD || 'C:/Users/dirty/MultiMC/jdk-17_windows-x64_bin/jdk-17.0.10/bin/jcmd.exe',
  BOOTSTRAP: e.SMOKE_BOOTSTRAP_JAR || 'C:/Users/dirty/MultiMC/packwiz/packwiz-installer-bootstrap.jar',
  INSTALLER_JAR_SOURCES: [e.SMOKE_INSTALLER_JAR || 'C:/Users/dirty/MultiMC/instances/Evil Eye Local/.minecraft/packwiz-installer.jar'],
  ARTIFACTS: e.SMOKE_ARTIFACTS || 'C:/Users/dirty/projects/artifacts/evil-eye-pack'
};
