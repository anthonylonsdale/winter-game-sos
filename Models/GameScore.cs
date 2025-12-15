namespace SnowballStacker.Models;

public class GameScore
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public Player? Player { get; set; }
    public int Score { get; set; }
    public int BlocksStacked { get; set; }
    public int MaxHeight { get; set; }
    public DateTime PlayedAt { get; set; } = DateTime.UtcNow;
}
