using Microsoft.EntityFrameworkCore;
using SnowballStacker.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();
builder.Services.AddHttpClient();
builder.Services.AddDbContext<GameDbContext>(options =>
    options.UseSqlite("Data Source=snowballstacker.db"));

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();

// Add headers required for SharedArrayBuffer (enables multi-threading in EmulatorJS)
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("Cross-Origin-Opener-Policy", "same-origin");
    context.Response.Headers.Append("Cross-Origin-Embedder-Policy", "credentialless");
    await next();
});

// Configure static files with MIME types for ROM files
var provider = new Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider();
provider.Mappings[".zip"] = "application/zip";
provider.Mappings[".nes"] = "application/octet-stream";
provider.Mappings[".smc"] = "application/octet-stream";
provider.Mappings[".sfc"] = "application/octet-stream";
provider.Mappings[".gb"] = "application/octet-stream";
provider.Mappings[".gbc"] = "application/octet-stream";
provider.Mappings[".gba"] = "application/octet-stream";
provider.Mappings[".nds"] = "application/octet-stream";
provider.Mappings[".n64"] = "application/octet-stream";
provider.Mappings[".z64"] = "application/octet-stream";
provider.Mappings[".v64"] = "application/octet-stream";
provider.Mappings[".md"] = "application/octet-stream";
provider.Mappings[".gen"] = "application/octet-stream";

app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = provider
});

app.UseRouting();

app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Arcade}/{action=Index}/{id?}");

// Ensure database is created
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<GameDbContext>();
    context.Database.EnsureCreated();
}

app.Run();
