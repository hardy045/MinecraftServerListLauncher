param(
    [string]$CommitMessage = "chore: update wizard",
    [string]$Remote = "origin",
    [string]$Branch
)

$ErrorActionPreference = "Stop"

function Assert-GitAvailable {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        throw "git is not available in PATH. Install Git or run from a Git-enabled terminal."
    }
}

try {
    Assert-GitAvailable

    $repoRoot = Split-Path -Parent $PSScriptRoot
    Set-Location $repoRoot

    if (-not $CommitMessage) {
        throw "CommitMessage cannot be empty."
    }

    $status = git status --porcelain
    if ([string]::IsNullOrWhiteSpace($status)) {
        Write-Host "No changes detected. Nothing to commit or push."
        exit 0
    }

    git add -A
    git commit -m $CommitMessage

    if (-not $Branch) {
        $Branch = (git rev-parse --abbrev-ref HEAD).Trim()
    }

    Write-Host "Pushing to $Remote/$Branch..."
    git push $Remote $Branch

    Write-Host "Wizard changes pushed successfully."
} catch {
    Write-Error "Push failed: $($_.Exception.Message)"
    exit 1
}
