using System;
using System.Linq;
using System.Threading.Tasks;
using GtawMechanic.Core;
using GtawMechanic.Core.Data;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace GtawMechanic.Tests
{
    /// <summary>Runs only when GTAW_MECHANIC_TEST_DB holds a connection string to a disposable MySQL/MariaDB database.</summary>
    public sealed class MySqlFactAttribute : FactAttribute
    {
        public const string ConnectionVariable = "GTAW_MECHANIC_TEST_DB";

        public MySqlFactAttribute()
        {
            if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(ConnectionVariable)))
            {
                Skip = $"Set {ConnectionVariable} to a disposable MySQL/MariaDB database to run this test.";
            }
        }
    }

    /// <summary>
    /// Same path as in game: Pomelo, the shipped sql/install.sql and MechanicService. Each test drops the
    /// tables first, so the database must be one that only these tests use.
    /// </summary>
    [Collection("MySQL")]
    public class MySqlIntegrationTests
    {
        private static readonly MechanicIdentity Mechanic = new MechanicIdentity("license:abc", "Alex Moreau");
        private static readonly DateTime RepairTime = new DateTime(2026, 11, 4, 20, 0, 0, DateTimeKind.Utc);

        private readonly MechanicConfig _config = TestFiles.ShippedConfig();
        private readonly DbContextOptions<MechanicDbContext> _options = new DbContextOptionsBuilder<MechanicDbContext>()
            .UseMySql(Environment.GetEnvironmentVariable(MySqlFactAttribute.ConnectionVariable) ?? string.Empty)
            .Options;

        private MechanicService CreateService() =>
            new MechanicService(_config, () => new MechanicDbContext(_options), () => RepairTime);

        private async Task<MechanicService> FreshDatabaseAsync()
        {
            await ExecuteAsync("DROP TABLE IF EXISTS `mechanic_repairs`, `mechanic_stock`");
            var service = CreateService();
            await service.InstallAsync(TestFiles.Read("install.sql"));
            await service.EnsureStockAsync();
            return service;
        }

        private async Task ExecuteAsync(string sql)
        {
            using (var db = new MechanicDbContext(_options))
            {
                await db.Database.ExecuteSqlRawAsync(sql);
            }
        }

        [MySqlFact]
        public async Task InstallSql_CanRunOnEveryStart_AndStockIsSeededOnce()
        {
            var service = await FreshDatabaseAsync();
            await service.RestockAsync("burton", "tire", 3);

            await service.InstallAsync(TestFiles.Read("install.sql"));
            await service.EnsureStockAsync();

            var tire = (await service.GetStockAsync("burton")).Single(entry => entry.ItemId == "tire");
            Assert.Equal(_config.StartingQuantity("tire") + 3, tire.Quantity);
        }

        [MySqlFact]
        public async Task FullRepair_TakesThePart_ThenLogsTheRepairInUtc()
        {
            var service = await FreshDatabaseAsync();

            var taken = await service.TakePartsAsync("burton", "body");
            var error = await service.RecordRepairAsync("burton", "body", "46EEK572", Mechanic);

            Assert.True(taken.Success);
            Assert.Null(error);
            Assert.Equal(_config.StartingQuantity("body_panel") - 2, taken.Stock.Single(entry => entry.ItemId == "body_panel").Quantity);
            var entry = Assert.Single(await service.GetHistoryAsync("46EEK572"));
            Assert.Equal(RepairTime, entry.RepairedAt);
            Assert.Equal(DateTimeKind.Utc, entry.RepairedAt.Kind);
        }

        [MySqlFact]
        public async Task ConcurrentTakes_OfTheLastItem_OnlyOneSucceeds()
        {
            var service = await FreshDatabaseAsync();
            await ExecuteAsync("UPDATE `mechanic_stock` SET `quantity` = 1 WHERE `garage_id` = 'burton' AND `item_id` = 'tire'");

            var results = await Task.WhenAll(
                Enumerable.Range(0, 4).Select(_ => Task.Run(() => service.TakePartsAsync("burton", "tire_fl"))));

            Assert.Equal(1, results.Count(result => result.Success));
            Assert.All(results.Where(result => !result.Success), result => Assert.Equal(Errors.OutOfStock, result.Error));
            var tire = (await service.GetStockAsync("burton")).Single(entry => entry.ItemId == "tire");
            Assert.Equal(0, tire.Quantity);
        }
    }
}
