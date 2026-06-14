using System.Collections.ObjectModel;
using AIStudy_App.Data;
using AIStudy_App.Models;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;

namespace AIStudy_App.Pages;

public sealed partial class KnowledgeBasePage : Page
{
    private readonly CourseKnowledgeBaseRepository _repository = new(new MySqlConnectionFactory());
    private bool _initialized;

    public ObservableCollection<CourseKnowledgeBase> Courses { get; } = [];

    public KnowledgeBasePage()
    {
        InitializeComponent();
    }

    private async void Page_Loaded(object sender, RoutedEventArgs e)
    {
        await InitializeAndLoadAsync();
    }

    private async void CreateButton_Click(object sender, RoutedEventArgs e)
    {
        await CreateCourseAsync();
    }

    private async void RefreshButton_Click(object sender, RoutedEventArgs e)
    {
        await LoadCoursesAsync();
    }

    private async void CourseNameBox_KeyDown(object sender, KeyRoutedEventArgs e)
    {
        if (e.Key != Windows.System.VirtualKey.Enter)
        {
            return;
        }

        e.Handled = true;
        await CreateCourseAsync();
    }

    private async Task InitializeAndLoadAsync()
    {
        if (_initialized)
        {
            return;
        }

        try
        {
            await _repository.InitializeAsync();
            _initialized = true;
            await LoadCoursesAsync();
        }
        catch (Exception ex)
        {
            ShowDatabaseError(ex);
        }
    }

    private async Task LoadCoursesAsync()
    {
        try
        {
            DatabaseInfoBar.IsOpen = false;
            var courses = await _repository.ListAsync();
            Courses.Clear();
            foreach (var course in courses)
            {
                Courses.Add(course);
            }
        }
        catch (Exception ex)
        {
            ShowDatabaseError(ex);
        }
    }

    private async Task CreateCourseAsync()
    {
        var name = CourseNameBox.Text.Trim();
        if (name.Length == 0)
        {
            return;
        }

        try
        {
            DatabaseInfoBar.IsOpen = false;
            var course = await _repository.CreateAsync(name);
            Courses.Insert(0, course);
            CourseNameBox.Text = string.Empty;
        }
        catch (Exception ex)
        {
            ShowDatabaseError(ex);
        }
    }

    private void ShowDatabaseError(Exception exception)
    {
        DatabaseInfoBar.Title = "MySQL";
        DatabaseInfoBar.Message = exception.Message;
        DatabaseInfoBar.IsOpen = true;
    }
}

