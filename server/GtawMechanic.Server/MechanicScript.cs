using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using CitizenFX.Core;
using CitizenFX.Core.Native;
using GtawMechanic.Core;
using GtawMechanic.Core.Data;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;

namespace GtawMechanic.Server
{
    /// <summary>
    /// Thin FiveM layer. The client does the diagnostics, animations, mini-games and the walking around;
    /// the server only checks what a client cannot be trusted with (permission, position, stock, which
    /// part the mechanic holds) and owns the database.
    /// </summary>
    public class MechanicScript : BaseScript
    {
        private const string EventPrefix = "gtaw-mechanic";
        private const string ConnectionConvar = "gtaw_mechanic_db";
        // Server-side positions lag a little behind the client's, so the checks get some slack.
        private const float PositionMargin = 4f;
        private const float RackReach = 3f;

        private static readonly JsonSerializerSettings JsonSettings = new JsonSerializerSettings
        {
            ContractResolver = new CamelCasePropertyNamesContractResolver(),
        };

        private readonly string _resourceName;
        private readonly MechanicConfig _config;
        private readonly MechanicService _service;
        private readonly PartsInHand _partsInHand = new PartsInHand();
        private readonly Emotes _emotes;
        private readonly Cooldown _noteCooldown;
        private bool _ready;

        public MechanicScript()
        {
            _resourceName = API.GetCurrentResourceName();
            _config = MechanicConfig.Parse(API.LoadResourceFile(_resourceName, "config.json"));
            _emotes = new Emotes(_config, () => DateTime.UtcNow);
            _noteCooldown = new Cooldown(TimeSpan.FromSeconds(1), () => DateTime.UtcNow);

            var connectionString = API.GetConvar(ConnectionConvar, string.Empty);
            var problem = string.IsNullOrWhiteSpace(connectionString)
                ? $"Définissez la convar {ConnectionConvar} avec une chaîne de connexion MySQL, par exemple " +
                  $"set {ConnectionConvar} \"Server=127.0.0.1;Database=gtaw;User=gtaw;Password=...;\""
                : ConnectionStringCheck.FindProblem(connectionString);
            if (problem != null)
            {
                Log($"^1{problem}^7");
            }
            else
            {
                var options = new DbContextOptionsBuilder<MechanicDbContext>().UseMySql(connectionString).Options;
                _service = new MechanicService(_config, () => new MechanicDbContext(options), () => DateTime.UtcNow);
                InitializeDatabase();
            }

            EventHandlers[$"{EventPrefix}:checkAccess"] += new Action<Player, int>(OnCheckAccess);
            EventHandlers[$"{EventPrefix}:openSession"] += new Action<Player, int, string, int>(OnOpenSession);
            EventHandlers[$"{EventPrefix}:takePart"] += new Action<Player, int, string, string>(OnTakePart);
            EventHandlers[$"{EventPrefix}:returnPart"] += new Action<Player, int>(OnReturnPart);
            EventHandlers[$"{EventPrefix}:repair"] += new Action<Player, int, string, int, string>(OnRepair);
            EventHandlers[$"{EventPrefix}:ame"] += new Action<Player, string, string>(OnEmote);
            EventHandlers[$"{EventPrefix}:addNote"] += new Action<Player, int, string, int, float, float, float, string>(OnAddNote);
            EventHandlers[$"{EventPrefix}:deleteNote"] += new Action<Player, int, string, int, long>(OnDeleteNote);
            EventHandlers["playerDropped"] += new Action<Player, string>(OnPlayerDropped);
            API.RegisterCommand("mecano_restock", new Action<int, List<object>, string>(OnRestock), true);
        }

        private async void InitializeDatabase()
        {
            try
            {
                await _service.InstallAsync(API.LoadResourceFile(_resourceName, "sql/install.sql"));
                await _service.EnsureStockAsync();
                _ready = true;
                Log("Base de données prête.");
            }
            catch (Exception exception)
            {
                Log($"^1Échec de l'initialisation de la base de données : {exception.Message}^7");
            }
        }

        // Event handlers are async void because FiveM invokes them fire-and-forget. Awaits resume on
        // FiveM's synchronization context, so natives and TriggerEvent are safe after them: no
        // ConfigureAwait(false) in this class.

        // Lets the client show the "[E] Inspect" prompt to mechanics only. Every action is still checked.
        private void OnCheckAccess([FromSource] Player player, int requestId)
        {
            Respond(player, requestId, Success(new { allowed = API.IsPlayerAceAllowed(player.Handle, _config.Permission) }));
        }

        private async void OnOpenSession([FromSource] Player player, int requestId, string garageId, int vehicleNetId)
        {
            var access = AuthorizeAtVehicle(player, garageId, vehicleNetId);
            if (access.Error != null)
            {
                Respond(player, requestId, Failure(access.Error));
                return;
            }

            try
            {
                var stock = await _service.GetStockAsync(access.Garage.Id);
                var history = await _service.GetHistoryAsync(access.Plate);
                var notes = await _service.GetNotesAsync(access.Plate);
                Respond(player, requestId, Success(new { plate = access.Plate, stock, history, notes }));
            }
            catch (Exception exception)
            {
                Log($"^1Échec de l'ouverture de l'inspection pour {player.Name} : {exception.Message}^7");
                Respond(player, requestId, Failure(Errors.Database));
            }
        }

        private async void OnTakePart([FromSource] Player player, int requestId, string garageId, string partId)
        {
            var access = AuthorizeAtGarage(player, garageId);
            if (access.Error != null)
            {
                Respond(player, requestId, Failure(access.Error));
                return;
            }
            var position = PlayerPosition(player);
            if (!access.Garage.IsNearRack(position.X, position.Y, position.Z, RackReach + PositionMargin))
            {
                Respond(player, requestId, Failure(Errors.TooFarFromRack));
                return;
            }

            // Reserved before the database call, so spamming the event cannot take two parts.
            if (!_partsInHand.TryHold(player.Handle, access.Garage.Id, partId))
            {
                Respond(player, requestId, Failure(Errors.Busy));
                return;
            }

            try
            {
                var result = await _service.TakePartsAsync(access.Garage.Id, partId);
                if (!result.Success)
                {
                    _partsInHand.Release(player.Handle);
                    Respond(player, requestId, Failure(result.Error));
                    return;
                }
                Respond(player, requestId, Success(new { stock = result.Stock }));
            }
            catch (Exception exception)
            {
                _partsInHand.Release(player.Handle);
                Log($"^1Échec de la prise de pièce pour {player.Name} : {exception.Message}^7");
                Respond(player, requestId, Failure(Errors.Database));
            }
        }

        private async void OnReturnPart([FromSource] Player player, int requestId)
        {
            try
            {
                var stock = await PutBackHeldPartAsync(player.Handle);
                Respond(player, requestId, Success(new { stock }));
            }
            catch (Exception exception)
            {
                Log($"^1Échec du retour de pièce pour {player.Name} : {exception.Message}^7");
                Respond(player, requestId, Failure(Errors.Database));
            }
        }

        private async void OnRepair([FromSource] Player player, int requestId, string garageId, int vehicleNetId, string partId)
        {
            var access = AuthorizeAtVehicle(player, garageId, vehicleNetId);
            if (access.Error != null)
            {
                Respond(player, requestId, Failure(access.Error));
                return;
            }
            if (!_partsInHand.Holds(player.Handle, access.Garage.Id, partId))
            {
                Respond(player, requestId, Failure(Errors.NoPart));
                return;
            }

            try
            {
                var mechanic = new MechanicIdentity(player.Identifiers["license"] ?? $"player:{player.Handle}", player.Name);
                var error = await _service.RecordRepairAsync(access.Garage.Id, partId, access.Plate, mechanic);
                if (error != null)
                {
                    Respond(player, requestId, Failure(error));
                    return;
                }

                _partsInHand.Release(player.Handle);
                var stock = await _service.GetStockAsync(access.Garage.Id);
                var history = await _service.GetHistoryAsync(access.Plate);
                Respond(player, requestId, Success(new { stock, history }));
            }
            catch (Exception exception)
            {
                Log($"^1Échec de la réparation pour {player.Name} : {exception.Message}^7");
                Respond(player, requestId, Failure(Errors.Database));
            }
        }

        // Notes pinned on the vehicle: same checks as opening the inspection, the plate read here, and
        // one change per second per player.
        private async void OnAddNote([FromSource] Player player, int requestId, string garageId, int vehicleNetId, float x, float y, float z, string text)
        {
            await ChangeNotes(player, requestId, garageId, vehicleNetId, plate => _service.AddNoteAsync(plate, x, y, z, text, player.Name));
        }

        private async void OnDeleteNote([FromSource] Player player, int requestId, string garageId, int vehicleNetId, long noteId)
        {
            await ChangeNotes(player, requestId, garageId, vehicleNetId, plate => _service.DeleteNoteAsync(plate, noteId));
        }

        private async Task ChangeNotes(Player player, int requestId, string garageId, int vehicleNetId, Func<string, Task<NotesResult>> change)
        {
            var access = AuthorizeAtVehicle(player, garageId, vehicleNetId);
            if (access.Error == null && !_noteCooldown.TryUse(player.Handle)) access = Access.Denied(Errors.TooFast);
            if (access.Error != null)
            {
                Respond(player, requestId, Failure(access.Error));
                return;
            }

            try
            {
                var result = await change(access.Plate);
                Respond(player, requestId, result.Success ? Success(new { notes = result.Notes }) : Failure(result.Error));
            }
            catch (Exception exception)
            {
                Log($"^1Échec de la mise à jour des notes pour {player.Name} : {exception.Message}^7");
                Respond(player, requestId, Failure(Errors.Database));
            }
        }

        // /ame: relays a mechanic's action to every client, which shows it above the head if close enough.
        private void OnEmote([FromSource] Player player, string action, string partId)
        {
            if (!API.IsPlayerAceAllowed(player.Handle, _config.Permission)) return;
            if (!_emotes.TryAccept(player.Handle, action, partId)) return;
            TriggerClientEvent($"{EventPrefix}:ame", int.Parse(player.Handle), player.Name, action, partId ?? string.Empty);
        }

        private async void OnPlayerDropped([FromSource] Player player, string reason)
        {
            _emotes.Forget(player.Handle);
            _noteCooldown.Forget(player.Handle);
            try
            {
                await PutBackHeldPartAsync(player.Handle);
            }
            catch (Exception exception)
            {
                Log($"^1Impossible de remettre en stock la pièce de {player.Name} : {exception.Message}^7");
            }
        }

        private async System.Threading.Tasks.Task<IReadOnlyList<StockEntry>> PutBackHeldPartAsync(string player)
        {
            var held = _partsInHand.Release(player);
            if (held == null || _service == null) return null;
            var result = await _service.ReturnPartsAsync(held.GarageId, held.PartId);
            return result.Stock;
        }

        /// <summary>Re-checks on the server what the client already checked: permission, then position.</summary>
        private Access AuthorizeAtGarage(Player player, string garageId)
        {
            if (!_ready) return Access.Denied(Errors.DatabaseUnavailable);
            if (!API.IsPlayerAceAllowed(player.Handle, _config.Permission)) return Access.Denied(Errors.Forbidden);

            var garage = _config.FindGarage(garageId);
            if (garage == null) return Access.Denied(Errors.UnknownGarage);

            var position = PlayerPosition(player);
            if (!garage.Contains(position.X, position.Y, position.Z, PositionMargin)) return Access.Denied(Errors.NotInGarage);
            return Access.Granted(garage, null);
        }

        private Access AuthorizeAtVehicle(Player player, string garageId, int vehicleNetId)
        {
            var access = AuthorizeAtGarage(player, garageId);
            if (access.Error != null) return access;

            var vehicle = API.NetworkGetEntityFromNetworkId(vehicleNetId);
            if (vehicle == 0 || !API.DoesEntityExist(vehicle)) return Access.Denied(Errors.VehicleNotFound);
            if (Vector3.Distance(PlayerPosition(player), API.GetEntityCoords(vehicle)) > _config.InteractionDistance + PositionMargin)
            {
                return Access.Denied(Errors.TooFar);
            }

            // The plate is read here rather than trusted from the client, since it keys the repair history.
            var plate = (API.GetVehicleNumberPlateText(vehicle) ?? string.Empty).Trim();
            return Access.Granted(access.Garage, plate);
        }

        private static Vector3 PlayerPosition(Player player) => API.GetEntityCoords(API.GetPlayerPed(player.Handle));

        private async void OnRestock(int source, List<object> args, string rawCommand)
        {
            if (args.Count != 3 || !int.TryParse(args[2].ToString(), out var amount))
            {
                Reply(source, "Utilisation : mecano_restock <garage> <article> <quantité>");
                return;
            }
            if (!_ready)
            {
                Reply(source, "La base de données n'est pas prête.");
                return;
            }

            var garageId = args[0].ToString();
            var itemId = args[1].ToString();
            try
            {
                var quantity = await _service.RestockAsync(garageId, itemId, amount);
                Reply(source, $"{garageId} : {itemId} passe à {quantity}.");
            }
            catch (ArgumentException exception)
            {
                Reply(source, exception.Message);
            }
            catch (Exception exception)
            {
                Log($"^1Échec de mecano_restock : {exception.Message}^7");
                Reply(source, "Le réapprovisionnement a échoué, voir la console du serveur.");
            }
        }

        private void Reply(int source, string message)
        {
            if (source == 0)
            {
                Log(message);
                return;
            }
            Players[source]?.TriggerEvent("chat:addMessage", new { args = new[] { "mécano", message } });
        }

        private static void Respond(Player player, int requestId, object payload) =>
            player.TriggerEvent($"{EventPrefix}:response", requestId, JsonConvert.SerializeObject(payload, JsonSettings));

        private static object Success(object data) => new { ok = true, data };

        private static object Failure(string error) => new { ok = false, error };

        private static void Log(string message) => Debug.WriteLine($"[{EventPrefix}] {message}");

        private sealed class Access
        {
            public string Error { get; private set; }
            public GarageConfig Garage { get; private set; }
            public string Plate { get; private set; }

            public static Access Denied(string error) => new Access { Error = error };

            public static Access Granted(GarageConfig garage, string plate) => new Access { Garage = garage, Plate = plate };
        }
    }
}
