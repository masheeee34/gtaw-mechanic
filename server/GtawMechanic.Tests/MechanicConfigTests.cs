using System;
using System.Linq;
using GtawMechanic.Core;
using Xunit;

namespace GtawMechanic.Tests
{
    public class MechanicConfigTests
    {
        private const string MinimalConfig = @"{
            ""garages"": [{ ""id"": ""burton"", ""label"": ""Burton"", ""center"": [0, 0, 0], ""radius"": 10 }],
            ""items"": { ""tire"": { ""label"": ""Tire"" } },
            ""startingStock"": { ""tire"": 4 },
            ""parts"": [{ ""id"": ""tire_fl"", ""type"": ""tire"", ""item"": ""tire"", ""quantity"": 1 }]
        }";

        [Fact]
        public void ShippedConfig_IsValid()
        {
            var config = TestFiles.ShippedConfig();

            Assert.NotEmpty(config.Garages);
            Assert.All(config.Parts, part => Assert.True(config.Items.ContainsKey(part.Item)));
            Assert.All(config.StartingStock.Keys, item => Assert.True(config.Items.ContainsKey(item)));
        }

        [Fact]
        public void Parse_ReadsServerFields_AndIgnoresClientOnlyOnes()
        {
            var config = MechanicConfig.Parse(MinimalConfig);

            Assert.Equal("gtaw.mechanic", config.Permission);
            Assert.Equal("tire", config.FindPart("tire_fl").Item);
            Assert.Equal(4, config.StartingQuantity("tire"));
            Assert.Equal(0, config.StartingQuantity("unknown"));
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Parse_RejectsMissingFile(string json)
        {
            Assert.Throws<InvalidOperationException>(() => MechanicConfig.Parse(json));
        }

        [Fact]
        public void Parse_RejectsPartWithUnknownItem()
        {
            var json = MinimalConfig.Replace(@"""item"": ""tire""", @"""item"": ""turbo""");

            var error = Assert.Throws<InvalidOperationException>(() => MechanicConfig.Parse(json));
            Assert.Contains("l'article inconnu « turbo »", error.Message);
        }

        [Fact]
        public void Parse_RejectsGarageWithoutRadius()
        {
            var json = MinimalConfig.Replace(@"""radius"": 10", @"""radius"": 0");

            Assert.Throws<InvalidOperationException>(() => MechanicConfig.Parse(json));
        }

        [Fact]
        public void Parse_RejectsDuplicatePartIds()
        {
            var part = @"{ ""id"": ""tire_fl"", ""type"": ""tire"", ""item"": ""tire"", ""quantity"": 1 }";
            var json = MinimalConfig.Replace(part, part + ", " + part);

            var error = Assert.Throws<InvalidOperationException>(() => MechanicConfig.Parse(json));
            Assert.Contains("« tire_fl » est en double", error.Message);
        }

        [Theory]
        [InlineData(0f, 0f, 0f, 0f, true)]
        [InlineData(10f, 0f, 0f, 0f, true)]
        [InlineData(10.5f, 0f, 0f, 0f, false)]
        [InlineData(10.5f, 0f, 0f, 1f, true)]
        [InlineData(6f, 6f, 6f, 0f, false)]
        public void Garage_Contains_UsesRadiusAndMargin(float x, float y, float z, float margin, bool expected)
        {
            var garage = MechanicConfig.Parse(MinimalConfig).Garages.Single();

            Assert.Equal(expected, garage.Contains(x, y, z, margin));
        }

        [Fact]
        public void Garage_Rack_DefaultsToTheCenter()
        {
            var garage = MechanicConfig.Parse(MinimalConfig).Garages.Single();

            Assert.True(garage.IsNearRack(1f, 1f, 0f, 3f));
            Assert.False(garage.IsNearRack(5f, 0f, 0f, 3f));
        }

        [Fact]
        public void Garage_Rack_UsesItsOwnPosition()
        {
            var json = MinimalConfig.Replace(@"""radius"": 10", @"""radius"": 10, ""rack"": [8, 0, 0]");
            var garage = MechanicConfig.Parse(json).Garages.Single();

            Assert.True(garage.IsNearRack(7f, 0f, 0f, 3f));
            Assert.False(garage.IsNearRack(0f, 0f, 0f, 3f));
        }

        [Fact]
        public void Parse_RejectsARackThatIsNotAPosition()
        {
            var json = MinimalConfig.Replace(@"""radius"": 10", @"""radius"": 10, ""rack"": [8, 0]");

            Assert.Throws<InvalidOperationException>(() => MechanicConfig.Parse(json));
        }
    }
}
