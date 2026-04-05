using System.Text.Json.Serialization;

namespace Marginalia.Domain.Models;

public sealed record StatusResponse
{
    [JsonPropertyName("timestamp")]
    public DateTimeOffset Timestamp { get; init; }

    [JsonPropertyName("environment")]
    public string Environment { get; init; } = "";

    [JsonPropertyName("overall")]
    public DependencyHealth Overall { get; set; }

    [JsonPropertyName("managedIdentity")]
    public required DependencyStatus ManagedIdentity { get; init; }

    [JsonPropertyName("cosmosDb")]
    public required DependencyStatus CosmosDb { get; init; }

    [JsonPropertyName("aiFoundry")]
    public required DependencyStatus AiFoundry { get; init; }
}

public sealed record DependencyStatus
{
    [JsonPropertyName("status")]
    public DependencyHealth Status { get; init; }

    [JsonPropertyName("message")]
    public string Message { get; init; } = "";

    [JsonPropertyName("error")]
    public string? Error { get; init; }

    [JsonPropertyName("durationMs")]
    public long DurationMs { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum DependencyHealth
{
    Healthy,
    Degraded,
    Unhealthy
}
