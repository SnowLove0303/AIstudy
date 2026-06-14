using MySqlConnector;

namespace AIStudy_App.Data;

public sealed class MySqlConnectionFactory
{
    private const string ConnectionStringEnvironmentName = "AISTUDY_MYSQL_CONNECTION_STRING";
    private const string DefaultConnectionString = "Server=127.0.0.1;Port=3306;Database=aistudy;User ID=root;Password=;Allow User Variables=True;";

    public string ConnectionString { get; } =
        Environment.GetEnvironmentVariable(ConnectionStringEnvironmentName) ?? DefaultConnectionString;

    public string DatabaseName
    {
        get
        {
            var builder = new MySqlConnectionStringBuilder(ConnectionString);
            return string.IsNullOrWhiteSpace(builder.Database) ? "aistudy" : builder.Database;
        }
    }

    public async Task<MySqlConnection> OpenConnectionAsync(CancellationToken cancellationToken = default)
    {
        var connection = new MySqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }

    public async Task EnsureDatabaseAsync(CancellationToken cancellationToken = default)
    {
        var builder = new MySqlConnectionStringBuilder(ConnectionString);
        var databaseName = string.IsNullOrWhiteSpace(builder.Database) ? "aistudy" : builder.Database;
        builder.Database = string.Empty;

        await using var connection = new MySqlConnection(builder.ConnectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = $"CREATE DATABASE IF NOT EXISTS `{databaseName.Replace("`", "``")}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;";
        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}
