using AIStudy_App.Models;
using System.Text.Json;

namespace AIStudy_App.Data;

public sealed class CourseKnowledgeBaseRepository
{
    private readonly MySqlConnectionFactory _connectionFactory;

    public CourseKnowledgeBaseRepository(MySqlConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await _connectionFactory.EnsureDatabaseAsync(cancellationToken);

        await using var connection = await _connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            CREATE TABLE IF NOT EXISTS courses (
                id VARCHAR(64) NOT NULL PRIMARY KEY,
                position_index INT NOT NULL DEFAULT 0,
                title VARCHAR(255) NOT NULL,
                category VARCHAR(255) NOT NULL DEFAULT '',
                description TEXT NULL,
                progress INT NOT NULL DEFAULT 0,
                created_at VARCHAR(64) NULL,
                payload_json LONGTEXT NOT NULL,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX ix_courses_updated_at (updated_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<CourseKnowledgeBase>> ListAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = await _connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT id, title, created_at, updated_at
            FROM courses
            ORDER BY position_index ASC, updated_at DESC;
            """;

        var courses = new List<CourseKnowledgeBase>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            courses.Add(new CourseKnowledgeBase(
                Guid.Parse(reader.GetString("id")),
                reader.GetString("title"),
                ParseCreatedAt(reader["created_at"]),
                DateTime.SpecifyKind(reader.GetDateTime("updated_at"), DateTimeKind.Utc)));
        }

        return courses;
    }

    public async Task<CourseKnowledgeBase> CreateAsync(string name, CancellationToken cancellationToken = default)
    {
        var trimmedName = name.Trim();
        if (trimmedName.Length == 0)
        {
            throw new ArgumentException("Name is required.", nameof(name));
        }

        var now = DateTime.UtcNow;
        var courseId = Guid.NewGuid();
        var course = new CourseKnowledgeBase(courseId, trimmedName, now, now);
        var payloadJson = CreateInitialPayloadJson(course);

        await using var connection = await _connectionFactory.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            INSERT INTO courses (
                id,
                position_index,
                title,
                category,
                description,
                progress,
                created_at,
                payload_json
            ) VALUES (
                @id,
                COALESCE((SELECT next_position FROM (SELECT COALESCE(MAX(position_index), -1) + 1 AS next_position FROM courses) AS next_value), 0),
                @title,
                '',
                NULL,
                0,
                @created_at,
                @payload_json
            );
            """;
        command.Parameters.AddWithValue("@id", course.Id.ToString());
        command.Parameters.AddWithValue("@title", course.Name);
        command.Parameters.AddWithValue("@created_at", course.CreatedAtUtc.ToString("O"));
        command.Parameters.AddWithValue("@payload_json", payloadJson);
        await command.ExecuteNonQueryAsync(cancellationToken);

        return course;
    }

    private static DateTime ParseCreatedAt(object value)
    {
        if (value is string text && DateTime.TryParse(text, out var parsed))
        {
            return DateTime.SpecifyKind(parsed.ToUniversalTime(), DateTimeKind.Utc);
        }

        return DateTime.MinValue;
    }

    private static string CreateInitialPayloadJson(CourseKnowledgeBase course)
    {
        var payload = new
        {
            id = course.Id.ToString(),
            title = course.Name,
            mindMap = new
            {
                nodeData = new
                {
                    id = "root",
                    title = course.Name,
                    children = Array.Empty<object>()
                }
            },
            knowledgePoints = new { },
            knowledgeDocuments = new { },
            createdAt = course.CreatedAtUtc.ToString("O"),
            updatedAt = course.UpdatedAtUtc.ToString("O")
        };

        return JsonSerializer.Serialize(payload);
    }
}
