// Household task icons from Phosphor (MIT), "fill" weight: flat, single
// currentColor. These curated keys are stored on tasks -- keep them; any other
// Phosphor icon picked in the icon picker is stored by its PascalCase name.
import LazyPhosphorIcon from './LazyPhosphorIcon';
import { isPhosphorName } from '../../utils/phosphorLibrary';
import { Broom } from '@phosphor-icons/react/dist/csr/Broom';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { Coffee } from '@phosphor-icons/react/dist/csr/Coffee';
import { TShirt } from '@phosphor-icons/react/dist/csr/TShirt';
import { BowlFood } from '@phosphor-icons/react/dist/csr/BowlFood';
import { Wind } from '@phosphor-icons/react/dist/csr/Wind';
import { ShoppingCart } from '@phosphor-icons/react/dist/csr/ShoppingCart';
import { Plant } from '@phosphor-icons/react/dist/csr/Plant';
import { PawPrint } from '@phosphor-icons/react/dist/csr/PawPrint';
import { Wrench } from '@phosphor-icons/react/dist/csr/Wrench';
import { Bed } from '@phosphor-icons/react/dist/csr/Bed';
import { Question } from '@phosphor-icons/react/dist/csr/Question';
import { CookingPot } from '@phosphor-icons/react/dist/csr/CookingPot';
import { CalendarBlank } from '@phosphor-icons/react/dist/csr/CalendarBlank';

const ICONS = {
  cleaning: Broom,
  trash: Trash,
  coffee: Coffee,
  laundry: TShirt,
  dishes: BowlFood,
  vacuum: Wind,
  shopping: ShoppingCart,
  plant: Plant,
  pet: PawPrint,
  tool: Wrench,
  bed: Bed,
  other: Question,
  cooking: CookingPot,
  calendar: CalendarBlank,
};

export const TASK_ICON_KEYS = Object.keys(ICONS);

export default function TaskIcon({ icon, className = '', ...props }) {
  if (!ICONS[icon] && isPhosphorName(icon)) {
    const fallback = <Question weight="fill" size="1em" className={className} aria-hidden="true" {...props} />;
    return <LazyPhosphorIcon name={icon} fallback={fallback} className={className} {...props} />;
  }
  const Component = ICONS[icon] || ICONS.other;
  return <Component weight="fill" size="1em" className={className} aria-hidden="true" {...props} />;
}
