using GtawMechanic.Core;
using Xunit;

namespace GtawMechanic.Tests
{
    public class ConnectionStringCheckTests
    {
        [Theory]
        [InlineData("Server=127.0.0.1;Database=gtaw;User=gtaw;Password=secret;")]
        [InlineData("Server=db;Database=gtaw;User=gtaw;Password=secret;SslMode=Required;")]
        [InlineData("Server=db;Database=gtaw;User=gtaw;Password=secret;SslMode=VerifyFull;SslCa=C:\\certs\\ca.pem;")]
        [InlineData("Server=db;Database=gtaw;User=gtaw;Password=secret;Ssl Mode=VerifyCA;CA Certificate File=ca.pem;")]
        public void AcceptsSafeConnectionStrings(string connectionString)
        {
            Assert.Null(ConnectionStringCheck.FindProblem(connectionString));
        }

        [Theory]
        [InlineData("Server=db;Database=gtaw;User=gtaw;Password=secret;SslMode=VerifyFull;")]
        [InlineData("Server=db;Database=gtaw;User=gtaw;Password=secret;sslmode=verifyca;")]
        [InlineData("Server=db;Database=gtaw;User=gtaw;Password=secret;Ssl-Mode=VerifyCA;SslCa=;")]
        public void RefusesCertificateVerificationWithoutCaFile(string connectionString)
        {
            Assert.Contains("GHSA-473q-m89c-ghf8", ConnectionStringCheck.FindProblem(connectionString));
        }
    }
}
