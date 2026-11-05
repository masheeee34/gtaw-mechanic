using System.Collections.Generic;

namespace GtawMechanic.Core
{
    public sealed class HeldPart
    {
        public HeldPart(string garageId, string partId)
        {
            GarageId = garageId;
            PartId = partId;
        }

        public string GarageId { get; }
        public string PartId { get; }
    }

    /// <summary>
    /// The part each player took off a shelf and has not installed yet. The server only logs a repair for
    /// a part the player actually holds, and puts it back if they give up or disconnect.
    /// Used from FiveM's main thread only, so it needs no locking.
    /// </summary>
    public sealed class PartsInHand
    {
        private readonly Dictionary<string, HeldPart> _held = new Dictionary<string, HeldPart>();

        /// <returns>False when the player already holds a part: one job at a time.</returns>
        public bool TryHold(string player, string garageId, string partId)
        {
            if (_held.ContainsKey(player)) return false;
            _held[player] = new HeldPart(garageId, partId);
            return true;
        }

        public bool Holds(string player, string garageId, string partId) =>
            _held.TryGetValue(player, out var part) && part.GarageId == garageId && part.PartId == partId;

        /// <returns>The part the player was holding, or null.</returns>
        public HeldPart Release(string player)
        {
            if (!_held.TryGetValue(player, out var part)) return null;
            _held.Remove(player);
            return part;
        }
    }
}
