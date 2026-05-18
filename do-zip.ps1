$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$pkg = Get-Content (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$version = $pkg.version
if (-not $version) { Write-Error 'package.json missing version'; exit 1 }

$staging = Join-Path $root '.release\stage-zip'
$release = Join-Path $root 'release'
$zipSlug = '@gotoplan/manager' -replace '^@', '' -replace '/', '-'
if (Test-Path (Join-Path $root 'openclaw.plugin.json')) {
  try {
    $manifest = Get-Content (Join-Path $root 'openclaw.plugin.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manifest.id) {
      $zipSlug = [string]$manifest.id -replace '^@', '' -replace '/', '-'
    }
  } catch { }
}
$out = Join-Path $release "$zipSlug-$version-clawhub.zip"

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Force -Path $staging | Out-Null
New-Item -ItemType Directory -Force -Path $release | Out-Null
if (Test-Path $out) { Remove-Item $out -Force }

$required = @('package.json', 'package-lock.json', 'openclaw.plugin.json', 'claw-hub.json', 'dist', 'scripts')
$optional = @('README.md', 'CHANGELOG.md', 'INSTALLATION.md', 'LICENSE', 'skills', 'fix-config.bat', 'fix-config.sh', 'windows-install.ps1', 'macOS安装指南.md', 'macOS快速安装.md')

foreach ($e in $required) {
  $src = Join-Path $root $e
  if (-not (Test-Path $src)) { Write-Error "Missing required: $e"; exit 1 }
  Copy-Item $src (Join-Path $staging $e) -Recurse -Force
}
foreach ($e in $optional) {
  $src = Join-Path $root $e
  if (Test-Path $src) { Copy-Item $src (Join-Path $staging $e) -Recurse -Force }
}

# 使用 System.IO.Compression 创建 zip，强制使用正斜杠作为路径分隔符
# Compress-Archive 使用反斜杠，在 Linux/WSL 解压时会丢失目录结构
$outStream = [System.IO.File]::Open($out, [System.IO.FileMode]::Create)
$zipArchive = New-Object System.IO.Compression.ZipArchive($outStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
$stagingLen = $staging.Length + 1

$files = Get-ChildItem $staging -Recurse -File
foreach ($file in $files) {
    $entryName = $file.FullName.Substring($stagingLen) -replace '\\', '/'
    $entry = $zipArchive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
    $entryStream = $entry.Open()
    $fileStream = [System.IO.File]::OpenRead($file.FullName)
    $fileStream.CopyTo($entryStream)
    $fileStream.Close()
    $entryStream.Close()
}

$entryCount = $zipArchive.Entries.Count
$zipArchive.Dispose()
$outStream.Dispose()

Write-Host "[OK] Created: $out"
Write-Host "[OK] Entries: $entryCount (forward-slash paths, Linux compatible)"
Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
