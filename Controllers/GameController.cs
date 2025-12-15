using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SnowballStacker.Data;
using SnowballStacker.Models;

namespace SnowballStacker.Controllers;

public class GameController : Controller
{
    private readonly GameDbContext _context;

    public GameController(GameDbContext context)
    {
        _context = context;
    }

    public async Task<IActionResult> Play(int playerId, string playerName)
    {
        var player = await _context.Players.FindAsync(playerId);
        if (player == null)
        {
            return RedirectToAction("Index", "Home");
        }

        ViewBag.PlayerId = playerId;
        ViewBag.PlayerName = playerName;
        return View();
    }

    [HttpPost]
    public async Task<IActionResult> SaveScore([FromBody] SaveScoreRequest request)
    {
        try
        {
            var player = await _context.Players.FindAsync(request.PlayerId);
            if (player == null)
            {
                return Json(new { success = false, message = "Player not found" });
            }

            var gameScore = new GameScore
            {
                PlayerId = request.PlayerId,
                Score = request.Score,
                BlocksStacked = request.BlocksStacked,
                MaxHeight = request.MaxHeight,
                PlayedAt = DateTime.UtcNow
            };

            _context.GameScores.Add(gameScore);
            await _context.SaveChangesAsync();

            // Get player's rank
            var rank = await _context.GameScores
                .CountAsync(s => s.Score > request.Score) + 1;

            return Json(new {
                success = true,
                scoreId = gameScore.Id,
                rank = rank
            });
        }
        catch (Exception ex)
        {
            return Json(new { success = false, message = ex.Message });
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetLeaderboard()
    {
        var topScores = await _context.GameScores
            .Include(s => s.Player)
            .OrderByDescending(s => s.Score)
            .Take(10)
            .Select(s => new
            {
                playerName = s.Player!.Name,
                score = s.Score,
                blocksStacked = s.BlocksStacked,
                playedAt = s.PlayedAt
            })
            .ToListAsync();

        return Json(topScores);
    }
}

public class SaveScoreRequest
{
    public int PlayerId { get; set; }
    public int Score { get; set; }
    public int BlocksStacked { get; set; }
    public int MaxHeight { get; set; }
}
