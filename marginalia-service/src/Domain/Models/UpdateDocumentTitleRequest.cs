using System.Text.Json.Serialization;

namespace Marginalia.Domain.Models;

/// <summary>
/// Request payload for updating a document's title.
/// </summary>
public sealed record UpdateDocumentTitleRequest
{
    [JsonPropertyName("title")]
    public required string Title { get; init; }
}
