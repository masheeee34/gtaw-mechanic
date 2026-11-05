using System;
using System.Linq;
using System.Threading.Tasks;
using GtawMechanic.Core;
using Xunit;

namespace GtawMechanic.Tests
{
    public sealed class NotesTests : IDisposable
    {
        private readonly TestDatabase _database = new TestDatabase();
        private DateTime _now = new DateTime(2026, 11, 5, 18, 0, 0, DateTimeKind.Utc);

        private MechanicService CreateService() => new MechanicService(TestFiles.ShippedConfig(), _database.CreateContext, () => _now);

        public void Dispose() => _database.Dispose();

        [Fact]
        public async Task PinsNotesOnAVehicle_InOrder()
        {
            var service = CreateService();
            await service.AddNoteAsync("46EEK572", 0.9f, -0.4f, 0.2f, "Rayure portière AVD, déjà présente", "Alex Moreau");
            _now = _now.AddMinutes(5);
            var result = await service.AddNoteAsync("46EEK572", 0f, 1.8f, 0.5f, "Bruit de courroie au démarrage", "Jamie Ortega");

            Assert.True(result.Success);
            Assert.Equal(new[] { "Rayure portière AVD, déjà présente", "Bruit de courroie au démarrage" }, result.Notes.Select(note => note.Text));
            var first = result.Notes[0];
            Assert.Equal(0.9f, first.X);
            Assert.Equal("Alex Moreau", first.Author);
            Assert.Empty(await service.GetNotesAsync("OTHER"));
        }

        [Theory]
        [InlineData("   ")]
        [InlineData(null)]
        public async Task RejectsAnEmptyNote(string text)
        {
            var result = await CreateService().AddNoteAsync("46EEK572", 0f, 0f, 0f, text, "Alex Moreau");

            Assert.Equal(Errors.InvalidNote, result.Error);
        }

        [Fact]
        public async Task RejectsATooLongNote_OrOneFarFromTheVehicle()
        {
            var service = CreateService();

            Assert.Equal(Errors.InvalidNote, (await service.AddNoteAsync("46EEK572", 0f, 0f, 0f, new string('a', 201), "A")).Error);
            Assert.Equal(Errors.InvalidNote, (await service.AddNoteAsync("46EEK572", 50f, 0f, 0f, "Loin", "A")).Error);
            Assert.Equal(Errors.InvalidNote, (await service.AddNoteAsync("46EEK572", float.NaN, 0f, 0f, "NaN", "A")).Error);
        }

        [Fact]
        public void KeepsANoteOnOneLine()
        {
            Assert.Equal("Pneu AVG à surveiller", MechanicService.CleanNote("  Pneu AVG\r\nà surveiller\t"));
        }

        [Fact]
        public async Task LimitsTheNotesPerVehicle()
        {
            var service = CreateService();
            for (var index = 0; index < MechanicService.MaxNotesPerVehicle; index++)
            {
                Assert.True((await service.AddNoteAsync("46EEK572", 0f, 0f, 0f, $"Note {index}", "A")).Success);
            }

            Assert.Equal(Errors.TooManyNotes, (await service.AddNoteAsync("46EEK572", 0f, 0f, 0f, "Une de trop", "A")).Error);
        }

        [Fact]
        public async Task DeletesANote_OnlyOnItsOwnVehicle()
        {
            var service = CreateService();
            var note = (await service.AddNoteAsync("46EEK572", 0f, 0f, 0f, "À effacer", "A")).Notes.Single();

            Assert.Equal(Errors.NoteNotFound, (await service.DeleteNoteAsync("OTHER", note.Id)).Error);
            var result = await service.DeleteNoteAsync("46EEK572", note.Id);

            Assert.True(result.Success);
            Assert.Empty(result.Notes);
        }

        [Fact]
        public void Cooldown_AllowsOneActionPerDelayAndPlayer()
        {
            var now = _now;
            var cooldown = new Cooldown(TimeSpan.FromSeconds(1), () => now);

            Assert.True(cooldown.TryUse("1"));
            Assert.False(cooldown.TryUse("1"));
            Assert.True(cooldown.TryUse("2"));
            now = now.AddSeconds(1);
            Assert.True(cooldown.TryUse("1"));
        }
    }
}
