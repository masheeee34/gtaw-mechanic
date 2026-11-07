using System.Linq;
using GtawMechanic.Core;
using Xunit;

namespace GtawMechanic.Tests
{
    public class PartsInHandTests
    {
        [Fact]
        public void APlayerHoldsOnePartAtATime()
        {
            var hands = new PartsInHand();

            Assert.True(hands.TryHold("1", "burton", "tire_fl"));
            Assert.False(hands.TryHold("1", "burton", "engine"));
            Assert.True(hands.TryHold("2", "burton", "engine"));
        }

        [Fact]
        public void ReleaseAll_GivesBackEveryHeldPart()
        {
            var hands = new PartsInHand();
            hands.TryHold("1", "burton", "tire_fl");
            hands.TryHold("2", "la_mesa", "engine");

            var parts = hands.ReleaseAll();

            Assert.Equal(new[] { "engine", "tire_fl" }, parts.Select(part => part.PartId).OrderBy(id => id));
            Assert.Null(hands.Get("1"));
            Assert.True(hands.TryHold("1", "burton", "body"));
        }

        [Fact]
        public void Holds_ChecksTheGarageAndThePart()
        {
            var hands = new PartsInHand();
            hands.TryHold("1", "burton", "tire_fl");

            Assert.True(hands.Holds("1", "burton", "tire_fl"));
            Assert.False(hands.Holds("1", "burton", "tire_fr"));
            Assert.False(hands.Holds("1", "la_mesa", "tire_fl"));
            Assert.False(hands.Holds("2", "burton", "tire_fl"));
        }

        [Fact]
        public void Release_ReturnsWhatWasHeld_Once()
        {
            var hands = new PartsInHand();
            hands.TryHold("1", "burton", "engine");

            var held = hands.Release("1");

            Assert.Equal("burton", held.GarageId);
            Assert.Equal("engine", held.PartId);
            Assert.Null(hands.Release("1"));
            Assert.True(hands.TryHold("1", "burton", "tire_fl"));
        }
    }
}
