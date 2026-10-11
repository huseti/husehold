// "Configure this page" icon (Phosphor, MIT, fill) -- next to every page title that has a config.
import { GearSix } from '@phosphor-icons/react/dist/csr/GearSix';

export default function GearIcon({ className = '', ...props }) {
  return <GearSix weight="fill" size="1em" className={className} aria-hidden="true" {...props} />;
}
