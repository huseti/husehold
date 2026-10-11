// Shopping list category icons from Phosphor (MIT), "fill" weight -- same
// treatment as taskIcons.jsx. Keys are stored on ingredient categories -- keep them;
// icons picked in the icon picker are stored by their Phosphor name.
import LazyPhosphorIcon from './LazyPhosphorIcon';
import { isPhosphorName } from '../../utils/phosphorLibrary';
import { Carrot } from '@phosphor-icons/react/dist/csr/Carrot';
import { Bread } from '@phosphor-icons/react/dist/csr/Bread';
import { Cheese } from '@phosphor-icons/react/dist/csr/Cheese';
import { Fish } from '@phosphor-icons/react/dist/csr/Fish';
import { Snowflake } from '@phosphor-icons/react/dist/csr/Snowflake';
import { Jar } from '@phosphor-icons/react/dist/csr/Jar';
import { Pepper } from '@phosphor-icons/react/dist/csr/Pepper';
import { Wine } from '@phosphor-icons/react/dist/csr/Wine';
import { Cookie } from '@phosphor-icons/react/dist/csr/Cookie';
import { SprayBottle } from '@phosphor-icons/react/dist/csr/SprayBottle';
import { Tag } from '@phosphor-icons/react/dist/csr/Tag';

const ICONS = {
  produce: Carrot,
  bakery: Bread,
  dairy: Cheese,
  meat: Fish,
  frozen: Snowflake,
  pantry: Jar,
  spices: Pepper,
  drinks: Wine,
  sweets: Cookie,
  household: SprayBottle,
  other: Tag,
};

export const CATEGORY_ICON_KEYS = Object.keys(ICONS);

export default function CategoryIcon({ icon, className = '', ...props }) {
  if (!ICONS[icon] && isPhosphorName(icon)) {
    const fallback = <Tag weight="fill" size="1em" className={className} aria-hidden="true" {...props} />;
    return <LazyPhosphorIcon name={icon} fallback={fallback} className={className} {...props} />;
  }
  const Component = ICONS[icon] || ICONS.other;
  return <Component weight="fill" size="1em" className={className} aria-hidden="true" {...props} />;
}
