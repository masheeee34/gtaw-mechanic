using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;

namespace GtawMechanic.Core
{
    /// <summary>
    /// Server view of config.json. Only what the server needs is mapped: animations, mini-games and
    /// thresholds are client concerns and are ignored here.
    /// </summary>
    public sealed class MechanicConfig
    {
        public string Permission { get; set; } = "gtaw.mechanic";
        public float InteractionDistance { get; set; } = 6f;
        public int HistoryLimit { get; set; } = 25;
        public List<GarageConfig> Garages { get; set; } = new List<GarageConfig>();
        public Dictionary<string, ItemConfig> Items { get; set; } = new Dictionary<string, ItemConfig>();
        public Dictionary<string, int> StartingStock { get; set; } = new Dictionary<string, int>();
        public List<PartConfig> Parts { get; set; } = new List<PartConfig>();

        public static MechanicConfig Parse(string json)
        {
            if (string.IsNullOrWhiteSpace(json)) throw new InvalidOperationException("config.json est introuvable ou vide.");

            var config = JsonConvert.DeserializeObject<MechanicConfig>(json);
            if (config == null) throw new InvalidOperationException("config.json est vide.");
            config.Validate();
            return config;
        }

        public GarageConfig FindGarage(string id) => Garages.FirstOrDefault(garage => garage.Id == id);

        public PartConfig FindPart(string id) => Parts.FirstOrDefault(part => part.Id == id);

        public int StartingQuantity(string itemId) => StartingStock.TryGetValue(itemId, out var quantity) ? quantity : 0;

        private void Validate()
        {
            if (string.IsNullOrWhiteSpace(Permission)) Fail("permission est obligatoire.");
            if (HistoryLimit <= 0) Fail("historyLimit doit être positif.");
            if (Garages.Count == 0) Fail("il faut au moins un garage.");

            foreach (var garage in Garages)
            {
                if (string.IsNullOrWhiteSpace(garage.Id) || garage.Center == null || garage.Center.Length != 3 || garage.Radius <= 0)
                {
                    Fail($"le garage « {garage.Id} » doit avoir un id, un centre [x, y, z] et un rayon positif.");
                }
                if (garage.Rack != null && garage.Rack.Length != 3)
                {
                    Fail($"le stock du garage « {garage.Id} » doit être une position [x, y, z].");
                }
            }

            var duplicateGarage = Garages.GroupBy(garage => garage.Id).FirstOrDefault(group => group.Count() > 1);
            if (duplicateGarage != null) Fail($"le garage « {duplicateGarage.Key} » est en double.");

            if (Parts.Count == 0) Fail("il faut au moins une pièce.");
            foreach (var part in Parts)
            {
                if (!Items.ContainsKey(part.Item ?? string.Empty)) Fail($"la pièce « {part.Id} » utilise l'article inconnu « {part.Item} ».");
                if (part.Quantity <= 0) Fail($"la pièce « {part.Id} » doit avoir une quantité positive.");
            }

            var duplicatePart = Parts.GroupBy(part => part.Id).FirstOrDefault(group => group.Count() > 1);
            if (duplicatePart != null) Fail($"la pièce « {duplicatePart.Key} » est en double.");

            foreach (var entry in StartingStock)
            {
                if (!Items.ContainsKey(entry.Key)) Fail($"startingStock contient l'article inconnu « {entry.Key} ».");
                if (entry.Value < 0) Fail($"startingStock pour « {entry.Key} » ne peut pas être négatif.");
            }
        }

        private static void Fail(string message) => throw new InvalidOperationException($"config.json invalide : {message}");
    }

    public sealed class GarageConfig
    {
        public string Id { get; set; }
        public string Label { get; set; }
        public float[] Center { get; set; }
        public float Radius { get; set; }

        /// <summary>Where mechanics take their parts. Defaults to the center of the garage.</summary>
        public float[] Rack { get; set; }

        /// <param name="margin">Extra meters of tolerance, for positions that lag behind the client.</param>
        public bool Contains(float x, float y, float z, float margin = 0f) => Distance(Center, x, y, z) <= Radius + margin;

        public bool IsNearRack(float x, float y, float z, float reach) => Distance(Rack ?? Center, x, y, z) <= reach;

        private static double Distance(float[] point, float x, float y, float z)
        {
            var dx = x - point[0];
            var dy = y - point[1];
            var dz = z - point[2];
            return Math.Sqrt(dx * dx + dy * dy + dz * dz);
        }
    }

    public sealed class ItemConfig
    {
        public string Label { get; set; }
        public string Description { get; set; }
    }

    public sealed class PartConfig
    {
        public string Id { get; set; }
        public string Type { get; set; }
        public string Label { get; set; }
        public string Item { get; set; }
        public int Quantity { get; set; }
        /// <summary>GTA tyre index of a tire part (0, 1, 4 or 5); null for the other parts.</summary>
        public int? Wheel { get; set; }
    }
}
