param([switch]$RenderSlides)
$ErrorActionPreference = 'Stop'
$pitchRoot = Split-Path -Parent $PSScriptRoot
$pitchSource = Join-Path $pitchRoot 'output/presentation/dbc-guard-pitch.pptx'
$pitchPdf = Join-Path $pitchRoot 'output/presentation/dbc-guard-pitch.pdf'
$pitchAlreadyRunning = @(Get-Process POWERPNT -ErrorAction SilentlyContinue).Count -gt 0
$pitchApp = $null
$pitchPresentation = $null
try {
    $pitchApp = New-Object -ComObject PowerPoint.Application
    $pitchPresentation = $pitchApp.Presentations.Open($pitchSource, -1, 0, 0)
    $pitchPresentation.SaveAs($pitchPdf, 32)
    if ($RenderSlides) {
        $pitchImages = Join-Path $pitchRoot 'output/presentation/qa-slides'
        New-Item -ItemType Directory -Path $pitchImages -Force | Out-Null
        $pitchPresentation.Export($pitchImages, 'PNG', 1600, 900)
    }
    $pitchPdfDirectory = Join-Path $pitchRoot 'output/pdf'
    New-Item -ItemType Directory -Path $pitchPdfDirectory -Force | Out-Null
    Copy-Item -LiteralPath $pitchPdf -Destination (Join-Path $pitchPdfDirectory 'dbc-guard-pitch.pdf') -Force
    Copy-Item -LiteralPath $pitchPdf -Destination (Join-Path $pitchRoot 'public/submission/dbc-guard-pitch.pdf') -Force
    Write-Output $pitchPdf
}
finally {
    if ($null -ne $pitchPresentation) {
        $pitchPresentation.Close()
        [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($pitchPresentation) | Out-Null
    }
    if ($null -ne $pitchApp) {
        if (-not $pitchAlreadyRunning) { $pitchApp.Quit() }
        [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($pitchApp) | Out-Null
    }
}
