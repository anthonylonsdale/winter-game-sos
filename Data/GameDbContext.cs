using Microsoft.EntityFrameworkCore;
using SnowballStacker.Models;

namespace SnowballStacker.Data;

public class GameDbContext : DbContext
{
    public GameDbContext(DbContextOptions<GameDbContext> options) : base(options)
    {
    }

    public DbSet<Player> Players { get; set; }
    public DbSet<GameScore> GameScores { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Player>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(50);
            entity.HasIndex(e => e.Name);
        });

        modelBuilder.Entity<GameScore>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.Player)
                  .WithMany(p => p.Scores)
                  .HasForeignKey(e => e.PlayerId);
            entity.HasIndex(e => e.Score);
        });
    }
}
