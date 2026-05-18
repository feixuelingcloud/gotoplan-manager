import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readlinkSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
} from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const packageJsonPath = path.join(projectRoot, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const pluginManifestPath = path.join(projectRoot, "openclaw.plugin.json");
const pluginManifest = JSON.parse(readFileSync(pluginManifestPath, "utf8"));
/** Zip basename: convert scoped id to slug (e.g. @gotoplan/manager → gotoplan-manager) */
const zipSlug = String(pluginManifest.id || packageJson.name)
  .replace(/^@/, "")
  .replace("/", "-");

const requiredEntries = [
  "package.json",
  "package-lock.json",
  "openclaw.plugin.json",
  "claw-hub.json",
  "dist",
  "scripts",
];

const optionalEntries = [
  "README.md",
  "CHANGELOG.md",
  "INSTALLATION.md",
  "LICENSE",
  "skills",
  "install.sh",
  "install.bat",
  "fix-config.bat",
  "fix-config.sh",
  "windows-install.ps1",
  "macOS安装指南.md",
  "macOS快速安装.md",
];

function copyRecursive(sourcePath, targetPath) {
  const stat = statSync(sourcePath);

  if (stat.isDirectory()) {
    mkdirSync(targetPath, { recursive: true });
    for (const entry of readdirSync(sourcePath)) {
      copyRecursive(path.join(sourcePath, entry), path.join(targetPath, entry));
    }
    return;
  }

  if (stat.isSymbolicLink()) {
    symlinkSync(readlinkSync(sourcePath), targetPath);
    return;
  }

  mkdirSync(path.dirname(targetPath), { recursive: true });
  copyFileSync(sourcePath, targetPath);
}

for (const entry of requiredEntries) {
  const entryPath = path.join(projectRoot, entry);
  if (!existsSync(entryPath)) {
    console.error(`[ERROR] Required package entry is missing: ${entry}`);
    process.exit(1);
  }
}

const releaseDir = path.join(projectRoot, "release");
const tempRootDir = path.join(projectRoot, ".release");
mkdirSync(tempRootDir, { recursive: true });
const stagingDir = mkdtempSync(path.join(tempRootDir, "clawhub-"));
const packageRoot = path.join(stagingDir, "package-root");
let outputFileName = `${zipSlug}-${packageJson.version}-clawhub.zip`;
let outputFilePath = path.join(releaseDir, outputFileName);

mkdirSync(packageRoot, { recursive: true });
mkdirSync(releaseDir, { recursive: true });
try {
  rmSync(outputFilePath, { force: true });
} catch (error) {
  // Windows may briefly lock a freshly created ZIP. Avoid failing the build by
  // writing a timestamped archive instead.
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  outputFileName = `${zipSlug}-${packageJson.version}-clawhub-${stamp}.zip`;
  outputFilePath = path.join(releaseDir, outputFileName);
  console.warn(`[WARN] Existing zip is locked, writing ${outputFileName} instead: ${error.message}`);
}

const packagedEntries = [];
for (const entry of [...requiredEntries, ...optionalEntries]) {
  const sourcePath = path.join(projectRoot, entry);
  if (!existsSync(sourcePath)) {
    continue;
  }

  const targetPath = path.join(packageRoot, entry);
  copyRecursive(sourcePath, targetPath);
  packagedEntries.push(entry);
}

if (process.platform === "win32") {
  // Do not use PowerShell Compress-Archive here. Some OpenClaw/Linux unzip
  // paths treat Windows-style separators as literal filename characters,
  // producing flat files like "dist index.js" instead of "dist/index.js".
  // bsdtar writes ZIP entries with POSIX "/" separators.
  //
  // bsdtar on Windows misinterprets absolute drive-letter paths (e.g. "F:\...")
  // as network addresses ("F:" → host). Use a relative output path instead.
  try {
    const relOutputPath = path.relative(packageRoot, outputFilePath).replace(/\\/g, "/");
    execFileSync("tar", ["-a", "-cf", relOutputPath, ...packagedEntries], {
      cwd: packageRoot,
      stdio: "inherit",
    });
  } catch (error) {
    console.error("[ERROR] Failed to create ZIP with tar. Windows releases require tar.exe to preserve POSIX paths.");
    throw error;
  }
} else {
  try {
    execFileSync("zip", ["-r", "-q", outputFilePath, ...packagedEntries], {
      cwd: packageRoot,
      stdio: "inherit",
    });
  } catch {
    execFileSync("tar", ["-a", "-cf", outputFilePath, ...packagedEntries], {
      cwd: packageRoot,
      stdio: "inherit",
    });
  }
}

console.log(`[OK] Created ClawHub zip: ${outputFilePath}`);

try {
  rmSync(stagingDir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
} catch {
  // Ignore temp cleanup errors on Windows file locking.
}
