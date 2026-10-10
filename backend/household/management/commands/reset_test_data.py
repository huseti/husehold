from django.core.management.base import BaseCommand
from django.db import transaction

from household.models import (
    Voucher, PackingList, PackingBucket, PurchaseRecord, ShoppingList,
    HouseholdTaskInstance, HouseholdTaskDefinition, CookingPlanEntry, MealEvent,
    Recipe, NotificationLog, CalendarEvent,
)

# Deliberately NOT touched: HouseholdMember, HouseholdSettings, UnitOfMeasure,
# IngredientCategory, Label, MealTimeCategory, Ingredient, CookingPlanConfig,
# NotificationPreference, PushSubscription, GoogleCalendarLink.
MODELS_TO_CLEAR = [
    Voucher,            # cascades VoucherRedemption
    PackingList,        # cascades PackingListParticipant, PackingListItem
    PackingBucket,      # cascades PackingBucketItem
    PurchaseRecord,
    ShoppingList,       # cascades ShoppingListItem
    HouseholdTaskInstance,  # cascades HouseholdTaskEvent (incl. standalone tasks)
    HouseholdTaskDefinition,
    CookingPlanEntry,
    MealEvent,
    Recipe,             # cascades RecipeIngredient, RecipeRating
    NotificationLog,
    CalendarEvent,
]


class Command(BaseCommand):
    help = (
        "Clears test/content data (vouchers, packing lists, shopping lists, "
        "task instances/definitions, recipes, cooking plan entries, "
        "notification logs, calendar event cache) while keeping account "
        "and configuration data (members, settings, categories, units, "
        "ingredients, cooking plan config, notification preferences, "
        "Google Calendar link). Use --dry-run to see counts without deleting."
    )

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help="Show what would be deleted without deleting it.")

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        self.stdout.write(self.style.WARNING('DRY RUN -- nothing will be deleted.' if dry_run else 'Deleting test data...'))

        with transaction.atomic():
            for model in MODELS_TO_CLEAR:
                count = model.objects.count()
                if dry_run:
                    self.stdout.write(f'  {model.__name__}: {count} row(s) would be deleted')
                else:
                    deleted, _ = model.objects.all().delete()
                    self.stdout.write(f'  {model.__name__}: {deleted} row(s) deleted')
            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS('Dry run complete.' if dry_run else 'Done.'))
