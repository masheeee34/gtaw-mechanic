using System;
using System.Data.Common;
using System.Linq;

namespace GtawMechanic.Core
{
    /// <summary>
    /// MySqlConnector 0.69, the newest version Pomelo 3.2.7 accepts, can send the password in clear text to a
    /// man-in-the-middle when SslMode is VerifyCA or VerifyFull without a CA file (GHSA-473q-m89c-ghf8).
    /// The fix only exists in MySqlConnector 2.6.1, out of reach on FXServer, so that setup is refused instead.
    /// </summary>
    public static class ConnectionStringCheck
    {
        private static readonly string[] SslModeKeys = { "SslMode", "Ssl Mode", "Ssl-Mode" };
        private static readonly string[] SslCaKeys = { "SslCa", "Ssl-Ca", "Ssl Ca", "CACertificateFile", "CA Certificate File" };

        /// <returns>Why the connection string is unsafe, or null when it is fine.</returns>
        public static string FindProblem(string connectionString)
        {
            var builder = new DbConnectionStringBuilder { ConnectionString = connectionString };
            var sslMode = FirstValue(builder, SslModeKeys);
            var verifiesCertificate = string.Equals(sslMode, "VerifyCA", StringComparison.OrdinalIgnoreCase)
                || string.Equals(sslMode, "VerifyFull", StringComparison.OrdinalIgnoreCase);

            if (verifiesCertificate && string.IsNullOrWhiteSpace(FirstValue(builder, SslCaKeys)))
            {
                return $"SslMode={sslMode} sans SslCa peut divulguer le mot de passe de la base avec cette version de " +
                    "MySqlConnector (GHSA-473q-m89c-ghf8). Renseignez SslCa avec le certificat CA du serveur.";
            }
            return null;
        }

        private static string FirstValue(DbConnectionStringBuilder builder, string[] keys) =>
            keys.Select(key => builder.TryGetValue(key, out var value) ? value?.ToString() : null)
                .FirstOrDefault(value => value != null);
    }
}
