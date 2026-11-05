using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using GtawMechanic.Core.Data;
using Microsoft.EntityFrameworkCore;

namespace GtawMechanic.Core
{
    public sealed class MechanicIdentity
    {
        public MechanicIdentity(string identifier, string name)
        {
            Identifier = identifier;
            Name = name;
        }

        public string Identifier { get; }
        public string Name { get; }
    }

    public sealed class StockEntry
    {
        public string ItemId { get; set; }
        public int Quantity { get; set; }
    }

    public sealed class HistoryEntry
    {
        public long Id { get; set; }
        public string GarageId { get; set; }
        public string PartId { get; set; }
        public string MechanicName { get; set; }
        public DateTime RepairedAt { get; set; }
    }

    public sealed class NoteEntry
    {
        public long Id { get; set; }
        public float X { get; set; }
        public float Y { get; set; }
        public float Z { get; set; }
        public string Text { get; set; }
        public string Author { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public sealed class NotesResult
    {
        private NotesResult(string error, IReadOnlyList<NoteEntry> notes)
        {
            Error = error;
            Notes = notes;
        }

        public bool Success => Error == null;
        public string Error { get; }
        public IReadOnlyList<NoteEntry> Notes { get; }

        public static NotesResult Ok(IReadOnlyList<NoteEntry> notes) => new NotesResult(null, notes);

        public static NotesResult Fail(string error) => new NotesResult(error, Array.Empty<NoteEntry>());
    }

    public sealed class StockResult
    {
        private StockResult(string error, IReadOnlyList<StockEntry> stock)
        {
            Error = error;
            Stock = stock;
        }

        public bool Success => Error == null;
        public string Error { get; }
        public IReadOnlyList<StockEntry> Stock { get; }

        public static StockResult Ok(IReadOnlyList<StockEntry> stock) => new StockResult(null, stock);

        public static StockResult Fail(string error) => new StockResult(error, Array.Empty<StockEntry>());
    }

    /// <summary>
    /// Everything the server persists: garage stock and the repair log. No FiveM types, so it runs
    /// unchanged in the xUnit tests. A context is created per operation and disposed right after.
    /// </summary>
    public sealed class MechanicService
    {
        public const int MaxNoteLength = 200;
        public const int MaxNotesPerVehicle = 20;
        /// <summary>How far from the vehicle's origin a note may sit, in metres (local space).</summary>
        public const float MaxNoteOffset = 10f;

        private const int MaxSaveAttempts = 3;

        private readonly MechanicConfig _config;
        private readonly Func<MechanicDbContext> _createContext;
        private readonly Func<DateTime> _utcNow;

        public MechanicService(MechanicConfig config, Func<MechanicDbContext> createContext, Func<DateTime> utcNow)
        {
            _config = config;
            _createContext = createContext;
            _utcNow = utcNow;
        }

        /// <summary>Runs sql/install.sql. Every statement is idempotent (CREATE TABLE IF NOT EXISTS).</summary>
        public async Task InstallAsync(string sql)
        {
            if (string.IsNullOrWhiteSpace(sql)) throw new InvalidOperationException("sql/install.sql est introuvable ou vide.");

            using (var db = _createContext())
            {
                await db.Database.ExecuteSqlRawAsync(sql);
            }
        }

        /// <summary>Gives every garage its starting stock for items it has no row for yet. Existing quantities are kept.</summary>
        public async Task EnsureStockAsync()
        {
            using (var db = _createContext())
            {
                var existing = await db.Stock.Select(stock => new { stock.GarageId, stock.ItemId }).ToListAsync();
                var known = new HashSet<(string, string)>(existing.Select(stock => (stock.GarageId, stock.ItemId)));

                foreach (var garage in _config.Garages)
                {
                    foreach (var itemId in _config.Items.Keys.Where(itemId => !known.Contains((garage.Id, itemId))))
                    {
                        db.Stock.Add(new GarageStock
                        {
                            GarageId = garage.Id,
                            ItemId = itemId,
                            Quantity = _config.StartingQuantity(itemId),
                        });
                    }
                }

                await db.SaveChangesAsync();
            }
        }

        public async Task<IReadOnlyList<StockEntry>> GetStockAsync(string garageId)
        {
            using (var db = _createContext())
            {
                return await LoadStockAsync(db, garageId);
            }
        }

        public async Task<IReadOnlyList<HistoryEntry>> GetHistoryAsync(string plate)
        {
            using (var db = _createContext())
            {
                return await db.Repairs
                    .AsNoTracking()
                    .Where(record => record.Plate == plate)
                    .OrderByDescending(record => record.RepairedAt)
                    .ThenByDescending(record => record.Id)
                    .Take(_config.HistoryLimit)
                    .Select(record => new HistoryEntry
                    {
                        Id = record.Id,
                        GarageId = record.GarageId,
                        PartId = record.PartId,
                        MechanicName = record.MechanicName,
                        RepairedAt = record.RepairedAt,
                    })
                    .ToListAsync();
            }
        }

        /// <summary>
        /// Takes the parts a repair needs off the garage shelf. The mechanic then carries them to the
        /// vehicle: the repair is logged once they are installed (RecordRepairAsync), or the parts go
        /// back on the shelf if the job is abandoned (ReturnPartsAsync).
        /// </summary>
        public Task<StockResult> TakePartsAsync(string garageId, string partId) => MovePartsAsync(garageId, partId, -1);

        public Task<StockResult> ReturnPartsAsync(string garageId, string partId) => MovePartsAsync(garageId, partId, 1);

        public async Task<string> RecordRepairAsync(string garageId, string partId, string plate, MechanicIdentity mechanic)
        {
            if (_config.FindGarage(garageId) == null) return Errors.UnknownGarage;
            if (_config.FindPart(partId) == null) return Errors.UnknownPart;

            using (var db = _createContext())
            {
                db.Repairs.Add(new RepairRecord
                {
                    GarageId = garageId,
                    Plate = plate,
                    PartId = partId,
                    MechanicIdentifier = mechanic.Identifier,
                    MechanicName = mechanic.Name,
                    RepairedAt = _utcNow(),
                });
                await db.SaveChangesAsync();
                return null;
            }
        }

        // direction -1 takes the part's quantity off the shelf, +1 puts it back.
        private async Task<StockResult> MovePartsAsync(string garageId, string partId, int direction)
        {
            if (_config.FindGarage(garageId) == null) return StockResult.Fail(Errors.UnknownGarage);
            var part = _config.FindPart(partId);
            if (part == null) return StockResult.Fail(Errors.UnknownPart);

            using (var db = _createContext())
            {
                for (var attempt = 1; ; attempt++)
                {
                    var stock = await db.Stock.SingleOrDefaultAsync(row => row.GarageId == garageId && row.ItemId == part.Item);
                    if (stock == null)
                    {
                        if (direction < 0) return StockResult.Fail(Errors.OutOfStock);
                        stock = new GarageStock { GarageId = garageId, ItemId = part.Item };
                        db.Stock.Add(stock);
                    }

                    var quantity = stock.Quantity + direction * part.Quantity;
                    if (quantity < 0) return StockResult.Fail(Errors.OutOfStock);
                    stock.Quantity = quantity;

                    try
                    {
                        await db.SaveChangesAsync();
                        return StockResult.Ok(await LoadStockAsync(db, garageId));
                    }
                    catch (DbUpdateConcurrencyException) when (attempt < MaxSaveAttempts)
                    {
                        // Another mechanic used the same item in the meantime: start over from fresh values.
                        foreach (var entry in db.ChangeTracker.Entries().ToList()) entry.State = EntityState.Detached;
                    }
                }
            }
        }

        /// <summary>Adds items to a garage's stock (admin command). Returns the new quantity.</summary>
        public async Task<int> RestockAsync(string garageId, string itemId, int amount)
        {
            // Shown as-is to the admin who ran mecano_restock: no parameter name, which would append English text.
            if (_config.FindGarage(garageId) == null) throw new ArgumentException($"Garage inconnu « {garageId} ».");
            if (!_config.Items.ContainsKey(itemId)) throw new ArgumentException($"Article inconnu « {itemId} ».");
            if (amount <= 0) throw new ArgumentException("La quantité doit être positive.");

            using (var db = _createContext())
            {
                var stock = await db.Stock.SingleOrDefaultAsync(row => row.GarageId == garageId && row.ItemId == itemId);
                if (stock == null)
                {
                    stock = new GarageStock { GarageId = garageId, ItemId = itemId };
                    db.Stock.Add(stock);
                }

                stock.Quantity += amount;
                await db.SaveChangesAsync();
                return stock.Quantity;
            }
        }

        // Follows config order so the UI does not depend on insertion order. Items without a row count as empty.
        private async Task<IReadOnlyList<StockEntry>> LoadStockAsync(MechanicDbContext db, string garageId)
        {
            var rows = await db.Stock.AsNoTracking().Where(stock => stock.GarageId == garageId).ToListAsync();
            var quantities = rows.ToDictionary(stock => stock.ItemId, stock => stock.Quantity);
            return _config.Items.Keys
                .Select(itemId => new StockEntry
                {
                    ItemId = itemId,
                    Quantity = quantities.TryGetValue(itemId, out var quantity) ? quantity : 0,
                })
                .ToList();
        }

        public async Task<IReadOnlyList<NoteEntry>> GetNotesAsync(string plate)
        {
            using (var db = _createContext())
            {
                return await db.Notes
                    .AsNoTracking()
                    .Where(note => note.Plate == plate)
                    .OrderBy(note => note.CreatedAt)
                    .ThenBy(note => note.Id)
                    .Select(note => new NoteEntry
                    {
                        Id = note.Id,
                        X = note.X,
                        Y = note.Y,
                        Z = note.Z,
                        Text = note.Text,
                        Author = note.Author,
                        CreatedAt = note.CreatedAt,
                    })
                    .ToListAsync();
            }
        }

        /// <summary>
        /// Pins a note on a vehicle. The text is trimmed and kept on one line; the position must be close
        /// to the vehicle, and a vehicle holds a limited number of notes.
        /// </summary>
        public async Task<NotesResult> AddNoteAsync(string plate, float x, float y, float z, string text, string author)
        {
            var clean = CleanNote(text);
            if (clean == null || !IsNear(x) || !IsNear(y) || !IsNear(z)) return NotesResult.Fail(Errors.InvalidNote);

            using (var db = _createContext())
            {
                var count = await db.Notes.CountAsync(note => note.Plate == plate);
                if (count >= MaxNotesPerVehicle) return NotesResult.Fail(Errors.TooManyNotes);
                db.Notes.Add(new VehicleNote { Plate = plate, X = x, Y = y, Z = z, Text = clean, Author = author, CreatedAt = _utcNow() });
                await db.SaveChangesAsync();
            }
            return NotesResult.Ok(await GetNotesAsync(plate));
        }

        public async Task<NotesResult> DeleteNoteAsync(string plate, long noteId)
        {
            using (var db = _createContext())
            {
                var note = await db.Notes.FirstOrDefaultAsync(candidate => candidate.Id == noteId && candidate.Plate == plate);
                if (note == null) return NotesResult.Fail(Errors.NoteNotFound);
                db.Notes.Remove(note);
                await db.SaveChangesAsync();
            }
            return NotesResult.Ok(await GetNotesAsync(plate));
        }

        private static bool IsNear(float value) => !float.IsNaN(value) && Math.Abs(value) <= MaxNoteOffset;

        /// <summary>The note on one line, trimmed; null when empty or too long.</summary>
        public static string CleanNote(string text)
        {
            if (text == null) return null;
            var line = string.Join(" ", text.Split(new[] { '\r', '\n', '\t' }, StringSplitOptions.RemoveEmptyEntries)).Trim();
            return line.Length == 0 || line.Length > MaxNoteLength ? null : line;
        }
    }
}
