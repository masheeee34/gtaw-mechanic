using GtawMechanic.Core.Data;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace GtawMechanic.Tests
{
    /// <summary>
    /// The game creates its tables from sql/install.sql while the tests use EF's own schema. This keeps
    /// both in sync: every table and column the EF model expects has to exist in the SQL file.
    /// </summary>
    public class SchemaTests
    {
        [Fact]
        public void InstallSql_DeclaresEveryTableAndColumnOfTheModel()
        {
            var sql = TestFiles.Read("install.sql");
            using (var database = new TestDatabase())
            using (var db = database.CreateContext())
            {
                foreach (var entity in db.Model.GetEntityTypes())
                {
                    Assert.Contains($"CREATE TABLE IF NOT EXISTS `{entity.GetTableName()}`", sql);
                    foreach (var property in entity.GetProperties())
                    {
                        Assert.Contains($"`{property.GetColumnName()}`", sql);
                    }
                }
            }
        }
    }
}
