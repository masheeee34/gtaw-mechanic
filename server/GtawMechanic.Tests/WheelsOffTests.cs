using System.Linq;
using GtawMechanic.Core;
using Xunit;

namespace GtawMechanic.Tests
{
    public class WheelsOffTests
    {
        [Fact]
        public void OneMechanicAtATimeOnAVehicle()
        {
            var wheels = new WheelsOff();

            Assert.True(wheels.TrySet("1", 100, 0));
            Assert.True(wheels.TrySet("1", 100, 0));
            Assert.False(wheels.TrySet("2", 100, 1));
            Assert.True(wheels.TrySet("2", 200, 1));
        }

        [Fact]
        public void OnlyTheMechanicWhoTookTheWheelPutsItBack()
        {
            var wheels = new WheelsOff();
            wheels.TrySet("1", 100, 0);

            Assert.False(wheels.Clear("2", 100));
            Assert.True(wheels.Clear("1", 100));
            Assert.False(wheels.Clear("1", 100));
            Assert.True(wheels.TrySet("2", 100, 1));
        }

        [Fact]
        public void ADisconnectedMechanicGivesEveryWheelBack()
        {
            var wheels = new WheelsOff();
            wheels.TrySet("1", 100, 0);
            wheels.TrySet("1", 300, 5);
            wheels.TrySet("2", 200, 1);

            var cleared = wheels.ClearPlayer("1");

            Assert.Equal(new[] { 100, 300 }, cleared.OrderBy(id => id));
            Assert.Equal(new[] { 200 }, wheels.Snapshot().Select(entry => entry[0]));
            Assert.Empty(wheels.ClearPlayer("1"));
        }

        [Fact]
        public void TheSnapshotListsVehicleAndTyre_AndAResourceStopClearsEverything()
        {
            var wheels = new WheelsOff();
            wheels.TrySet("1", 100, 4);

            Assert.Equal(new[] { 100, 4 }, wheels.Snapshot().Single());
            Assert.Equal(new[] { 100 }, wheels.ClearAll());
            Assert.Empty(wheels.Snapshot());
        }
    }
}
