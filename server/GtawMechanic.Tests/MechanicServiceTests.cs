using System;
using System.Linq;
using System.Threading.Tasks;
using GtawMechanic.Core;
using GtawMechanic.Core.Data;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace GtawMechanic.Tests
{
    public sealed class MechanicServiceTests : IDisposable
    {
        private static readonly MechanicIdentity Mechanic = new MechanicIdentity("license:abc", "Alex Moreau");

        private readonly TestDatabase _database = new TestDatabase();
        private readonly MechanicConfig _config = TestFiles.ShippedConfig();
        private DateTime _now = new DateTime(2026, 11, 4, 20, 0, 0, DateTimeKind.Utc);

        public void Dispose() => _database.Dispose();

        private MechanicService CreateService() => new MechanicService(_config, _database.CreateContext, () => _now);

        // Test helpers stay synchronous: on .NET 10, EF Core 3.1's async LINQ clashes with System.Linq.AsyncEnumerable.
        private void SetStock(string garageId, string itemId, int quantity)
        {
            using (var db = _database.CreateContext())
            {
                db.Stock.Single(stock => stock.GarageId == garageId && stock.ItemId == itemId).Quantity = quantity;
                db.SaveChanges();
            }
        }

        private async Task<int> QuantityAsync(MechanicService service, string garageId, string itemId) =>
            (await service.GetStockAsync(garageId)).Single(entry => entry.ItemId == itemId).Quantity;

        [Fact]
        public async Task EnsureStock_SeedsStartingQuantities_ForEveryGarageAndItem()
        {
            await CreateService().EnsureStockAsync();

            using (var db = _database.CreateContext())
            {
                Assert.Equal(_config.Garages.Count * _config.Items.Count, db.Stock.Count());
            }
            var burton = await CreateService().GetStockAsync("burton");
            Assert.Equal(_config.Items.Keys, burton.Select(entry => entry.ItemId));
            Assert.Equal(_config.StartingQuantity("tire"), burton.Single(entry => entry.ItemId == "tire").Quantity);
        }

        [Fact]
        public async Task EnsureStock_KeepsExistingQuantities()
        {
            var service = CreateService();
            await service.EnsureStockAsync();
            SetStock("burton", "tire", 1);

            await service.EnsureStockAsync();

            Assert.Equal(1, await QuantityAsync(service, "burton", "tire"));
        }

        [Fact]
        public async Task TakeParts_TakesThePartsQuantityOffTheShelf()
        {
            var service = CreateService();
            await service.EnsureStockAsync();

            var result = await service.TakePartsAsync("burton", "body");

            Assert.True(result.Success);
            Assert.Equal(_config.StartingQuantity("body_panel") - 2, result.Stock.Single(entry => entry.ItemId == "body_panel").Quantity);
        }

        [Fact]
        public async Task TakeParts_OnlyTouchesTheGarageItWasTakenFrom()
        {
            var service = CreateService();
            await service.EnsureStockAsync();

            await service.TakePartsAsync("burton", "tire_fl");

            Assert.Equal(_config.StartingQuantity("tire"), await QuantityAsync(service, "la_mesa", "tire"));
        }

        [Fact]
        public async Task TakeParts_FailsWhenOutOfStock_AndChangesNothing()
        {
            var service = CreateService();
            await service.EnsureStockAsync();
            SetStock("burton", "body_panel", 1);

            var result = await service.TakePartsAsync("burton", "body");

            Assert.Equal(Errors.OutOfStock, result.Error);
            Assert.Equal(1, await QuantityAsync(service, "burton", "body_panel"));
        }

        [Fact]
        public async Task TakeParts_TheLastItemCannotBeTakenTwice()
        {
            var service = CreateService();
            await service.EnsureStockAsync();
            SetStock("burton", "tire", 1);

            var first = await service.TakePartsAsync("burton", "tire_fl");
            var second = await service.TakePartsAsync("burton", "tire_fr");

            Assert.True(first.Success);
            Assert.Equal(Errors.OutOfStock, second.Error);
        }

        [Fact]
        public async Task ReturnParts_PutsThePartsBackOnTheShelf()
        {
            var service = CreateService();
            await service.EnsureStockAsync();
            await service.TakePartsAsync("burton", "body");

            var result = await service.ReturnPartsAsync("burton", "body");

            Assert.True(result.Success);
            Assert.Equal(_config.StartingQuantity("body_panel"), await QuantityAsync(service, "burton", "body_panel"));
        }

        [Theory]
        [InlineData("nowhere", "engine", Errors.UnknownGarage)]
        [InlineData("burton", "turbo", Errors.UnknownPart)]
        public async Task StockMoves_RejectUnknownGarageOrPart(string garageId, string partId, string expected)
        {
            var service = CreateService();
            await service.EnsureStockAsync();

            Assert.Equal(expected, (await service.TakePartsAsync(garageId, partId)).Error);
            Assert.Equal(expected, (await service.ReturnPartsAsync(garageId, partId)).Error);
            Assert.Equal(expected, await service.RecordRepairAsync(garageId, partId, "46EEK572", Mechanic));
        }

        [Fact]
        public async Task RecordRepair_LogsTheRepairInUtc_WithoutTouchingStock()
        {
            var service = CreateService();
            await service.EnsureStockAsync();

            var error = await service.RecordRepairAsync("burton", "engine", "46EEK572", Mechanic);

            Assert.Null(error);
            var entry = Assert.Single(await service.GetHistoryAsync("46EEK572"));
            Assert.Equal("engine", entry.PartId);
            Assert.Equal("burton", entry.GarageId);
            Assert.Equal("Alex Moreau", entry.MechanicName);
            Assert.Equal(_now, entry.RepairedAt);
            Assert.Equal(DateTimeKind.Utc, entry.RepairedAt.Kind);
            Assert.Equal(_config.StartingQuantity("engine_parts"), await QuantityAsync(service, "burton", "engine_parts"));
        }

        [Fact]
        public async Task History_IsPerPlate_NewestFirst_AndLimited()
        {
            _config.HistoryLimit = 2;
            var service = CreateService();
            await service.EnsureStockAsync();

            foreach (var partId in new[] { "engine", "tire_fl", "tire_fr" })
            {
                await service.RecordRepairAsync("burton", partId, "46EEK572", Mechanic);
                _now = _now.AddMinutes(5);
            }
            await service.RecordRepairAsync("burton", "windows", "OTHERCAR", Mechanic);

            var history = await service.GetHistoryAsync("46EEK572");
            Assert.Equal(new[] { "tire_fr", "tire_fl" }, history.Select(entry => entry.PartId));
        }

        [Fact]
        public async Task Restock_AddsToTheExistingQuantity()
        {
            var service = CreateService();
            await service.EnsureStockAsync();

            var quantity = await service.RestockAsync("burton", "tire", 5);

            Assert.Equal(_config.StartingQuantity("tire") + 5, quantity);
        }

        [Fact]
        public async Task Restock_RejectsUnknownItemsAndNonPositiveAmounts()
        {
            var service = CreateService();

            var unknownItem = await Assert.ThrowsAsync<ArgumentException>(() => service.RestockAsync("burton", "turbo", 1));
            await Assert.ThrowsAsync<ArgumentException>(() => service.RestockAsync("nowhere", "tire", 1));
            var zero = await Assert.ThrowsAsync<ArgumentException>(() => service.RestockAsync("burton", "tire", 0));

            // These messages go straight to the admin's chat, so they must not carry a parameter name.
            Assert.Equal("Article inconnu « turbo ».", unknownItem.Message);
            Assert.Equal("La quantité doit être positive.", zero.Message);
        }
    }
}
