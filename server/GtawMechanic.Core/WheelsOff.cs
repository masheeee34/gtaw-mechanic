using System.Collections.Generic;
using System.Linq;

namespace GtawMechanic.Core
{
    /// <summary>
    /// The wheels mechanics have taken off vehicles, by vehicle network id. The server owns this list and
    /// clears it when the mechanic puts the wheel back, gives up, disconnects or the resource stops, so a
    /// vehicle never stays without a wheel for everyone. Used from FiveM's main thread only.
    /// </summary>
    public sealed class WheelsOff
    {
        private sealed class Entry
        {
            public Entry(string player, int tyre)
            {
                Player = player;
                Tyre = tyre;
            }

            public string Player { get; }
            public int Tyre { get; }
        }

        private readonly Dictionary<int, Entry> _byVehicle = new Dictionary<int, Entry>();

        /// <returns>False when another mechanic already has a wheel off that vehicle.</returns>
        public bool TrySet(string player, int vehicleNetId, int tyre)
        {
            if (_byVehicle.TryGetValue(vehicleNetId, out var current) && current.Player != player) return false;
            _byVehicle[vehicleNetId] = new Entry(player, tyre);
            return true;
        }

        /// <returns>True when that player had a wheel off the vehicle.</returns>
        public bool Clear(string player, int vehicleNetId)
        {
            if (!_byVehicle.TryGetValue(vehicleNetId, out var current) || current.Player != player) return false;
            _byVehicle.Remove(vehicleNetId);
            return true;
        }

        /// <returns>The vehicles that get their wheel back.</returns>
        public IReadOnlyList<int> ClearPlayer(string player)
        {
            var vehicles = _byVehicle.Where(pair => pair.Value.Player == player).Select(pair => pair.Key).ToList();
            foreach (var vehicle in vehicles) _byVehicle.Remove(vehicle);
            return vehicles;
        }

        public IReadOnlyList<int> ClearAll()
        {
            var vehicles = _byVehicle.Keys.ToList();
            _byVehicle.Clear();
            return vehicles;
        }

        /// <summary>Vehicle network id and tyre index of every wheel currently off.</summary>
        public IReadOnlyList<int[]> Snapshot() => _byVehicle.Select(pair => new[] { pair.Key, pair.Value.Tyre }).ToList();
    }
}
