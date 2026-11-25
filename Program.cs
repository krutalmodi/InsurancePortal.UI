using System.Net.Http.Headers;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddHttpClient("services", client => client.Timeout = TimeSpan.FromSeconds(30))
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/ui/features", (IConfiguration configuration) => Results.Ok(new
{
    quotesEnabled = configuration.GetValue<bool>("Features:QuotesEnabled")
}));

app.Map("/api/{**path}", async (HttpContext context, IHttpClientFactory clients, IConfiguration configuration, ILogger<Program> logger) =>
{
    var path = context.Request.Path.Value ?? "";
    var method = context.Request.Method;
    var isIdentity = (method == "POST" && (path == "/api/auth/login" || path == "/api/auth/register")) ||
                     (method == "GET" && (path == "/api/auth/me" || path == "/api/auth/me/roles"));
    var isQuote = (method == "POST" && path == "/api/quotes") ||
                  (method == "GET" && System.Text.RegularExpressions.Regex.IsMatch(path, @"^/api/quotes/(user/)?[0-9a-fA-F-]{36}$")) ||
                  (method == "POST" && System.Text.RegularExpressions.Regex.IsMatch(path, @"^/api/quotes/[0-9a-fA-F-]{36}/accept$"));
    if (!isIdentity && !isQuote)
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }
    if (isQuote && !configuration.GetValue<bool>("Features:QuotesEnabled"))
    {
        context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        await context.Response.WriteAsJsonAsync(new { error = "Quote services are not available yet." });
        return;
    }
    var baseUrl = configuration[isIdentity ? "Services:Identity" : "Services:Quote"];
    if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var serviceUri) ||
        (serviceUri.Scheme != Uri.UriSchemeHttp && serviceUri.Scheme != Uri.UriSchemeHttps))
    {
        logger.LogError("Service URL is missing or invalid for {Service}", isIdentity ? "Identity" : "Quote");
        context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        await context.Response.WriteAsJsonAsync(new { error = "The service is not configured." });
        return;
    }
    using var request = new HttpRequestMessage(new HttpMethod(method), new Uri(serviceUri, path));
    if (method == "POST")
    {
        request.Content = new StreamContent(context.Request.Body);
        if (MediaTypeHeaderValue.TryParse(context.Request.ContentType, out var contentType))
            request.Content.Headers.ContentType = contentType;
    }
    if (AuthenticationHeaderValue.TryParse(context.Request.Headers.Authorization, out var authorization) && authorization.Scheme == "Bearer")
        request.Headers.Authorization = authorization;
    try
    {
        using var response = await clients.CreateClient("services").SendAsync(request, HttpCompletionOption.ResponseHeadersRead, context.RequestAborted);
        context.Response.StatusCode = (int)response.StatusCode;
        if (response.Content.Headers.ContentType != null)
            context.Response.ContentType = response.Content.Headers.ContentType.ToString();
        await response.Content.CopyToAsync(context.Response.Body, context.RequestAborted);
    }
    catch (HttpRequestException ex)
    {
        logger.LogError(ex, "Could not reach {Service}", isIdentity ? "Identity" : "Quote");
        context.Response.StatusCode = StatusCodes.Status502BadGateway;
        await context.Response.WriteAsJsonAsync(new { error = "The service is temporarily unavailable." });
    }
    catch (OperationCanceledException) when (!context.RequestAborted.IsCancellationRequested)
    {
        logger.LogWarning("Service request timed out for {Service}", isIdentity ? "Identity" : "Quote");
        context.Response.StatusCode = StatusCodes.Status504GatewayTimeout;
        await context.Response.WriteAsJsonAsync(new { error = "The service request timed out." });
    }
});

app.MapFallbackToFile("index.html");
app.Run();
