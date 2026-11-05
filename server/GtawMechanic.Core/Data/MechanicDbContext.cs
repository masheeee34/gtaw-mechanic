using System;
using Microsoft.EntityFrameworkCore;

namespace GtawMechanic.Core.Data
{
    public class GarageStock
    {
        public int Id { get; set; }
        public string GarageId { get; set; }
        public string ItemId { get; set; }
        public int Quantity { get; set; }
    }

    public class RepairRecord
    {
        public long Id { get; set; }
        public string GarageId { get; set; }
        public string Plate { get; set; }
        public string PartId { get; set; }
        public string MechanicIdentifier { get; set; }
        public string MechanicName { get; set; }
        public DateTime RepairedAt { get; set; }
    }

    /// <summary>
    /// Mapped to the tables created by sql/install.sql. Provider-agnostic: Pomelo (MySQL) in game,
    /// SQLite in the tests.
    /// </summary>
    public class MechanicDbContext : DbContext
    {
        public MechanicDbContext(DbContextOptions<MechanicDbContext> options)
            : base(options)
        {
        }

        public DbSet<GarageStock> Stock { get; set; }
        public DbSet<RepairRecord> Repairs { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<GarageStock>(entity =>
            {
                entity.ToTable("mechanic_stock");
                entity.HasKey(stock => stock.Id);
                entity.Property(stock => stock.Id).HasColumnName("id");
                entity.Property(stock => stock.GarageId).HasColumnName("garage_id").HasMaxLength(64).IsRequired();
                entity.Property(stock => stock.ItemId).HasColumnName("item_id").HasMaxLength(64).IsRequired();
                // Concurrency token: two mechanics using the last item at the same time cannot both succeed.
                entity.Property(stock => stock.Quantity).HasColumnName("quantity").IsConcurrencyToken();
                entity.HasIndex(stock => new { stock.GarageId, stock.ItemId }).IsUnique();
            });

            modelBuilder.Entity<RepairRecord>(entity =>
            {
                entity.ToTable("mechanic_repairs");
                entity.HasKey(record => record.Id);
                entity.Property(record => record.Id).HasColumnName("id");
                entity.Property(record => record.GarageId).HasColumnName("garage_id").HasMaxLength(64).IsRequired();
                entity.Property(record => record.Plate).HasColumnName("plate").HasMaxLength(16).IsRequired();
                entity.Property(record => record.PartId).HasColumnName("part_id").HasMaxLength(64).IsRequired();
                entity.Property(record => record.MechanicIdentifier).HasColumnName("mechanic_identifier").HasMaxLength(64).IsRequired();
                entity.Property(record => record.MechanicName).HasColumnName("mechanic_name").HasMaxLength(64).IsRequired();
                // Stored in UTC; flagged on read so JSON gets a "Z" suffix and the UI shows local time.
                entity.Property(record => record.RepairedAt)
                    .HasColumnName("repaired_at")
                    .HasConversion(value => value, value => DateTime.SpecifyKind(value, DateTimeKind.Utc));
                entity.HasIndex(record => record.Plate);
            });
        }
    }
}
