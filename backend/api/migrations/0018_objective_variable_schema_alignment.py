from django.db import migrations, models


def add_field_if_missing(schema_editor, model, field_name, field):
    table_name = model._meta.db_table

    with schema_editor.connection.cursor() as cursor:
        existing_columns = {
            column.name
            for column in schema_editor.connection.introspection.get_table_description(cursor, table_name)
        }

    if field_name in existing_columns:
        return

    field.set_attributes_from_name(field_name)
    schema_editor.add_field(model, field)


def align_objective_variable_schema(apps, schema_editor):
    Echocardiogram = apps.get_model("api", "Echocardiogram")
    EchoFrameData = apps.get_model("api", "EchoFrameData")

    add_field_if_missing(
        schema_editor,
        Echocardiogram,
        "vo",
        models.FloatField(blank=True, null=True),
    )
    add_field_if_missing(
        schema_editor,
        Echocardiogram,
        "vo_frame_count",
        models.PositiveIntegerField(default=0),
    )
    add_field_if_missing(
        schema_editor,
        Echocardiogram,
        "vo_white_pixels",
        models.PositiveIntegerField(default=0),
    )
    add_field_if_missing(
        schema_editor,
        Echocardiogram,
        "vo_gray_pixels",
        models.PositiveIntegerField(default=0),
    )
    add_field_if_missing(
        schema_editor,
        Echocardiogram,
        "vo_roi_pixels",
        models.PositiveIntegerField(default=0),
    )
    add_field_if_missing(
        schema_editor,
        Echocardiogram,
        "vo_metadata",
        models.JSONField(default=dict, blank=True),
    )
    add_field_if_missing(
        schema_editor,
        EchoFrameData,
        "objective_variable",
        models.FloatField(blank=True, null=True),
    )
    add_field_if_missing(
        schema_editor,
        EchoFrameData,
        "white_pixel_count",
        models.PositiveIntegerField(blank=True, null=True),
    )
    add_field_if_missing(
        schema_editor,
        EchoFrameData,
        "gray_pixel_count",
        models.PositiveIntegerField(blank=True, null=True),
    )
    add_field_if_missing(
        schema_editor,
        EchoFrameData,
        "valid_pixel_count",
        models.PositiveIntegerField(blank=True, null=True),
    )


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0017_alter_echocardiogram_status"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(align_objective_variable_schema, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="echocardiogram",
                    name="vo",
                    field=models.FloatField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name="echocardiogram",
                    name="vo_frame_count",
                    field=models.PositiveIntegerField(default=0),
                ),
                migrations.AddField(
                    model_name="echocardiogram",
                    name="vo_white_pixels",
                    field=models.PositiveIntegerField(default=0),
                ),
                migrations.AddField(
                    model_name="echocardiogram",
                    name="vo_gray_pixels",
                    field=models.PositiveIntegerField(default=0),
                ),
                migrations.AddField(
                    model_name="echocardiogram",
                    name="vo_roi_pixels",
                    field=models.PositiveIntegerField(default=0),
                ),
                migrations.AddField(
                    model_name="echocardiogram",
                    name="vo_metadata",
                    field=models.JSONField(blank=True, default=dict),
                ),
                migrations.AddField(
                    model_name="echoframedata",
                    name="objective_variable",
                    field=models.FloatField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name="echoframedata",
                    name="white_pixel_count",
                    field=models.PositiveIntegerField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name="echoframedata",
                    name="gray_pixel_count",
                    field=models.PositiveIntegerField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name="echoframedata",
                    name="valid_pixel_count",
                    field=models.PositiveIntegerField(blank=True, null=True),
                ),
            ],
        ),
    ]
