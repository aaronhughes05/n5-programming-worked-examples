from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0004_teacherstudent"),
    ]

    operations = [
        migrations.AlterField(
            model_name="activityprogress",
            name="activity_key",
            field=models.CharField(
                max_length=64,
                validators=[
                    django.core.validators.RegexValidator(
                        message="Activity key can only contain letters, numbers, underscore, period, and hyphen.",
                        regex="^[A-Za-z0-9][A-Za-z0-9_.-]*$",
                    )
                ],
            ),
        ),
        migrations.AddConstraint(
            model_name="activityprogress",
            constraint=models.CheckConstraint(
                check=models.Q(("step_index__lte", models.F("step_count"))),
                name="activityprogress_step_index_lte_step_count",
            ),
        ),
        migrations.AlterField(
            model_name="hintanalytics",
            name="activity_key",
            field=models.CharField(
                max_length=64,
                validators=[
                    django.core.validators.RegexValidator(
                        message="Activity key can only contain letters, numbers, underscore, period, and hyphen.",
                        regex="^[A-Za-z0-9][A-Za-z0-9_.-]*$",
                    )
                ],
            ),
        ),
        migrations.AlterField(
            model_name="hintanalytics",
            name="checkpoint_id",
            field=models.CharField(
                max_length=128,
                validators=[
                    django.core.validators.RegexValidator(
                        message="Checkpoint id can only contain letters, numbers, underscore, and hyphen.",
                        regex="^[A-Za-z0-9][A-Za-z0-9_-]*$",
                    )
                ],
            ),
        ),
        migrations.AlterField(
            model_name="hintanalytics",
            name="shown_level",
            field=models.PositiveSmallIntegerField(
                default=0,
                validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(3)],
            ),
        ),
        migrations.AddConstraint(
            model_name="hintanalytics",
            constraint=models.CheckConstraint(
                check=models.Q(("shown_level__gte", 0), ("shown_level__lte", 3)),
                name="hintanalytics_shown_level_range",
            ),
        ),
    ]
