using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SnowballStacker.Data;
using SnowballStacker.Models;

namespace SnowballStacker.Controllers;

public class HomeController : Controller
{
    private readonly GameDbContext _context;

    public HomeController(GameDbContext context)
    {
        _context = context;
    }

    public async Task<IActionResult> Index()
    {
        var topScores = await _context.GameScores
            .Include(s => s.Player)
            .OrderByDescending(s => s.Score)
            .Take(10)
            .Select(s => new LeaderboardEntry
            {
                PlayerName = s.Player!.Name,
                Score = s.Score,
                BlocksStacked = s.BlocksStacked,
                PlayedAt = s.PlayedAt
            })
            .ToListAsync();

        for (int i = 0; i < topScores.Count; i++)
        {
            topScores[i].Rank = i + 1;
        }

        var viewModel = new LeaderboardViewModel
        {
            TopScores = topScores
        };

        return View(viewModel);
    }

    [HttpPost]
    public async Task<IActionResult> StartGame(string playerName)
    {
        if (string.IsNullOrWhiteSpace(playerName))
        {
            return RedirectToAction("Index");
        }

        playerName = playerName.Trim();
        if (playerName.Length > 50)
        {
            playerName = playerName.Substring(0, 50);
        }

        var player = await _context.Players
            .FirstOrDefaultAsync(p => p.Name.ToLower() == playerName.ToLower());

        if (player == null)
        {
            player = new Player { Name = playerName };
            _context.Players.Add(player);
            await _context.SaveChangesAsync();
        }

        return RedirectToAction("Play", "Game", new { playerId = player.Id, playerName = player.Name });
    }

    public IActionResult Error()
    {
        return View();
    }

    [HttpPost]
    public async Task<IActionResult> ClearAllData()
    {
        // Clear all game scores first (due to foreign key constraint)
        _context.GameScores.RemoveRange(_context.GameScores);

        // Then clear all players
        _context.Players.RemoveRange(_context.Players);

        await _context.SaveChangesAsync();

        return RedirectToAction("Index");
    }
}
