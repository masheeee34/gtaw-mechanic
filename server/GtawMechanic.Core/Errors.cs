namespace GtawMechanic.Core
{
    /// <summary>Error codes sent to the client, which maps them to messages (client/src/messages.js).</summary>
    public static class Errors
    {
        public const string Forbidden = "forbidden";
        public const string UnknownGarage = "unknown_garage";
        public const string UnknownPart = "unknown_part";
        public const string NotInGarage = "not_in_garage";
        public const string VehicleNotFound = "vehicle_not_found";
        public const string TooFar = "too_far";
        public const string OutOfStock = "out_of_stock";
        public const string Busy = "busy";
        public const string NoPart = "no_part";
        public const string TooFarFromRack = "too_far_from_rack";
        public const string Database = "db_error";
        public const string DatabaseUnavailable = "db_unavailable";
    }
}
