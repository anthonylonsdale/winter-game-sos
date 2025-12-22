using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SnowballStacker.Data;
using SnowballStacker.Models;

namespace SnowballStacker.Controllers;

public class ArcadeController : Controller
{
    private readonly GameDbContext _context;
    private readonly IWebHostEnvironment _environment;
    private readonly IHttpClientFactory _httpClientFactory;

    // Manual ROM cover mappings (ROM name -> cover image path)
    // Add entries here to manually assign covers to ROMs
    private static readonly Dictionary<string, string> ManualCoverMappings = new(StringComparer.OrdinalIgnoreCase)
    {
        { "Clubhouse Games", "/roms/covers/Clubhouse_Games_cover.jpg" },
        { "Clubhouse_Games", "/roms/covers/Clubhouse_Games_cover.jpg" },
        // Mike Tyson's Punch-Out - all variations
        { "Mike Tyson's Punch-Out!!", "/roms/covers/Mike_Tysons_Punch_Out_cover.jpg" },
        { "Mike Tyson's Punch-Out!", "/roms/covers/Mike_Tysons_Punch_Out_cover.jpg" },
        { "Mike Tyson's Punch-Out", "/roms/covers/Mike_Tysons_Punch_Out_cover.jpg" },
        { "Mike Tysons Punch-Out!!", "/roms/covers/Mike_Tysons_Punch_Out_cover.jpg" },
        { "Mike Tysons Punch-Out!", "/roms/covers/Mike_Tysons_Punch_Out_cover.jpg" },
        { "Mike Tysons Punch-Out", "/roms/covers/Mike_Tysons_Punch_Out_cover.jpg" },
        { "Mike Tysons Punch Out", "/roms/covers/Mike_Tysons_Punch_Out_cover.jpg" },
        { "Mike Tyson's Punch Out", "/roms/covers/Mike_Tysons_Punch_Out_cover.jpg" },
        { "Mike_Tysons_Punch-Out", "/roms/covers/Mike_Tysons_Punch_Out_cover.jpg" },
        { "Mike_Tysons_Punch_Out", "/roms/covers/Mike_Tysons_Punch_Out_cover.jpg" },
        { "Punch-Out!!", "/roms/covers/Mike_Tysons_Punch_Out_cover.jpg" },
        { "Punch-Out!", "/roms/covers/Mike_Tysons_Punch_Out_cover.jpg" },
        { "Punch-Out", "/roms/covers/Mike_Tysons_Punch_Out_cover.jpg" },
        { "Punch Out", "/roms/covers/Mike_Tysons_Punch_Out_cover.jpg" },
        { "PunchOut", "/roms/covers/Mike_Tysons_Punch_Out_cover.jpg" },
        // New Super Mario Bros
        { "New Super Mario Bros", "/roms/covers/New_Super_Mario_Bros_cover.jpg" },
        { "New Super Mario Bros.", "/roms/covers/New_Super_Mario_Bros_cover.jpg" },
        { "New_Super_Mario_Bros", "/roms/covers/New_Super_Mario_Bros_cover.jpg" },
        // WarioWare
        { "WarioWare", "/roms/covers/Warioware_cover.jpg" },
        { "Warioware", "/roms/covers/Warioware_cover.jpg" },
        { "Wario Ware", "/roms/covers/Warioware_cover.jpg" },
        { "WarioWare Inc", "/roms/covers/Warioware_cover.jpg" },
        { "WarioWare, Inc.", "/roms/covers/Warioware_cover.jpg" },
        { "WarioWare Inc.", "/roms/covers/Warioware_cover.jpg" },
        { "WarioWare Touched", "/roms/covers/Warioware_cover.jpg" },
        { "WarioWare Touched!", "/roms/covers/Warioware_cover.jpg" },
        { "WarioWare: Touched!", "/roms/covers/Warioware_cover.jpg" },
        { "WarioWare - Touched!", "/roms/covers/Warioware_cover.jpg" },
    };

    public ArcadeController(GameDbContext context, IWebHostEnvironment environment, IHttpClientFactory httpClientFactory)
    {
        _context = context;
        _environment = environment;
        _httpClientFactory = httpClientFactory;
    }

    public async Task<IActionResult> Index()
    {
        // Scan roms directory and auto-register any new ROMs
        await ScanRomsDirectory();

        var romGames = await _context.RomGames
            .OrderByDescending(r => r.TimesPlayed)
            .ThenBy(r => r.Name)
            .ToListAsync();

        var viewModel = new ArcadeMenuViewModel
        {
            BuiltInGames = new List<ArcadeGame>
            {
                new ArcadeGame
                {
                    Id = "snowball-stacker",
                    Name = "Snowball Stacker",
                    Description = "Stack snowballs and build the tallest tower!",
                    CoverImage = "/images/covers/snowball-stacker.png",
                    GameType = "builtin",
                    Route = "/Home/Index"
                }
            },
            RomGames = romGames.Select(r => new ArcadeGame
            {
                Id = $"rom-{r.Id}",
                Name = r.Name,
                Description = r.Description ?? EmulatorCores.GetDisplayName(r.Core),
                CoverImage = GetCoverImage(r),
                GameType = "rom",
                RomId = r.Id,
                Core = r.Core
            }).ToList()
        };

        return View(viewModel);
    }

    private async Task ScanRomsDirectory()
    {
        var romsFolder = Path.Combine(_environment.WebRootPath, "roms");
        if (!Directory.Exists(romsFolder))
        {
            Directory.CreateDirectory(romsFolder);
            return;
        }

        // Note: .zip files are excluded from auto-scan since we can't determine the platform
        // Users should upload .zip ROMs via the "Add ROM" form and select the console type
        var allowedExtensions = new[] { ".nes", ".smc", ".sfc", ".gb", ".gbc", ".gba", ".nds", ".md", ".gen", ".bin", ".n64", ".z64", ".v64" };
        var romFiles = Directory.GetFiles(romsFolder)
            .Where(f => allowedExtensions.Contains(Path.GetExtension(f).ToLower()))
            .ToList();

        var existingFileNames = await _context.RomGames.Select(r => r.FileName).ToListAsync();

        foreach (var filePath in romFiles)
        {
            var fileName = Path.GetFileName(filePath);

            // Skip if already registered
            if (existingFileNames.Contains(fileName))
                continue;

            var extension = Path.GetExtension(fileName).ToLower();
            var core = EmulatorCores.GetCoreFromExtension(extension);
            var gameName = Path.GetFileNameWithoutExtension(fileName);

            // Clean up the name (remove common ROM naming conventions)
            gameName = CleanRomName(gameName);

            var romGame = new RomGame
            {
                Name = gameName,
                FileName = fileName,
                Core = core,
                Description = EmulatorCores.GetDisplayName(core)
            };

            _context.RomGames.Add(romGame);

            // Try to fetch cover art in the background
            _ = FetchCoverFromLibretro(gameName, core, fileName);
        }

        await _context.SaveChangesAsync();
    }

    private string CleanRomName(string name)
    {
        // Remove common ROM naming patterns like (U), [!], (USA), etc.
        var cleanName = System.Text.RegularExpressions.Regex.Replace(name, @"\s*[\(\[][^\)\]]*[\)\]]", "");
        cleanName = cleanName.Trim();
        return string.IsNullOrEmpty(cleanName) ? name : cleanName;
    }

    private string GetCoverImage(RomGame rom)
    {
        // Check manual mapping first
        if (!string.IsNullOrEmpty(rom.Name) && ManualCoverMappings.TryGetValue(rom.Name, out var manualCover))
        {
            return manualCover;
        }

        var romsFolder = Path.Combine(_environment.WebRootPath, "roms");
        var coversFolder = Path.Combine(romsFolder, "covers");
        var baseFileName = Path.GetFileNameWithoutExtension(rom.FileName);
        var imageExtensions = new[] { ".png", ".jpg", ".jpeg", ".gif", ".webp" };

        // Generate possible cover name variations based on game name
        var nameVariations = new List<string> { baseFileName };

        if (!string.IsNullOrEmpty(rom.Name))
        {
            // Add game name variations
            nameVariations.Add(rom.Name);
            nameVariations.Add(rom.Name.Replace(" ", "_"));
            nameVariations.Add(rom.Name.Replace(" ", "_") + "_cover");
            nameVariations.Add(rom.Name.Replace("'", "").Replace(" ", "_"));
            nameVariations.Add(rom.Name.Replace("'", "").Replace(" ", "_") + "_cover");
            nameVariations.Add(rom.Name.Replace(" ", ""));
            nameVariations.Add(rom.Name + "_cover");
        }

        // Check covers subdirectory first (preferred location)
        if (Directory.Exists(coversFolder))
        {
            foreach (var name in nameVariations)
            {
                foreach (var ext in imageExtensions)
                {
                    var coverPath = Path.Combine(coversFolder, name + ext);
                    if (System.IO.File.Exists(coverPath))
                    {
                        return $"/roms/covers/{name}{ext}";
                    }
                }
            }

            // Fuzzy match: scan covers folder for files containing the ROM name
            if (!string.IsNullOrEmpty(rom.Name))
            {
                var searchName = rom.Name.Replace(" ", "_").Replace("'", "");
                try
                {
                    var coverFiles = Directory.GetFiles(coversFolder);
                    foreach (var coverFile in coverFiles)
                    {
                        var fileName = Path.GetFileName(coverFile);
                        if (fileName.Contains(searchName, StringComparison.OrdinalIgnoreCase) ||
                            searchName.Contains(Path.GetFileNameWithoutExtension(fileName).Replace("_cover", ""), StringComparison.OrdinalIgnoreCase))
                        {
                            return $"/roms/covers/{fileName}";
                        }
                    }
                }
                catch { }
            }
        }

        // Check roms folder directly
        foreach (var name in nameVariations)
        {
            foreach (var ext in imageExtensions)
            {
                var coverPath = Path.Combine(romsFolder, name + ext);
                if (System.IO.File.Exists(coverPath))
                {
                    return $"/roms/{name}{ext}";
                }
            }
        }

        return rom.CoverImage ?? GetDefaultCover(rom.Core);
    }

    [HttpPost]
    public async Task<IActionResult> UploadRom(IFormFile romFile, string consoleType, string? gameName, string? description)
    {
        if (romFile == null || romFile.Length == 0)
        {
            TempData["Error"] = "Please select a ROM file to upload.";
            return RedirectToAction("Index");
        }

        if (string.IsNullOrWhiteSpace(consoleType))
        {
            TempData["Error"] = "Please select a console type.";
            return RedirectToAction("Index");
        }

        var allowedExtensions = new[] { ".zip", ".nes", ".smc", ".sfc", ".gb", ".gbc", ".gba", ".nds", ".md", ".gen", ".bin", ".n64", ".z64", ".v64" };
        var extension = Path.GetExtension(romFile.FileName).ToLower();

        if (!allowedExtensions.Contains(extension))
        {
            TempData["Error"] = "Invalid ROM file format.";
            return RedirectToAction("Index");
        }

        var romsFolder = Path.Combine(_environment.WebRootPath, "roms");
        if (!Directory.Exists(romsFolder))
        {
            Directory.CreateDirectory(romsFolder);
        }

        var fileName = $"{Guid.NewGuid()}{extension}";
        var filePath = Path.Combine(romsFolder, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await romFile.CopyToAsync(stream);
        }

        var romGame = new RomGame
        {
            Name = string.IsNullOrWhiteSpace(gameName) ? Path.GetFileNameWithoutExtension(romFile.FileName) : gameName.Trim(),
            FileName = fileName,
            Core = consoleType,
            Description = description?.Trim()
        };

        _context.RomGames.Add(romGame);
        await _context.SaveChangesAsync();

        // Try to fetch cover art from libretro-thumbnails
        await FetchCoverFromLibretro(romGame.Name, romGame.Core, romGame.FileName);

        TempData["Success"] = $"ROM '{romGame.Name}' uploaded successfully!";
        return RedirectToAction("Index");
    }

    [HttpPost]
    public async Task<IActionResult> DeleteRom(int id)
    {
        var rom = await _context.RomGames.FindAsync(id);
        if (rom != null)
        {
            var filePath = Path.Combine(_environment.WebRootPath, "roms", rom.FileName);
            if (System.IO.File.Exists(filePath))
            {
                System.IO.File.Delete(filePath);
            }

            // Also delete cover image if it exists
            var baseFileName = Path.GetFileNameWithoutExtension(rom.FileName);
            var coverPath = Path.Combine(_environment.WebRootPath, "roms", "covers", $"{baseFileName}.png");
            if (System.IO.File.Exists(coverPath))
            {
                System.IO.File.Delete(coverPath);
            }

            _context.RomGames.Remove(rom);
            await _context.SaveChangesAsync();
        }

        return RedirectToAction("Index");
    }

    // Debug endpoint to see ROM names (remove after debugging)
    [HttpGet]
    public async Task<IActionResult> DebugRoms()
    {
        var roms = await _context.RomGames.ToListAsync();
        var info = roms.Select(r => $"ID: {r.Id}, Name: '{r.Name}', File: {r.FileName}").ToList();
        return Content(string.Join("\n", info), "text/plain");
    }

    // Quick fix endpoint to update ROM core type
    [HttpGet]
    public async Task<IActionResult> FixRomCore(int id, string core)
    {
        var rom = await _context.RomGames.FindAsync(id);
        if (rom != null && !string.IsNullOrEmpty(core))
        {
            rom.Core = core;
            await _context.SaveChangesAsync();
            TempData["Success"] = $"Updated '{rom.Name}' to use {EmulatorCores.GetDisplayName(core)} core.";
        }
        return RedirectToAction("Index");
    }

    private string GetDefaultCover(string core)
    {
        return core switch
        {
            EmulatorCores.NES => "/images/covers/nes-default.png",
            EmulatorCores.SNES => "/images/covers/snes-default.png",
            EmulatorCores.GB => "/images/covers/gb-default.png",
            EmulatorCores.GBC => "/images/covers/gbc-default.png",
            EmulatorCores.GBA => "/images/covers/gba-default.png",
            EmulatorCores.GENESIS => "/images/covers/genesis-default.png",
            EmulatorCores.N64 => "/images/covers/n64-default.png",
            _ => "/images/covers/default.png"
        };
    }

    private async Task FetchCoverFromLibretro(string gameName, string core, string romFileName)
    {
        var systemName = GetLibretroSystemName(core);
        if (string.IsNullOrEmpty(systemName)) return;

        var coversFolder = Path.Combine(_environment.WebRootPath, "roms", "covers");
        if (!Directory.Exists(coversFolder))
        {
            Directory.CreateDirectory(coversFolder);
        }

        var baseFileName = Path.GetFileNameWithoutExtension(romFileName);
        var coverPath = Path.Combine(coversFolder, $"{baseFileName}.png");

        // Skip if cover already exists
        if (System.IO.File.Exists(coverPath)) return;

        try
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(10);

            // Try different name variations
            var nameVariations = GetNameVariations(gameName);

            foreach (var name in nameVariations)
            {
                // URL encode the game name for the URL
                var encodedName = Uri.EscapeDataString(name);
                var url = $"https://raw.githubusercontent.com/libretro-thumbnails/{Uri.EscapeDataString(systemName)}/master/Named_Boxarts/{encodedName}.png";

                try
                {
                    var response = await client.GetAsync(url);
                    if (response.IsSuccessStatusCode)
                    {
                        var imageBytes = await response.Content.ReadAsByteArrayAsync();
                        await System.IO.File.WriteAllBytesAsync(coverPath, imageBytes);
                        return; // Success - stop trying
                    }
                }
                catch
                {
                    // Try next variation
                }
            }
        }
        catch
        {
            // Silently fail - cover fetch is optional
        }
    }

    private string[] GetNameVariations(string gameName)
    {
        var variations = new List<string> { gameName };

        // Try with common suffixes/prefixes removed
        var cleaned = CleanRomName(gameName);
        if (cleaned != gameName)
            variations.Add(cleaned);

        // Try replacing underscores with spaces
        if (gameName.Contains('_'))
            variations.Add(gameName.Replace('_', ' '));

        // Try replacing hyphens with spaces
        if (gameName.Contains('-'))
            variations.Add(gameName.Replace('-', ' ').Replace("  ", " ").Trim());

        // Try title case
        var titleCase = System.Globalization.CultureInfo.CurrentCulture.TextInfo.ToTitleCase(gameName.ToLower());
        if (titleCase != gameName)
            variations.Add(titleCase);

        return variations.Distinct().ToArray();
    }

    private string? GetLibretroSystemName(string core)
    {
        return core switch
        {
            EmulatorCores.NES => "Nintendo - Nintendo Entertainment System",
            EmulatorCores.SNES => "Nintendo - Super Nintendo Entertainment System",
            EmulatorCores.GB => "Nintendo - Game Boy",
            EmulatorCores.GBC => "Nintendo - Game Boy Color",
            EmulatorCores.GBA => "Nintendo - Game Boy Advance",
            EmulatorCores.NDS => "Nintendo - Nintendo DS",
            EmulatorCores.GENESIS => "Sega - Mega Drive - Genesis",
            EmulatorCores.N64 => "Nintendo - Nintendo 64",
            EmulatorCores.PSX => "Sony - PlayStation",
            EmulatorCores.ATARI2600 => "Atari - 2600",
            _ => null
        };
    }
}
