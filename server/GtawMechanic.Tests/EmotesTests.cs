using System;
using System.Collections.Generic;
using GtawMechanic.Core;
using Xunit;

namespace GtawMechanic.Tests
{
    public class EmotesTests
    {
        private static readonly MechanicConfig Config = new MechanicConfig
        {
            Parts = new List<PartConfig> { new PartConfig { Id = "tire_fl", Type = "tire", Item = "tire", Quantity = 1 } },
        };

        private DateTime _now = new DateTime(2026, 11, 5, 12, 0, 0, DateTimeKind.Utc);

        private Emotes Create() => new Emotes(Config, () => _now);

        [Fact]
        public void AcceptsKnownActionsOnKnownParts()
        {
            var emotes = Create();

            Assert.True(emotes.TryAccept("1", "inspect", ""));
            Assert.True(emotes.TryAccept("2", "take", "tire_fl"));
        }

        [Theory]
        [InlineData("dance", "tire_fl")]
        [InlineData(null, "tire_fl")]
        [InlineData("take", "rocket")]
        [InlineData("take", null)]
        [InlineData("inspect", "tire_fl")]
        public void RejectsUnknownActionsAndParts(string action, string partId)
        {
            Assert.False(Create().TryAccept("1", action, partId));
        }

        [Fact]
        public void RateLimitsEachPlayer()
        {
            var emotes = Create();

            Assert.True(emotes.TryAccept("1", "take", "tire_fl"));
            Assert.False(emotes.TryAccept("1", "install", "tire_fl"));
            Assert.True(emotes.TryAccept("2", "install", "tire_fl"));

            _now = _now.AddSeconds(1);
            Assert.True(emotes.TryAccept("1", "install", "tire_fl"));
        }
    }
}
