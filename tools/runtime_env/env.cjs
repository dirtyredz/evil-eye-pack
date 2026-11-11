'use strict';
// The machine environment for the server smoke. The only file that names machine paths; each value
// can be overridden by an environment variable (smoke and analysis tools). The install route and
// cutover use `FIXED`, the same values built from an empty environment, so no SMOKE_* variable can redirect them. Loader and Minecraft versions are not here: they come
// from the pack's pack.toml through runtime.cjs, which also picks the Java major from JAVAS.
const javaHome = (home) => ({ java: `${home}/bin/java.exe`, jcmd: `${home}/bin/jcmd.exe` });
const JDK17 = javaHome('C:/Users/dirty/MultiMC/jdk-17_windows-x64_bin/jdk-17.0.10');
// Portable Temurin 21 (SHA-256 verified against the Adoptium API; see docs/neoforge-migration.md).
const JDK21 = javaHome('C:/Users/dirty/.local-state/tools/evil-eye-pack/temurin-21');

function machine(e) {
  return {
  JAVAS: {
    17: { java: e.SMOKE_JAVA_17 || JDK17.java, jcmd: e.SMOKE_JCMD_17 || JDK17.jcmd },
    21: { java: e.SMOKE_JAVA_21 || JDK21.java, jcmd: e.SMOKE_JCMD_21 || JDK21.jcmd }
  },
  // A loader installer URL override (mirror or offline copy); the checksum is still verified.
  INSTALLER_URL: e.SMOKE_INSTALLER_URL || '',
  BOOTSTRAP: e.SMOKE_BOOTSTRAP_JAR || 'C:/Users/dirty/MultiMC/packwiz/packwiz-installer-bootstrap.jar',
  // The owner's Evil Eye Local instance mods folder: read-only pinned-jar input for scanners.
  LOCAL_MODS: e.SMOKE_LOCAL_MODS || 'C:/Users/dirty/MultiMC/instances/Evil Eye Local/.minecraft/mods',
  // Same packwiz-installer bytes in every instance; Stable's copy is the fallback so a rebuilt (empty) Local still installs. Read only.
  INSTALLER_JAR_SOURCES: [e.SMOKE_INSTALLER_JAR || 'C:/Users/dirty/MultiMC/instances/Evil Eye Local/.minecraft/packwiz-installer.jar', 'C:/Users/dirty/MultiMC/instances/Evil Eye Stable/.minecraft/packwiz-installer.jar'],
  // Stable's offline install cache. Install guards use FIXED, unaffected by smoke overrides.
  STABLE_CACHE: e.SMOKE_STABLE_CACHE || 'C:/Users/dirty/.local-state/evil-eye-pack/artifacts/jobs/2026-10-31-world-trial-final/cache',
  ARTIFACTS: e.SMOKE_ARTIFACTS || 'C:/Users/dirty/.local-state/evil-eye-pack/artifacts',
  // Verified NeoForge 1.21.1 target jars (tools/packwiz/migration/migrate.mjs resolve): the read-only pinned-jar input
  // for scanners while no instance has installed the target pack.
  MIGRATION_MODS: e.SMOKE_MIGRATION_MODS || 'C:/Users/dirty/.local-state/evil-eye-pack/artifacts/migration/neoforge-1.21.1/cache/mods'
};
}

module.exports = { ...machine(process.env), FIXED: machine({}) };
