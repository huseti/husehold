import { useTranslation } from 'react-i18next';
import logoIcon from '../assets/logo-icon.png';

// The app logo on a small white rounded tile, like an app icon -- the logo is
// green line art and would vanish on the dark eucalyptus bars without it.
export default function LogoTile({ sizeClass = 'h-10 w-10', className = '' }) {
  const { t } = useTranslation();
  return (
    <span className={`${sizeClass} inline-flex items-center justify-center rounded-xl bg-white shadow-sm ${className}`}>
      <img src={logoIcon} alt={t('common.appName')} className="h-[80%] w-[80%] object-contain" />
    </span>
  );
}
