namespace AIStudy_App.Models;

public sealed class CourseKnowledgeBase
{
    public CourseKnowledgeBase(Guid id, string name, DateTime createdAtUtc, DateTime updatedAtUtc)
    {
        Id = id;
        Name = name;
        CreatedAtUtc = createdAtUtc;
        UpdatedAtUtc = updatedAtUtc;
    }

    public Guid Id { get; set; }

    public string Name { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; }
}
