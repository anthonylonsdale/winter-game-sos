namespace SnowballStacker.Models;

public class Player
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<GameScore> Scores { get; set; } = new List<GameScore>();
}
