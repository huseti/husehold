import json
import os
import shutil
import sqlite3
import tarfile
import tempfile
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.utils import timezone


# Must exist inside BACKUP_DIR. If the NAS share isn't mounted, BACKUP_DIR is
# just an empty folder on the SD card -- writing there would look like a
# successful backup while protecting nothing.
MARKER_FILENAME = '.husehold-backup-target'
FILE_PREFIX = 'husehold-'

# Tables that can never legitimately be empty in a live household.
REQUIRED_NONEMPTY_TABLES = ('auth_user', 'household_householdmember')

# A snapshot with fewer than half the rows of the last good backup is treated
# as data loss, not normal use -- nothing in day-to-day use deletes that much
# overnight. Override once with --force after an intentional bulk delete.
MIN_ROW_RATIO = 0.5

# Warn when the share has room for fewer than this many more backups.
LOW_SPACE_BACKUPS = 3

WEEKLY_REPORT_WEEKDAY = 6  # Sunday


class BackupError(Exception):
    pass


class Command(BaseCommand):
    help = (
        "Writes a consistent snapshot of the SQLite DB plus MEDIA_ROOT as one .tar.gz "
        "into BACKUP_DIR and keeps the newest BACKUP_KEEP of them. Refuses to write "
        "(and leaves existing backups untouched) if the snapshot fails an integrity "
        "check, is missing core data, or shrank sharply since the last backup -- and "
        "emails a warning instead. Sends a 'backup OK' summary on Sundays. Meant to run "
        "nightly via cron."
    )

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true',
                            help='Skip the shrink check (after an intentional bulk delete).')
        parser.add_argument('--report', action='store_true',
                            help="Send the 'backup OK' summary now, regardless of weekday.")

    def handle(self, *args, **options):
        try:
            result = self._run(force=options['force'])
        except BackupError as e:
            self._alert('[HUSEHOLD] Backup FAILED',
                        f'Tonight\'s backup was NOT written:\n\n{e}\n\n'
                        f'Existing backups in {settings.BACKUP_DIR or "(BACKUP_DIR unset)"} were left untouched.')
            raise CommandError(str(e))

        self.stdout.write(self.style.SUCCESS(
            f"Wrote {result['name']} ({result['size'] / 1024:.0f} KB, {result['rows']} rows). "
            f"{len(result['kept'])} backup(s) kept, {len(result['removed'])} removed."
        ))

        if result['low_space']:
            self._alert('[HUSEHOLD] Backup storage almost full', self._summary(result) +
                        '\n\nFree space is running low -- consider moving backups to a USB stick.')
        elif options['report'] or timezone.localdate().weekday() == WEEKLY_REPORT_WEEKDAY:
            self._alert('[HUSEHOLD] Backup OK', self._summary(result))

    def _run(self, force):
        if not settings.BACKUP_DIR:
            raise BackupError('BACKUP_DIR is not set in .env.')
        backup_dir = Path(settings.BACKUP_DIR)
        if not (backup_dir / MARKER_FILENAME).is_file():
            raise BackupError(
                f'{backup_dir} has no {MARKER_FILENAME} marker file -- the NAS share is probably not mounted.'
            )

        with tempfile.TemporaryDirectory() as tmp:
            snapshot = Path(tmp) / 'db.sqlite3'
            rows = self._snapshot_and_check(snapshot)
            total = sum(rows.values())

            previous = self._latest_manifest(backup_dir)
            if previous and not force and total < previous['total_rows'] * MIN_ROW_RATIO:
                raise BackupError(
                    f"The database has {total} rows, down from {previous['total_rows']} in the last backup "
                    f"({previous['name']}). That looks like data loss rather than normal use.\n"
                    f"If the delete was intentional, run once with --force."
                )

            stem = FILE_PREFIX + timezone.localtime().strftime('%Y-%m-%d_%H%M%S')
            local_archive = Path(tmp) / f'{stem}.tar.gz'
            with tarfile.open(local_archive, 'w:gz') as tar:
                tar.add(snapshot, arcname='db.sqlite3')
                if Path(settings.MEDIA_ROOT).is_dir():
                    tar.add(settings.MEDIA_ROOT, arcname='media')

            manifest = {'name': f'{stem}.tar.gz', 'total_rows': total, 'rows': rows}
            try:
                # Copy under a temporary name first, so an interrupted copy never
                # leaves a half-written file that looks like a real backup.
                partial = backup_dir / f'{stem}.tar.gz.partial'
                shutil.copyfile(local_archive, partial)
                os.replace(partial, backup_dir / f'{stem}.tar.gz')
                (backup_dir / f'{stem}.json').write_text(json.dumps(manifest, indent=2))
            except OSError as e:
                raise BackupError(f'Could not write to {backup_dir}: {e}')
            size = local_archive.stat().st_size

        kept, removed = self._rotate(backup_dir)
        free = shutil.disk_usage(backup_dir).free
        return {
            'name': f'{stem}.tar.gz', 'size': size, 'rows': total, 'kept': kept, 'removed': removed,
            'free': free, 'low_space': free < size * LOW_SPACE_BACKUPS,
        }

    def _snapshot_and_check(self, snapshot):
        """Copies the live DB via SQLite's online backup API (consistent even
        while gunicorn is writing, unlike a plain file copy), then validates
        the copy. Returns row counts per app table."""
        connection.ensure_connection()
        dst = sqlite3.connect(snapshot)
        try:
            connection.connection.backup(dst)
            integrity = dst.execute('PRAGMA integrity_check').fetchone()[0]
            if integrity != 'ok':
                raise BackupError(f'SQLite integrity check failed: {integrity}')

            tables = [r[0] for r in dst.execute(
                "SELECT name FROM sqlite_master WHERE type='table' "
                "AND (name LIKE 'household\\_%' ESCAPE '\\' OR name = 'auth_user')"
            )]
            rows = {t: dst.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0] for t in tables}
        except sqlite3.DatabaseError as e:
            raise BackupError(f'Could not read the database: {e}')
        finally:
            dst.close()

        empty = [t for t in REQUIRED_NONEMPTY_TABLES if not rows.get(t)]
        if empty:
            raise BackupError(f'The database looks empty (no rows in: {", ".join(empty)}).')
        return rows

    def _latest_manifest(self, backup_dir):
        for path in sorted(backup_dir.glob(f'{FILE_PREFIX}*.json'), reverse=True):
            try:
                return json.loads(path.read_text())
            except (OSError, ValueError, KeyError):
                continue
        return None

    def _rotate(self, backup_dir):
        """Only ever called after a new backup was written successfully, so a
        run of failures can never eat into the last good copies."""
        archives = sorted(backup_dir.glob(f'{FILE_PREFIX}*.tar.gz'), reverse=True)
        kept, removed = archives[:settings.BACKUP_KEEP], archives[settings.BACKUP_KEEP:]
        for archive in removed:
            archive.unlink()
            archive.with_name(archive.name.removesuffix('.tar.gz') + '.json').unlink(missing_ok=True)
        return [a.name for a in kept], [a.name for a in removed]

    def _summary(self, result):
        lines = [f"Latest: {result['name']} ({result['size'] / 1024:.0f} KB, {result['rows']} rows)", '',
                 f'Backups kept ({len(result["kept"])}):']
        lines += [f'  {name}' for name in result['kept']]
        lines += ['', f"Free space on backup storage: {result['free'] / 1024 / 1024:.1f} MB"]
        return '\n'.join(lines)

    def _alert(self, subject, body):
        recipients = list(settings.BACKUP_ALERT_EMAILS)
        if not recipients:
            try:
                recipients = list(User.objects.filter(is_superuser=True).exclude(email='')
                                  .values_list('email', flat=True))
            except Exception:
                recipients = []  # the DB itself may be what's broken
        if not recipients:
            self.stderr.write(f'No recipients for "{subject}" -- set BACKUP_ALERT_EMAILS.\n{body}')
            return
        try:
            send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, recipients, fail_silently=False)
        except Exception as e:
            self.stderr.write(f'Failed to send "{subject}" email: {e}\n{body}')
