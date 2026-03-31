from django.db import migrations


def mark_existing_users_verified(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(phone_verified=False).update(phone_verified=True)


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_passenger_profile_and_phoneotp"),
    ]

    operations = [
        migrations.RunPython(mark_existing_users_verified, migrations.RunPython.noop),
    ]
