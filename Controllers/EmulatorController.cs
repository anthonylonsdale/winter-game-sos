using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SnowballStacker.Data;
using SnowballStacker.Models;

namespace SnowballStacker.Controllers;

public class EmulatorController : Controller
{
    private readonly GameDbContext _context;

    public EmulatorController(GameDbContext context)
    {
        _context = context;
    }

    public async Task<IActionResult> Play(int id)
    {
        var rom = await _context.RomGames.FindAsync(id);
        if (rom == null)
        {
            return RedirectToAction("Index", "Arcade");
        }

        rom.TimesPlayed++;
        await _context.SaveChangesAsync();

        ViewBag.RomName = rom.Name;
        ViewBag.RomFile = rom.FileName;
        ViewBag.Core = rom.Core;
        ViewBag.CoreDisplayName = EmulatorCores.GetDisplayName(rom.Core);

        return View(rom);
    }
}
