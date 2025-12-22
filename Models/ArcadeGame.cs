namespace SnowballStacker.Models;

public class ArcadeGame
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string CoverImage { get; set; } = string.Empty;
    public string GameType { get; set; } = string.Empty; // "builtin" or "rom"
    public string? Route { get; set; }
    public int? RomId { get; set; }
    public string? Core { get; set; }
}

public class ArcadeMenuViewModel
{
    public List<ArcadeGame> BuiltInGames { get; set; } = new();
    public List<ArcadeGame> RomGames { get; set; } = new();
    public string? PlayerName { get; set; }
}
