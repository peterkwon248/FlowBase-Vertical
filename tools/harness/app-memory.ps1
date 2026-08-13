<#
  앱 메모리 측정 — **app.exe의 프로세스 트리만** 잰다.

  ★ 함정 ★
  이름으로 `msedgewebview2.exe`를 잡으면 안 된다. 그건 시스템 전역에서 여러
  앱이 쓰는 프로세스명이라, 다른 프로그램의 웹뷰까지 합산된다. 실제로 첫
  측정에서 베이스라인이 952MB로 나왔고 그 대부분이 남의 것이었다.
  WebView2 프로세스는 우리 `app.exe`의 **자식**이므로 트리로 골라야 한다.

  ★ 무엇을 판정하는가 ★
  총량이 아니라 **증가분**이다. 베이스라인(대개 400MB대)은 Chromium 엔진의
  고정 비용이지 파이프라인이 쓴 것이 아니다. ADR-001 조건 4-a의 256MB는
  "Worker 피크 RSS" 기준이라 웹뷰 총량에 그대로 들이대지 않는다 (ADR-011).

  사용:
    powershell -File tools/harness/app-memory.ps1 -Seconds 120
    # 다른 창에서 측정 대상 동작을 일으킨다 (스모크 등)
#>
param(
  [int]$Seconds = 120,
  [int]$IntervalMs = 250,
  [string]$Csv = ".tmp\app-memory.csv"
)

function Get-Tree($id) {
  $id
  Get-CimInstance Win32_Process -Filter "ParentProcessId=$id" -ErrorAction SilentlyContinue |
    ForEach-Object { Get-Tree $_.ProcessId }
}

$app = Get-Process app -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $app) { Write-Error "app.exe가 떠 있지 않다 — 앱을 먼저 띄운다"; exit 1 }

$ids = @(Get-Tree $app.Id) | Select-Object -Unique
Write-Host "프로세스 트리 $($ids.Count)개 (app.exe PID $($app.Id) + 자식)"
Write-Host "$Seconds초 동안 ${IntervalMs}ms 간격으로 잰다…"

$rows = New-Object System.Collections.ArrayList
$deadline = (Get-Date).AddSeconds($Seconds)
while ((Get-Date) -lt $deadline) {
  $ps = Get-Process -Id $ids -ErrorAction SilentlyContinue
  if ($ps) {
    $mb = [math]::Round((($ps | Measure-Object WorkingSet64 -Sum).Sum) / 1MB, 1)
    [void]$rows.Add([pscustomobject]@{ t = (Get-Date).ToString("HH:mm:ss.fff"); mb = $mb })
  }
  Start-Sleep -Milliseconds $IntervalMs
}

if ($rows.Count -eq 0) { Write-Error "샘플이 없다 — 앱이 도중에 죽었나"; exit 1 }

$vals = $rows | ForEach-Object { $_.mb }
$min = ($vals | Measure-Object -Minimum).Minimum
$max = ($vals | Measure-Object -Maximum).Maximum

$dir = Split-Path $Csv -Parent
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
$rows | Export-Csv -Path $Csv -NoTypeInformation -Encoding utf8

Write-Host ""
Write-Host "샘플      $($rows.Count)"
Write-Host "베이스라인 ${min}MB   ← Chromium 엔진 고정비. 판정 대상이 아니다"
Write-Host "피크       ${max}MB"
Write-Host "★ 증가분  +$([math]::Round($max - $min, 1))MB   ← 이 숫자로 판정한다"
Write-Host ""
Write-Host "시계열: $Csv"
