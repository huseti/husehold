import base64

from django.core.management.base import BaseCommand
from py_vapid import Vapid02


class Command(BaseCommand):
    help = (
        "One-off helper: generates a VAPID key pair for Web Push and prints "
        "them as .env-ready lines. Run once, paste the output into backend/.env, "
        "never regenerate afterwards -- browsers key existing push subscriptions "
        "to the public key they were created with."
    )

    def handle(self, *args, **options):
        vapid = Vapid02()
        vapid.generate_keys()

        private_key = base64.urlsafe_b64encode(
            vapid.private_key.private_numbers().private_value.to_bytes(32, 'big')
        ).rstrip(b'=').decode('utf-8')

        raw_public = vapid.public_key.public_numbers()
        x = raw_public.x.to_bytes(32, 'big')
        y = raw_public.y.to_bytes(32, 'big')
        public_key = base64.urlsafe_b64encode(b'\x04' + x + y).rstrip(b'=').decode('utf-8')

        self.stdout.write('')
        self.stdout.write('Add these to backend/.env:')
        self.stdout.write('')
        self.stdout.write(f'VAPID_PUBLIC_KEY={public_key}')
        self.stdout.write(f'VAPID_PRIVATE_KEY={private_key}')
        self.stdout.write('VAPID_ADMIN_EMAIL=you@example.com')
        self.stdout.write('')
