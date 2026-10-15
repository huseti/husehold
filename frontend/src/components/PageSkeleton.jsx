import { useTranslation } from 'react-i18next';
import Navbar from './Navbar';

const Bar = ({ className }) => <div className={`rounded-lg bg-gray-200 dark:bg-gray-700 ${className}`} />;

// Shown while a page loads for the first time (later visits come straight from
// the API cache): the page's frame with grey placeholder blocks instead of a
// blank "Loading..." screen, so the layout doesn't jump when the data arrives.
export default function PageSkeleton({ width = 'max-w-4xl', cards = 3 }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className={`${width} mx-auto px-4 py-8`} aria-busy="true">
        <span className="sr-only">{t('common.loading')}</span>
        <div className="animate-pulse motion-reduce:animate-none">
          <Bar className="h-8 w-48 mb-6" />
          <div className="space-y-4">
            {Array.from({ length: cards }, (_, i) => (
              <div key={i} className="bg-white rounded-xl shadow p-4 space-y-3">
                <Bar className="h-4 w-1/3" />
                <Bar className="h-3 w-full" />
                <Bar className="h-3 w-5/6" />
                <Bar className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
