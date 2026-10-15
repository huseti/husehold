// Icons in front of headings (dashboard sections, config pages) from Phosphor
// (MIT), "fill" weight -- flat single color, like the rest of the icon set.
import { HandWaving } from '@phosphor-icons/react/dist/csr/HandWaving';
import { CalendarDots } from '@phosphor-icons/react/dist/csr/CalendarDots';
import { ListChecks } from '@phosphor-icons/react/dist/csr/ListChecks';
import { ChartLineUp } from '@phosphor-icons/react/dist/csr/ChartLineUp';
import { Sliders } from '@phosphor-icons/react/dist/csr/Sliders';

const fill = (Component) => function SectionIcon({ className = '', ...props }) {
  return <Component weight="fill" size="1em" className={className} aria-hidden="true" {...props} />;
};

export const WaveIcon = fill(HandWaving);
export const WeekIcon = fill(CalendarDots);
export const OpenTasksIcon = fill(ListChecks);
export const ProgressIcon = fill(ChartLineUp);
export const ConfigIcon = fill(Sliders);
