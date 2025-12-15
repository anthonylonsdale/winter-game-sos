namespace SnowballStacker.Models;

public class LeaderboardViewModel
{
    public List<LeaderboardEntry> TopScores { get; set; } = new();
    public List<LeaderboardEntry> RecentScores { get; set; } = new();
}

public class LeaderboardEntry
{
    public int Rank { get; set; }
    public string PlayerName { get; set; } = string.Empty;
    public int Score { get; set; }
    public int BlocksStacked { get; set; }
    public DateTime PlayedAt { get; set; }
}
