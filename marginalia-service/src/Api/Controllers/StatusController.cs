using System.Diagnostics;
using Azure.Core;
using Azure.Identity;
using Marginalia.Domain.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.AI;

namespace Marginalia.Api.Controllers;

/// <summary>
/// Checks individual dependency health. Extracted for testability.
/// </summary>
public interface IDependencyChecker
{
    Task<DependencyStatus> CheckManagedIdentityAsync(CancellationToken cancellationToken);
    Task<DependencyStatus> CheckCosmosDbAsync(CancellationToken cancellationToken);
    DependencyStatus CheckAiFoundry();
}

/// <summary>
/// Production implementation that probes real Azure dependencies.
/// </summary>
public sealed class DependencyChecker : IDependencyChecker
{
    private readonly CosmosClient _cosmosClient;
    private readonly IChatClient? _chatClient;

    public DependencyChecker(CosmosClient cosmosClient, IChatClient? chatClient = null)
    {
        _cosmosClient = cosmosClient;
        _chatClient = chatClient;
    }

    public async Task<DependencyStatus> CheckManagedIdentityAsync(CancellationToken cancellationToken)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            var credential = new ManagedIdentityCredential(ManagedIdentityId.SystemAssigned);
            var token = await credential.GetTokenAsync(
                new TokenRequestContext(["https://management.azure.com/.default"]),
                cancellationToken);
            sw.Stop();

            return new DependencyStatus
            {
                Status = DependencyHealth.Healthy,
                Message = $"Token acquired, expires {token.ExpiresOn:u}",
                DurationMs = sw.ElapsedMilliseconds
            };
        }
        catch (Exception ex)
        {
            sw.Stop();
            return new DependencyStatus
            {
                Status = DependencyHealth.Unhealthy,
                Message = ex.Message,
                Error = ex.GetType().Name,
                DurationMs = sw.ElapsedMilliseconds
            };
        }
    }

    public async Task<DependencyStatus> CheckCosmosDbAsync(CancellationToken cancellationToken)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            var account = await _cosmosClient.ReadAccountAsync();
            sw.Stop();

            return new DependencyStatus
            {
                Status = DependencyHealth.Healthy,
                Message = $"Connected to {account.Id}",
                DurationMs = sw.ElapsedMilliseconds
            };
        }
        catch (Exception ex)
        {
            sw.Stop();

            // Unwrap aggregate exceptions from DefaultAzureCredential to surface root cause
            var rootMessage = ex is AuthenticationFailedException or CredentialUnavailableException
                ? ex.Message
                : ex.InnerException?.Message ?? ex.Message;

            return new DependencyStatus
            {
                Status = DependencyHealth.Unhealthy,
                Message = rootMessage.Length > 500 ? rootMessage[..500] : rootMessage,
                Error = ex.GetType().Name,
                DurationMs = sw.ElapsedMilliseconds
            };
        }
    }

    public DependencyStatus CheckAiFoundry()
    {
        if (_chatClient is null)
        {
            return new DependencyStatus
            {
                Status = DependencyHealth.Degraded,
                Message = "IChatClient not registered — AI analysis unavailable",
                DurationMs = 0
            };
        }

        var metadata = _chatClient.GetService<ChatClientMetadata>();
        return new DependencyStatus
        {
            Status = DependencyHealth.Healthy,
            Message = $"Configured: endpoint={metadata?.ProviderUri}, model={metadata?.DefaultModelId}",
            DurationMs = 0
        };
    }
}

[ApiController]
[Route("api/[controller]")]
public sealed class StatusController : ControllerBase
{
    private readonly IDependencyChecker _checker;
    private readonly ILogger<StatusController> _logger;

    public StatusController(
        IDependencyChecker checker,
        ILogger<StatusController> logger)
    {
        _checker = checker;
        _logger = logger;
    }

    /// <summary>
    /// Returns detailed status of all API dependencies for diagnostics.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<StatusResponse>> GetStatus(CancellationToken cancellationToken)
    {
        var response = new StatusResponse
        {
            Timestamp = DateTimeOffset.UtcNow,
            Environment = System.Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Unknown",
            ManagedIdentity = await _checker.CheckManagedIdentityAsync(cancellationToken),
            CosmosDb = await _checker.CheckCosmosDbAsync(cancellationToken),
            AiFoundry = _checker.CheckAiFoundry()
        };

        response.Overall = response.ManagedIdentity.Status == DependencyHealth.Healthy
            && response.CosmosDb.Status == DependencyHealth.Healthy
                ? DependencyHealth.Healthy
                : DependencyHealth.Unhealthy;

        var statusCode = response.Overall == DependencyHealth.Healthy ? 200 : 503;
        _logger.LogInformation("Status check: Overall={Overall}, CosmosDb={CosmosDb}, ManagedIdentity={ManagedIdentity}, AiFoundry={AiFoundry}",
            response.Overall, response.CosmosDb.Status, response.ManagedIdentity.Status, response.AiFoundry.Status);

        return StatusCode(statusCode, response);
    }
}
