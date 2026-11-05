using System;
using System.IO;
using GtawMechanic.Core;
using GtawMechanic.Core.Data;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace GtawMechanic.Tests
{
    /// <summary>In-memory SQLite database that lives as long as the test. Relational, unlike the EF in-memory provider.</summary>
    public sealed class TestDatabase : IDisposable
    {
        private readonly SqliteConnection _connection;
        private readonly DbContextOptions<MechanicDbContext> _options;

        public TestDatabase()
        {
            _connection = new SqliteConnection("DataSource=:memory:");
            _connection.Open();
            _options = new DbContextOptionsBuilder<MechanicDbContext>().UseSqlite(_connection).Options;

            using (var db = CreateContext()) db.Database.EnsureCreated();
        }

        public MechanicDbContext CreateContext() => new MechanicDbContext(_options);

        public void Dispose() => _connection.Dispose();
    }

    public static class TestFiles
    {
        public static string Read(string name) => File.ReadAllText(Path.Combine(AppContext.BaseDirectory, name));

        public static MechanicConfig ShippedConfig() => MechanicConfig.Parse(Read("config.json"));
    }
}
