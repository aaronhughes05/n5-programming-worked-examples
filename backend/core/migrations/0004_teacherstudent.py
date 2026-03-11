from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0003_userprogresssummary"),
    ]

    operations = [
        migrations.CreateModel(
            name="TeacherStudent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="student_teachers", to=settings.AUTH_USER_MODEL)),
                ("teacher", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="teacher_students", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ("teacher_id", "student_id"),
                "unique_together": {("teacher", "student")},
            },
        ),
    ]
