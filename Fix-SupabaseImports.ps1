# Fix-SupabaseImports.ps1
# Run from project root: C:\Projects\drivemapz
# One-shot fix: unify all supabaseBrowser imports to "@/app/lib/supabase/browser"

$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
if (-not (Test-Path (Join-Path $root "package.json"))) {
  throw "Run dit script vanuit de project root (waar package.json staat). Huidige map: $root"
}

$canonical = "app\lib\supabase\browser.ts"
$canonicalFull = Join-Path $root $canonical

if (-not (Test-Path $canonicalFull)) {
  throw "Bestand ontbreekt: $canonicalFull. Zorg dat app\lib\supabase\browser.ts bestaat."
}

# Backup folder
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $root ("_fix_backup_" + $stamp)
New-Item -ItemType Directory -Path $backupDir | Out-Null

function Backup-File($path) {
  if (Test-Path $path) {
    $rel = Resolve-Path $path | ForEach-Object { $_.Path.Substring($root.Length).TrimStart('\') }
    $dest = Join-Path $backupDir $rel
    $destDir = Split-Path $dest -Parent
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    Copy-Item $path $dest -Force
  }
}

Write-Host "Backup folder: $backupDir"

# 1) Delete duplicate supabaseBrowser.ts (the one in app\lib root)
$dup = Join-Path $root "app\lib\supabaseBrowser.ts"
if (Test-Path $dup) {
  Backup-File $dup
  Remove-Item $dup -Force
  Write-Host "Deleted duplicate: app\lib\supabaseBrowser.ts"
} else {
  Write-Host "No duplicate found: app\lib\supabaseBrowser.ts"
}

# 2) Fix app\lib\supabaseClient.ts
$sc = Join-Path $root "app\lib\supabaseClient.ts"
if (Test-Path $sc) {
  Backup-File $sc
  Set-Content -Path $sc -Encoding UTF8 -Value 'export { supabaseBrowser } from "@/app/lib/supabase/browser";'
  Write-Host "Updated: app\lib\supabaseClient.ts"
} else {
  Write-Host "Not found (skip): app\lib\supabaseClient.ts"
}

# 3) Replace imports everywhere
$targets = Get-ChildItem -Path (Join-Path $root "app") -Recurse -File |
  Where-Object { $_.Extension -in ".ts", ".tsx" }

$patterns = @(
  # various relative imports that currently point to old file
  'from\s+["'']\.\.\/lib\/supabaseBrowser["'']',
  'from\s+["'']\.\.\/\.\.\/lib\/supabaseBrowser["'']',
  'from\s+["'']\.\/\.\.\/lib\/supabaseBrowser["'']',
  'from\s+["'']@\/app\/lib\/supabaseBrowser["'']',
  'from\s+["'']@\/app\/lib\/supabaseBrowser\.ts["'']',
  'from\s+["'']\.\.\/lib\/supabaseBrowser\.ts["'']',
  'from\s+["'']@\/app\/lib\/supabase\/browser["'']',     # already canonical - keep
  'from\s+["'']@\/app\/lib\/supabase\/browser\.ts["'']', # normalize
  'from\s+["'']@\/app\/lib\/supabase\/browser\.tsx["'']' # normalize
)

# We normalize ANY import that references supabaseBrowser file to the canonical one:
# "@/app/lib/supabase/browser"
$changedCount = 0

foreach ($f in $targets) {
  $p = $f.FullName
$text = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)

  $orig = $text

  # normalize common import lines to canonical
  $text = $text -replace 'from\s+["'']\.\.\/lib\/supabaseBrowser["'']', 'from "@/app/lib/supabase/browser"'
  $text = $text -replace 'from\s+["'']\.\.\/\.\.\/lib\/supabaseBrowser["'']', 'from "@/app/lib/supabase/browser"'
  $text = $text -replace 'from\s+["'']\.\/\.\.\/lib\/supabaseBrowser["'']', 'from "@/app/lib/supabase/browser"'
  $text = $text -replace 'from\s+["'']@\/app\/lib\/supabaseBrowser(\.ts)?["'']', 'from "@/app/lib/supabase/browser"'
  $text = $text -replace 'from\s+["'']\.\.\/lib\/supabaseBrowser(\.ts)?["'']', 'from "@/app/lib/supabase/browser"'
  $text = $text -replace 'from\s+["'']@\/app\/lib\/supabase\/browser(\.ts|\.tsx)?["'']', 'from "@/app/lib/supabase/browser"'

  # Also normalize cases where someone imported from "@/app/lib/supabase/browser" already (no change)

  if ($text -ne $orig) {
    Backup-File $p
    [System.IO.File]::WriteAllText($p, $text, [System.Text.Encoding]::UTF8)
    $changedCount++
    Write-Host ("Updated: " + $f.FullName.Substring($root.Length).TrimStart('\'))
  }
}

Write-Host ""
Write-Host "Done. Files updated: $changedCount"
Write-Host "Backup saved in: $backupDir"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1) npm run build"
Write-Host "  2) git status"
Write-Host "  3) git add . ; git commit -m `"Unify supabaseBrowser imports`" ; git push"
