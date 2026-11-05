using System;
using System.Collections.Generic;

namespace GtawMechanic.Core
{
    /// <summary>Rate limit per player: one action per delay.</summary>
    public sealed class Cooldown
    {
        private readonly TimeSpan _delay;
        private readonly Func<DateTime> _now;
        private readonly Dictionary<string, DateTime> _lastByPlayer = new Dictionary<string, DateTime>();

        public Cooldown(TimeSpan delay, Func<DateTime> now)
        {
            _delay = delay;
            _now = now;
        }

        /// <summary>True, and starts the delay, when the player may act again.</summary>
        public bool TryUse(string playerId)
        {
            var now = _now();
            if (_lastByPlayer.TryGetValue(playerId, out var last) && now - last < _delay) return false;
            _lastByPlayer[playerId] = now;
            return true;
        }

        public void Forget(string playerId) => _lastByPlayer.Remove(playerId);
    }
}
