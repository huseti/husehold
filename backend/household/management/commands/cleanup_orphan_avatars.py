from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from household.models import HouseholdMember


class Command(BaseCommand):
    help = (
        "Deletes files in MEDIA_ROOT/avatars/ that no HouseholdMember references "
        "anymore (left behind by avatar replacements before the serializer started "
        "cleaning them up). Dry run by default -- pass --delete to actually remove them."
    )

    def add_arguments(self, parser):
        parser.add_argument('--delete', action='store_true', help='Actually delete the orphaned files.')

    def handle(self, *args, **options):
        avatars_dir = Path(settings.MEDIA_ROOT) / 'avatars'
        if not avatars_dir.is_dir():
            self.stdout.write(f'{avatars_dir} does not exist, nothing to do.')
            return

        referenced = {
            Path(settings.MEDIA_ROOT, name).resolve()
            for name in HouseholdMember.objects.exclude(avatar='').values_list('avatar', flat=True)
            if name
        }

        orphans = [p for p in sorted(avatars_dir.iterdir()) if p.is_file() and p.resolve() not in referenced]
        total_bytes = sum(p.stat().st_size for p in orphans)

        for path in orphans:
            self.stdout.write(f'{"Deleting" if options["delete"] else "Would delete"}: {path.name} ({path.stat().st_size // 1024} KB)')
            if options['delete']:
                path.unlink()

        verb = 'Deleted' if options['delete'] else 'Found'
        self.stdout.write(self.style.SUCCESS(
            f'{verb} {len(orphans)} orphaned avatar file(s), {total_bytes / 1024 / 1024:.1f} MB. '
            f'{len(referenced)} file(s) still in use.'
        ))
        if orphans and not options['delete']:
            self.stdout.write('Dry run -- re-run with --delete to remove them.')
