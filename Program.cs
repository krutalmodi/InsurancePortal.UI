using System.Net.Http.Headers;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddHttpClient("services", client => client.Timeout = TimeSpan.FromSeconds(30))
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/ui/features", (IConfiguration configuration) => Results.Ok(new
{
    quoteCreationEnabled = configuration.GetValue<bool>("Features:QuoteCreationEnabled"),
    quotesEnabled = configuration.GetValue<bool>("Features:QuotesEnabled")
}));

app.Map("/api/{**path}", async (HttpContext context, IHttpClientFactory clients, IConfiguration configuration, ILogger<Program> logger) =>
{
    var path = context.Request.Path.Value ?? "";
    var method = context.Request.Method;
    var isIdentity = (method == "POST" && (path == "/api/auth/login" || path == "/api/auth/register")) ||
                     (method == "PATCH" && path == "/api/auth/me") ||
                     (method == "GET" && (path == "/api/auth/me" || path == "/api/auth/me/roles" || path == "/api/home/index"));
    var isQuoteCreate = method == "POST" && path == "/api/quotes";
    var isMyQuotes = method == "GET" && path == "/api/quotes/user";
    var isQuoteManagement =
        (method == "GET" && System.Text.RegularExpressions.Regex.IsMatch(path, @"^/api/quotes/[0-9a-fA-F-]{36}$")) ||
        (method == "POST" && System.Text.RegularExpressions.Regex.IsMatch(path, @"^/api/quotes/[0-9a-fA-F-]{36}/accept$"));
    var isLookup = method == "GET" &&
                   (path == "/api/lookups/countries" || path == "/api/lookups/location-types" ||
                    System.Text.RegularExpressions.Regex.IsMatch(path, @"^/api/lookups/countries/[0-9]{1,9}/provinces$"));
    var isQuoteLookup = method == "GET" &&
                        System.Text.RegularExpressions.Regex.IsMatch(path, @"^/api/lookups/(quote-statuses|product-types|product-quote-statuses|quoted-by-types|vehicle-colors|driving-record-types|home-types|health-statuses|coverage-types|smoking-statuses|currencies|insurance-providers|vehicle-makes|vehicle-models|vehicle-types)$");
    if (!isIdentity && !isQuoteCreate && !isQuoteManagement && !isLookup && !isQuoteLookup && !isMyQuotes)
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }
    var quotesEnabled = isQuoteManagement && configuration.GetValue<bool>("Features:QuotesEnabled");
    var creationEnabled = isQuoteCreate && configuration.GetValue<bool>("Features:QuoteCreationEnabled");
    if ((isQuoteManagement && !quotesEnabled) || (isQuoteCreate && !creationEnabled))
    {
        context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        await context.Response.WriteAsJsonAsync(new { error = "Quote services are not available yet." });
        return;
    }
    var isQuote = isQuoteCreate || isQuoteManagement;
    var serviceName = isIdentity ? "Identity" : isLookup ? "Location" : "Quote";
    var baseUrl = configuration[$"Services:{serviceName}"];
    if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var serviceUri) ||
        (serviceUri.Scheme != Uri.UriSchemeHttp && serviceUri.Scheme != Uri.UriSchemeHttps))
    {
        logger.LogError("Service URL is missing or invalid for {Service}", serviceName);
        context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        await context.Response.WriteAsJsonAsync(new { error = "The service is not configured." });
        return;
    }
    var upstream = new Uri(serviceUri, path);
    // Only a numeric vehicleMakeId filter is forwarded; other query values are dropped.
    if (isQuoteLookup && int.TryParse(context.Request.Query["vehicleMakeId"], out var makeId) && makeId > 0)
        upstream = new Uri(upstream, $"?vehicleMakeId={makeId}");
    using var request = new HttpRequestMessage(new HttpMethod(method), upstream);
    if (method == "POST" || method == "PATCH")
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
        logger.LogError(ex, "Could not reach {Service}", serviceName);
        context.Response.StatusCode = StatusCodes.Status502BadGateway;
        await context.Response.WriteAsJsonAsync(new { error = "The service is temporarily unavailable." });
    }
    catch (OperationCanceledException) when (!context.RequestAborted.IsCancellationRequested)
    {
        logger.LogWarning("Service request timed out for {Service}", serviceName);
        context.Response.StatusCode = StatusCodes.Status504GatewayTimeout;
        await context.Response.WriteAsJsonAsync(new { error = "The service request timed out." });
    }
});

app.MapFallbackToFile("index.html");
app.Run();
