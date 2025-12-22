namespace SnowballStacker.Models;

public class RomGame
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string Core { get; set; } = string.Empty; // nes, snes, gba, genesis, etc.
    public string? Description { get; set; }
    public string? CoverImage { get; set; }
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
    public int TimesPlayed { get; set; } = 0;
}

public static class EmulatorCores
{
    public const string NES = "nes";
    public const string SNES = "snes";
    public const string GB = "gb";
    public const string GBA = "gba";
    public const string GBC = "gbc";
    public const string NDS = "nds";
    public const string GENESIS = "segaMD";
    public const string N64 = "n64";
    public const string PSX = "psx";
    public const string ATARI2600 = "atari2600";
    public const string ARCADE = "arcade";

    public static string GetCoreFromExtension(string extension)
    {
        return extension.ToLower() switch
        {
            ".nes" => NES,
            ".smc" or ".sfc" => SNES,
            ".gb" => GB,
            ".gbc" => GBC,
            ".gba" => GBA,
            ".nds" or ".ds" => NDS,
            ".md" or ".gen" or ".bin" => GENESIS,
            ".n64" or ".z64" or ".v64" => N64,
            ".iso" or ".cue" or ".pbp" => PSX,
            ".a26" => ATARI2600,
            ".zip" => ARCADE,
            _ => NES
        };
    }

    public static string GetDisplayName(string core)
    {
        return core switch
        {
            NES => "Nintendo (NES)",
            SNES => "Super Nintendo (SNES)",
            GB => "Game Boy",
            GBC => "Game Boy Color",
            GBA => "Game Boy Advance",
            NDS => "Nintendo DS",
            GENESIS => "Sega Genesis",
            N64 => "Nintendo 64",
            PSX => "PlayStation",
            ATARI2600 => "Atari 2600",
            ARCADE => "Arcade",
            _ => core.ToUpper()
        };
    }
}
