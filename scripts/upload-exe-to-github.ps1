param(
    [Parameter(Mandatory = $true)]
    [string]$Tag,

    [string]$ReleaseName,

    [string]$Repo = "hardy045/MinecraftServerListLauncher",

    [string]$AssetPath = "dist/MCServerList-Setup-1.0.0.exe",

    [string]$Notes = "Automated upload of MCServerList Launcher build"
)

$ErrorActionPreference = "Stop"

function Assert-GhCli {
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
        throw "GitHub CLI (gh) is not available in PATH. Install it from https://cli.github.com/ and sign in with 'gh auth login'."
    }
}

try {
    Assert-GhCli

    $repoRoot = Split-Path -Parent $PSScriptRoot
    $assetFullPath = if ([System.IO.Path]::IsPathRooted($AssetPath)) { $AssetPath } else { Join-Path $repoRoot $AssetPath }

    if (-not (Test-Path -LiteralPath $assetFullPath)) {
        throw "Asset not found at '$assetFullPath'. Build the installer first."
    }

    if (-not $ReleaseName) {
        $ReleaseName = $Tag
    }

    Write-Host "Using repo $Repo"
    Write-Host "Uploading asset $assetFullPath"

    $releaseExists = $true
    try {
        gh release view $Tag --repo $Repo | Out-Null
    } catch {
        $releaseExists = $false
    }

    if (-not $releaseExists) {
        Write-Host "Release $Tag does not exist. Creating it..."
        gh release create $Tag $assetFullPath --repo $Repo --title $ReleaseName --notes $Notes | Out-Null
        Write-Host "Release $Tag created and asset uploaded."
    } else {
        Write-Host "Release $Tag exists. Uploading asset..."
        gh release upload $Tag $assetFullPath --repo $Repo --clobber | Out-Null
        Write-Host "Asset uploaded to release $Tag."
    }
}
catch {
    Write-Error "Upload failed: $($_.Exception.Message)"
    exit 1
}
