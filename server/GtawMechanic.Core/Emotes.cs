using System;
using System.Collections.Generic;

namespace GtawMechanic.Core
{
    /// <summary>
    /// The /ame lines the mechanic's actions show above their head, like GTA World's written roleplay.
    /// Clients only send an action and a part id; each client writes the French text from config.json,
    /// so a client can never make another player display free text.
    /// </summary>
    public sealed class Emotes
    {
        private static readonly HashSet<string> Actions = new HashSet<string>
        {
            "inspect", "take", "install", "remove", "refit", "done", "rushed", "failed", "abandon",
        };

        private readonly MechanicConfig _config;
        private readonly Cooldown _cooldown;

        public Emotes(MechanicConfig config, Func<DateTime> now)
        {
            _config = config;
            _cooldown = new Cooldown(TimeSpan.FromMilliseconds(750), now);
        }

        /// <summary>True when the emote is valid and the player is not spamming them.</summary>
        public bool TryAccept(string playerId, string action, string partId)
        {
            if (action == null || !Actions.Contains(action)) return false;
            var needsPart = action != "inspect";
            if (needsPart && _config.FindPart(partId) == null) return false;
            if (!needsPart && !string.IsNullOrEmpty(partId)) return false;
            return _cooldown.TryUse(playerId);
        }

        public void Forget(string playerId) => _cooldown.Forget(playerId);
    }
}
