using FluentAssertions;
using Marginalia.Api.Controllers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Marginalia.Tests.Unit.Controllers;

[TestClass]
[TestCategory("Unit")]
public sealed class StatusControllerTests
{
    private IDependencyChecker _checker = null!;
    private ILogger<StatusController> _logger = null!;
    private StatusController _controller = null!;

    [TestInitialize]
    public void Setup()
    {
        _checker = Substitute.For<IDependencyChecker>();
        _logger = Substitute.For<ILogger<StatusController>>();
        _controller = new StatusController(_checker, _logger);
    }

    [TestMethod]
    public async Task GetStatus_WhenAllDependenciesHealthy_Returns200()
    {
        var healthy = new DependencyStatus { Status = DependencyHealth.Healthy, Message = "OK" };
        _checker.CheckManagedIdentityAsync(Arg.Any<CancellationToken>()).Returns(healthy);
        _checker.CheckCosmosDbAsync(Arg.Any<CancellationToken>()).Returns(healthy);
        _checker.CheckAiFoundry().Returns(healthy);

        var result = await _controller.GetStatus(CancellationToken.None);

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(200);

        var status = objectResult.Value.Should().BeOfType<StatusResponse>().Subject;
        status.Overall.Should().Be(DependencyHealth.Healthy);
        status.CosmosDb.Status.Should().Be(DependencyHealth.Healthy);
        status.ManagedIdentity.Status.Should().Be(DependencyHealth.Healthy);
        status.AiFoundry.Status.Should().Be(DependencyHealth.Healthy);
    }

    [TestMethod]
    public async Task GetStatus_WhenCosmosDbUnhealthy_Returns503()
    {
        var healthy = new DependencyStatus { Status = DependencyHealth.Healthy, Message = "OK" };
        var unhealthy = new DependencyStatus
        {
            Status = DependencyHealth.Unhealthy,
            Message = "Auth failed",
            Error = "AuthenticationFailedException"
        };

        _checker.CheckManagedIdentityAsync(Arg.Any<CancellationToken>()).Returns(healthy);
        _checker.CheckCosmosDbAsync(Arg.Any<CancellationToken>()).Returns(unhealthy);
        _checker.CheckAiFoundry().Returns(healthy);

        var result = await _controller.GetStatus(CancellationToken.None);

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(503);

        var status = objectResult.Value.Should().BeOfType<StatusResponse>().Subject;
        status.Overall.Should().Be(DependencyHealth.Unhealthy);
        status.CosmosDb.Status.Should().Be(DependencyHealth.Unhealthy);
        status.CosmosDb.Error.Should().Be("AuthenticationFailedException");
    }

    [TestMethod]
    public async Task GetStatus_WhenManagedIdentityUnhealthy_Returns503()
    {
        var healthy = new DependencyStatus { Status = DependencyHealth.Healthy, Message = "OK" };
        var unhealthy = new DependencyStatus
        {
            Status = DependencyHealth.Unhealthy,
            Message = "Identity sidecar unavailable",
            Error = "CredentialUnavailableException"
        };

        _checker.CheckManagedIdentityAsync(Arg.Any<CancellationToken>()).Returns(unhealthy);
        _checker.CheckCosmosDbAsync(Arg.Any<CancellationToken>()).Returns(healthy);
        _checker.CheckAiFoundry().Returns(healthy);

        var result = await _controller.GetStatus(CancellationToken.None);

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(503);

        var status = objectResult.Value.Should().BeOfType<StatusResponse>().Subject;
        status.Overall.Should().Be(DependencyHealth.Unhealthy);
        status.ManagedIdentity.Status.Should().Be(DependencyHealth.Unhealthy);
    }

    [TestMethod]
    public async Task GetStatus_WhenAiFoundryDegraded_StillReturns200()
    {
        var healthy = new DependencyStatus { Status = DependencyHealth.Healthy, Message = "OK" };
        var degraded = new DependencyStatus
        {
            Status = DependencyHealth.Degraded,
            Message = "IChatClient not registered"
        };

        _checker.CheckManagedIdentityAsync(Arg.Any<CancellationToken>()).Returns(healthy);
        _checker.CheckCosmosDbAsync(Arg.Any<CancellationToken>()).Returns(healthy);
        _checker.CheckAiFoundry().Returns(degraded);

        var result = await _controller.GetStatus(CancellationToken.None);

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(200);

        var status = objectResult.Value.Should().BeOfType<StatusResponse>().Subject;
        status.Overall.Should().Be(DependencyHealth.Healthy);
        status.AiFoundry.Status.Should().Be(DependencyHealth.Degraded);
    }

    [TestMethod]
    public async Task GetStatus_WhenBothCosmosAndIdentityUnhealthy_Returns503()
    {
        var unhealthy = new DependencyStatus
        {
            Status = DependencyHealth.Unhealthy,
            Message = "Failed",
            Error = "Exception"
        };

        _checker.CheckManagedIdentityAsync(Arg.Any<CancellationToken>()).Returns(unhealthy);
        _checker.CheckCosmosDbAsync(Arg.Any<CancellationToken>()).Returns(unhealthy);
        _checker.CheckAiFoundry().Returns(unhealthy);

        var result = await _controller.GetStatus(CancellationToken.None);

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(503);

        var status = objectResult.Value.Should().BeOfType<StatusResponse>().Subject;
        status.Overall.Should().Be(DependencyHealth.Unhealthy);
    }

    [TestMethod]
    public async Task GetStatus_SetsTimestampAndEnvironment()
    {
        var healthy = new DependencyStatus { Status = DependencyHealth.Healthy, Message = "OK" };
        _checker.CheckManagedIdentityAsync(Arg.Any<CancellationToken>()).Returns(healthy);
        _checker.CheckCosmosDbAsync(Arg.Any<CancellationToken>()).Returns(healthy);
        _checker.CheckAiFoundry().Returns(healthy);

        var before = DateTimeOffset.UtcNow;
        var result = await _controller.GetStatus(CancellationToken.None);
        var after = DateTimeOffset.UtcNow;

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        var status = objectResult.Value.Should().BeOfType<StatusResponse>().Subject;
        status.Timestamp.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
    }
}
