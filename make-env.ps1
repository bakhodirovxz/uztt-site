# Docker'siz lokal sozlama: apps\api\.env va apps\web\.env.local (mavjudini ustidan YOZMAYDI).
$ErrorActionPreference = 'Stop'
function Hex($n) { $b = New-Object byte[] $n; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); -join ($b | ForEach-Object { $_.ToString('x2') }) }
$utf8 = New-Object Text.UTF8Encoding($false)
$api = "$PSScriptRoot\apps\api\.env"
if (-not (Test-Path $api)) {
  $lines = @(
    'NODE_ENV=development',
    'PORT=4000',
    'DATABASE_URL=postgresql://uztt:uztt_local@127.0.0.1:54329/uztt?schema=public',
    "JWT_SECRET=$(Hex 32)",
    "JWT_REFRESH_SECRET=$(Hex 32)",
    "DATA_ENCRYPTION_KEY=$(Hex 32)",
    'DATA_ENCRYPTION_KEY_ID=k1',
    'WEB_ORIGIN=http://localhost:3000',
    'TELEGRAM_BOT_TOKEN=',
    'TELEGRAM_CHAT_ID='
  )
  [IO.File]::WriteAllLines($api, $lines, $utf8)
  Write-Host "yaratildi: apps\api\.env"
}
$web = "$PSScriptRoot\apps\web\.env.local"
if (-not (Test-Path $web)) {
  [IO.File]::WriteAllLines($web, @('NEXT_PUBLIC_API_URL=http://localhost:4000', 'API_INTERNAL_URL=http://localhost:4000', 'NEXT_TELEMETRY_DISABLED=1'), $utf8)
  Write-Host "yaratildi: apps\web\.env.local"
}

# Scoreboard (planshet/TV/overlay) bilan ulanish uchun umumiy maxfiy kalit va lokal rejim
$sbf = "$PSScriptRoot\local\.sbsecret"
if (-not (Test-Path $sbf)) { [IO.File]::WriteAllText($sbf, (Hex 24), $utf8) }
$sec = ([IO.File]::ReadAllText($sbf)).Trim()
if ((Test-Path $api) -and -not (Select-String -Path $api -Pattern '^SB_SECRET=' -Quiet)) {
  [IO.File]::AppendAllText($api, "`r`nSB_SECRET=$sec`r`n", $utf8)
  Write-Host "qo'shildi: SB_SECRET"
}
if ((Test-Path $web) -and -not (Select-String -Path $web -Pattern '^SB_GUARD=' -Quiet)) {
  [IO.File]::AppendAllText($web, "`r`nSB_GUARD=0`r`n", $utf8)
}
