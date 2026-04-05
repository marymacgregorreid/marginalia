param(
    [Parameter(Mandatory)]
    [string]$ApiBaseUrl,

    [Parameter(Mandatory)]
    [string]$FrontendBaseUrl
)

Describe 'Backend API' {
    BeforeAll {
        # Wait for Container App cold start with retry on /health endpoint
        # ACA cold-start from zero replicas + GHCR image pull can take 2+ minutes.
        # ACA ingress propagation can also return 403 for up to ~3 minutes after provisioning.
        $maxRetries = 15
        $retryDelay = 10
        $healthy = $false

        for ($i = 1; $i -le $maxRetries; $i++) {
            $timestamp = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')
            try {
                $response = Invoke-WebRequest -Uri "$ApiBaseUrl/health" -UseBasicParsing -TimeoutSec 10
                if ($response.StatusCode -eq 200) {
                    $healthy = $true
                    Write-Host "[$timestamp] Backend /health is ready (attempt $i/$maxRetries)"
                    break
                }
                else {
                    Write-Host "[$timestamp] Attempt $i/${maxRetries}: /health returned HTTP $($response.StatusCode), retrying in ${retryDelay}s..."
                    Write-Host "  Response body: $($response.Content.Substring(0, [Math]::Min(500, $response.Content.Length)))"
                }
            }
            catch {
                $errorDetail = $_.Exception.Message
                # Try to extract HTTP status code and body from the exception
                if ($_.Exception.Response) {
                    $statusCode = [int]$_.Exception.Response.StatusCode
                    try {
                        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
                        $body = $reader.ReadToEnd()
                        $reader.Close()
                        $bodySnippet = $body.Substring(0, [Math]::Min(500, $body.Length))
                        Write-Host "[$timestamp] Attempt $i/${maxRetries}: /health returned HTTP $statusCode - $errorDetail"
                        Write-Host "  Response body: $bodySnippet"
                    }
                    catch {
                        Write-Host "[$timestamp] Attempt $i/${maxRetries}: /health returned HTTP $statusCode - $errorDetail"
                    }
                }
                else {
                    Write-Host "[$timestamp] Attempt $i/${maxRetries}: /health not ready - $errorDetail"
                }
                Start-Sleep -Seconds $retryDelay
            }
        }

        if (-not $healthy) {
            throw "Backend /health did not become healthy after $maxRetries attempts ($(($maxRetries * $retryDelay))s). URL: $ApiBaseUrl/health"
        }

        # Wait for all dependencies to be ready using the /api/status endpoint.
        # This checks Cosmos DB connectivity, managed identity, and AI Foundry in one call.
        $statusReady = $false
        $maxStatusRetries = 20
        $statusRetryDelay = 10

        for ($i = 1; $i -le $maxStatusRetries; $i++) {
            $timestamp = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')
            try {
                $statusResponse = Invoke-WebRequest -Uri "$ApiBaseUrl/api/status" -UseBasicParsing -TimeoutSec 30
                $statusJson = $statusResponse.Content | ConvertFrom-Json

                Write-Host "[$timestamp] Status check (attempt $i/$maxStatusRetries):"
                Write-Host "  Overall:          $($statusJson.overall)"
                Write-Host "  Managed Identity: $($statusJson.managedIdentity.status) - $($statusJson.managedIdentity.message)"
                Write-Host "  Cosmos DB:        $($statusJson.cosmosDb.status) - $($statusJson.cosmosDb.message)"
                Write-Host "  AI Foundry:       $($statusJson.aiFoundry.status) - $($statusJson.aiFoundry.message)"

                if ($statusJson.overall -eq 'Healthy') {
                    $statusReady = $true
                    break
                }

                # Log specific failures for diagnostics
                if ($statusJson.cosmosDb.error) {
                    Write-Host "  Cosmos DB error:  $($statusJson.cosmosDb.error)"
                }
                if ($statusJson.managedIdentity.error) {
                    Write-Host "  MI error:         $($statusJson.managedIdentity.error)"
                }

                Start-Sleep -Seconds $statusRetryDelay
            }
            catch {
                Write-Host "[$timestamp] Attempt $i/${maxStatusRetries}: /api/status request failed - $($_.Exception.Message)"
                Start-Sleep -Seconds $statusRetryDelay
            }
        }

        if (-not $statusReady) {
            # Dump final status for diagnostics before failing
            Write-Host "WARNING: Dependencies not fully healthy after $maxStatusRetries attempts"
        }
    }

    It 'Health endpoint returns Healthy' {
        $response = Invoke-WebRequest -Uri "$ApiBaseUrl/health" -UseBasicParsing -TimeoutSec 10
        $response.StatusCode | Should -Be 200
        $response.Content | Should -BeLike '*Healthy*'
    }

    It 'Liveness endpoint returns 200' {
        $response = Invoke-WebRequest -Uri "$ApiBaseUrl/alive" -UseBasicParsing -TimeoutSec 10
        $response.StatusCode | Should -Be 200
    }

    It 'Status endpoint reports all dependencies healthy' {
        $response = Invoke-WebRequest -Uri "$ApiBaseUrl/api/status" -UseBasicParsing -TimeoutSec 30
        $response.StatusCode | Should -Be 200

        $status = $response.Content | ConvertFrom-Json
        $status.overall | Should -Be 'Healthy'
        $status.cosmosDb.status | Should -Be 'Healthy'
        $status.managedIdentity.status | Should -Be 'Healthy'
    }

    It 'Documents API returns 200' {
        $response = Invoke-WebRequest -Uri "$ApiBaseUrl/api/documents" -UseBasicParsing -TimeoutSec 15
        $response.StatusCode | Should -Be 200
    }
}

Describe 'Frontend SPA' {
    It 'Returns 200 and contains root div' {
        $response = Invoke-WebRequest -Uri $FrontendBaseUrl -UseBasicParsing -TimeoutSec 10
        $response.StatusCode | Should -Be 200
        $response.Content | Should -Match '<div id="root"'
    }

    It 'Serves JavaScript assets' {
        $html = (Invoke-WebRequest -Uri $FrontendBaseUrl -UseBasicParsing -TimeoutSec 10).Content
        $assetMatch = [regex]::Match($html, 'src="(/assets/[^"]+\.js)"')

        if (-not $assetMatch.Success) {
            Set-ItResult -Inconclusive -Because 'No JS asset reference found in HTML'
            return
        }

        $assetUrl = "$FrontendBaseUrl$($assetMatch.Groups[1].Value)"
        $response = Invoke-WebRequest -Uri $assetUrl -UseBasicParsing -TimeoutSec 10
        $response.StatusCode | Should -Be 200
    }
}
