using System.Text.Json;
using System.Text.Json.Serialization;
using Azure.Identity;
using Marginalia.Domain.Configuration;
using Marginalia.Domain.Interfaces;
using Marginalia.Infrastructure.Repositories;
using Marginalia.Infrastructure.Services;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.AI;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

// LLM configuration — environment variables override appsettings
builder.Configuration.AddInMemoryCollection();
if (Environment.GetEnvironmentVariable("FOUNDRY_ENDPOINT") is { Length: > 0 } endpoint)
{
    builder.Configuration[$"{LlmEndpointOptions.SectionName}:Endpoint"] = endpoint;
}

if (Environment.GetEnvironmentVariable("FOUNDRY_MODEL_NAME") is { Length: > 0 } modelName)
{
    builder.Configuration[$"{LlmEndpointOptions.SectionName}:ModelName"] = modelName;
}

builder.Services.Configure<LlmEndpointOptions>(
    builder.Configuration.GetSection(LlmEndpointOptions.SectionName));

// Cosmos DB client
// Wait for managed identity to become available before constructing the credential.
// In ACA cold starts (scale from 0), the identity sidecar may not be ready immediately.
// DefaultAzureCredential permanently caches credential unavailability, so we probe first
// to ensure ManagedIdentityCredential will succeed when the CosmosClient uses it.
if (!builder.Environment.IsDevelopment())
{
    var probeLogger = LoggerFactory.Create(b => b.AddConsole()).CreateLogger("Startup");
    const int maxProbes = 20;
    for (var attempt = 1; attempt <= maxProbes; attempt++)
    {
        try
        {
            var probe = new ManagedIdentityCredential(ManagedIdentityId.SystemAssigned);
            await probe.GetTokenAsync(new Azure.Core.TokenRequestContext(["https://cosmos.azure.com/.default"]));
            probeLogger.LogInformation("Managed identity ready (attempt {Attempt}/{MaxProbes})", attempt, maxProbes);
            break;
        }
        catch (Exception ex) when (attempt < maxProbes)
        {
            probeLogger.LogWarning("Managed identity not ready (attempt {Attempt}/{MaxProbes}): {Error}", attempt, maxProbes, ex.Message);
            await Task.Delay(TimeSpan.FromSeconds(3));
        }
    }
}

builder.AddAzureCosmosClient("cosmos", configureClientOptions: options =>
{
    options.UseSystemTextJsonSerializerWithOptions = new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web);
});

// DI registrations — use Cosmos repositories
builder.Services.AddSingleton<IDocumentRepository>(sp =>
{
    var cosmosClient = sp.GetRequiredService<CosmosClient>();
    var logger = sp.GetRequiredService<ILogger<CosmosDocumentRepository>>();
    return new CosmosDocumentRepository(cosmosClient, logger);
});
builder.Services.AddSingleton<ISessionRepository>(sp =>
{
    var cosmosClient = sp.GetRequiredService<CosmosClient>();
    var logger = sp.GetRequiredService<ILogger<CosmosSessionRepository>>();
    return new CosmosSessionRepository(cosmosClient, logger);
});
builder.Services.AddSingleton<IWordDocumentService, WordDocumentService>();

// Aspire Azure AI Inference integration — active when running under Aspire AppHost
var aiConnectionString = builder.Configuration.GetConnectionString("ai-foundry");
if (!string.IsNullOrWhiteSpace(aiConnectionString))
{
    builder.AddAzureChatCompletionsClient("ai-foundry")
        .AddChatClient("reviewer");
    builder.Services.AddSingleton<ISuggestionService, FoundrySuggestionService>();
}
else
{
    builder.Services.AddSingleton<ISuggestionService, NoOpSuggestionService>();
}

// Controllers + JSON config
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

// OpenAPI / Swagger
builder.Services.AddOpenApi();

// CORS — allow any localhost port in dev; use CORS:AllowedOrigins in production
var corsAllowedOrigins = builder.Configuration["CORS:AllowedOrigins"] ?? "";

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        static bool IsLocalOrigin(string origin) =>
            Uri.TryCreate(origin, UriKind.Absolute, out var uri) && uri.Host is "localhost" or "127.0.0.1";

        if (string.IsNullOrEmpty(corsAllowedOrigins))
        {
            policy.SetIsOriginAllowed(IsLocalOrigin)
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        }
        else
        {
            var allowedOrigins = corsAllowedOrigins
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            policy.SetIsOriginAllowed(origin =>
                    IsLocalOrigin(origin) || allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase))
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        }
    });
});

// File upload size limit
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 52_428_800; // 50 MB
});

// Startup diagnostic logging
var startupLogger = LoggerFactory.Create(b => b.AddConsole()).CreateLogger("Startup");
startupLogger.LogInformation("AI Foundry connection string: {Status}",
    string.IsNullOrWhiteSpace(builder.Configuration.GetConnectionString("ai-foundry")) ? "(not set)" : "(set)");
startupLogger.LogInformation("FOUNDRY_ENDPOINT: {Status}",
    string.IsNullOrEmpty(Environment.GetEnvironmentVariable("FOUNDRY_ENDPOINT")) ? "(not set)" : "(set)");
startupLogger.LogInformation("CORS mode: {CorsMode}",
    string.IsNullOrEmpty(corsAllowedOrigins) ? "local dev (any localhost origin)" : "configured origins");
startupLogger.LogInformation("OTEL exporter endpoint: {Status}",
    string.IsNullOrEmpty(Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT")) ? "(not set)" : "(set)");

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();
app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.MapDefaultEndpoints();

app.Run();
