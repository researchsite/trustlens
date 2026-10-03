# TrustLens Video Producer
# Usage:  .\scripts\make-video.ps1
# Output: _private/video/trustlens-demo.mp4

param(
  [string]$AppUrl = "http://localhost:3000",
  [switch]$SkipRecording,
  [switch]$SkipNarration
)

$ErrorActionPreference = "Stop"
$root  = Split-Path $PSScriptRoot -Parent
$video = Join-Path $root "_private\video"
New-Item -ItemType Directory -Force -Path $video | Out-Null

Write-Host "`n=== TrustLens Video Producer ===" -ForegroundColor Cyan

# --- 0. Check app ---
try {
  Invoke-WebRequest -Uri $AppUrl -TimeoutSec 4 -UseBasicParsing | Out-Null
  Write-Host "  App running at $AppUrl" -ForegroundColor Green
} catch {
  Write-Host "  App not running at $AppUrl - start it first with: npm run dev" -ForegroundColor Red
  exit 1
}

# --- 1. TTS Narration ---
$narrationFile = Join-Path $video "narration.wav"
if (-not $SkipNarration) {
  Write-Host "`n[1/3] Generating TTS narration..." -ForegroundColor Cyan

  $script = "Every time you buy something online, you are trusting a stranger. Are those reviews real? Is this seller legitimate? Are the specs even accurate? TrustLens answers all three in seconds.

Let me search for Amazon Echo Dot 5th Generation. TrustLens is now running its five-step pipeline: discovering vendors with Tavily, fetching real review data from ZooData, and scoring every vendor with Nebius Qwen 3 artificial intelligence.

Results are in. PriceRunner scores 75 out of 100, Trusted. Accurate specs, no exaggerated claims, consistent pricing across all sources.

Best Buy scores 70, also Trusted. Authorized reseller, all product specifications verified.

One marketplace listing scores just 55, Caution. TrustLens flags mixed signals here and recommends checking directly with the manufacturer.

Now let me check this suspicious $39 AirPods Pro deal on Temu.

Score: 45, Caution. But here is the key finding: this listing is not even real AirPods. It is a cheap headphone case. 85 percent of the reviews appear AI-generated. TrustLens immediately surfaces Amazon and Swappa as trusted alternatives where you can actually buy real AirPods.

If I want to share this result with someone shopping on their phone, one tap sends the full trust score via text message. No app, no account, just a text.

TrustLens is built entirely on sponsor APIs: ZooWork, ZooData, Nebius, Novita AI, Tavily, and Twilio. Open source on GitHub and deployed on Vercel.

Know who you are buying from, before you pay."

  Add-Type -AssemblyName System.Speech
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer

  $voices = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }
  Write-Host "  Voices found: $($voices -join ', ')" -ForegroundColor DarkGray

  $preferred = $voices | Where-Object { $_ -match "David|Mark|Aria|Guy|Zira" } | Select-Object -First 1
  if ($preferred) {
    $synth.SelectVoice($preferred)
    Write-Host "  Using voice: $preferred" -ForegroundColor Green
  }

  $synth.Rate   = 1
  $synth.Volume = 100
  $synth.SetOutputToWaveFile($narrationFile)
  $synth.Speak($script)
  $synth.SetOutputToDefaultAudioDevice()
  Write-Host "  Saved: $narrationFile" -ForegroundColor Green
}

# --- 2a. Pre-warm cache ---
$rawVideo = Join-Path $video "demo-raw.webm"
if (-not $SkipRecording) {
  Write-Host "`n[2a/3] Pre-warming pipeline cache (both demo queries)..." -ForegroundColor Cyan
  Write-Host "  This runs the full AI pipeline now so recording plays back instantly." -ForegroundColor DarkGray
  Set-Location $root
  node --env-file=.env.local scripts/prewarm-cache.mjs
  if ($LASTEXITCODE -ne 0) { Write-Host "  Cache warm had warnings (continuing anyway)" -ForegroundColor Yellow }

  # --- 2b. Record ---
  Write-Host "`n[2b/3] Recording Playwright demo (cache hot -- results will be instant)..." -ForegroundColor Cyan
  Write-Host "  Browser will open and auto-demo the app." -ForegroundColor DarkGray
  Write-Host "  Do NOT touch mouse or keyboard during recording." -ForegroundColor Yellow

  node --env-file=.env.local scripts/record-demo.mjs
  if ($LASTEXITCODE -ne 0) { throw "Playwright recording failed" }
  Write-Host "  Recorded: $rawVideo" -ForegroundColor Green
}

if (-not (Test-Path $rawVideo))      { throw "Missing: $rawVideo - run without -SkipRecording" }
if (-not (Test-Path $narrationFile)) { throw "Missing: $narrationFile - run without -SkipNarration" }

# --- 3. ffmpeg merge ---
Write-Host "`n[3/3] Merging with ffmpeg..." -ForegroundColor Cyan

$finalMp4 = Join-Path $video "trustlens-demo.mp4"

$vidSize = [math]::Round((Get-Item $rawVideo).Length / 1MB, 1)
$audSize = [math]::Round((Get-Item $narrationFile).Length / 1MB, 1)
Write-Host "  Video: $vidSize MB  Audio: $audSize MB" -ForegroundColor DarkGray

cmd /c "ffmpeg -y -i ""$rawVideo"" -i ""$narrationFile"" -filter_complex ""[1:a]apad[a]"" -map 0:v -map ""[a]"" -c:v libx264 -preset fast -crf 18 -c:a aac -b:a 192k -shortest -movflags +faststart ""$finalMp4"" 2>&1" | Select-String "time=|Lsize|error" -CaseSensitive:$false | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }

if (Test-Path $finalMp4) {
  $sizeMB = [math]::Round((Get-Item $finalMp4).Length / 1MB, 1)
  Write-Host "`n  DONE: $finalMp4  ($sizeMB MB)" -ForegroundColor Green
  Start-Process $finalMp4
} else {
  Write-Host "`n  ffmpeg merge failed" -ForegroundColor Red
}

Write-Host "`n=== Complete ===" -ForegroundColor Cyan
Write-Host "  Upload to YouTube: $finalMp4"
Write-Host "  Thumbnail: _private\submission\thumbnail.svg"
