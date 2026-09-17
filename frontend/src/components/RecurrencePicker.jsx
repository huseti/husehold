import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { summarizeRecurrenceRule } from '../utils/recurrenceSummary';

// Builds a subset of RFC 5545 RRULE strings -- enough for "every N
// days/weeks/months", specific weekdays, a fixed day-of-month, or an
// ordinal weekday ("first Monday", "last Friday"). The raw rule is never
// shown or editable directly -- only this picker and a plain-language
// summary of what it produced.
const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const ORDINALS = ['1', '2', '3', '4', '-1'];

const DEFAULT_STATE = {
  freq: 'WEEKLY',
  interval: 1,
  byday: ['MO'],
  monthlyMode: 'ordinal',
  monthDay: 1,
  ordinal: '1',
  ordinalWeekday: 'MO',
};

function buildRule(state) {
  const parts = [`FREQ=${state.freq}`];
  if (state.interval > 1) parts.push(`INTERVAL=${state.interval}`);
  if (state.freq === 'WEEKLY' && state.byday.length > 0) {
    parts.push(`BYDAY=${state.byday.join(',')}`);
  }
  if (state.freq === 'MONTHLY') {
    if (state.monthlyMode === 'day') {
      parts.push(`BYMONTHDAY=${state.monthDay}`);
    } else {
      parts.push(`BYDAY=${state.ordinal}${state.ordinalWeekday}`);
    }
  }
  return parts.join(';');
}

// Used when editing an existing recurring task -- seeds the picker's
// controls from its stored rule. Render this component with a `key` tied
// to the task being edited so React remounts it (and re-runs this) rather
// than trying to patch a live picker's state.
export function parseRuleToState(rule) {
  if (!rule) return DEFAULT_STATE;
  const parts = Object.fromEntries(rule.split(';').map((p) => p.split('=')));
  const state = { ...DEFAULT_STATE, freq: parts.FREQ || 'WEEKLY', interval: parseInt(parts.INTERVAL || '1', 10) };
  if (parts.FREQ === 'WEEKLY' && parts.BYDAY) {
    state.byday = parts.BYDAY.split(',');
  }
  if (parts.FREQ === 'MONTHLY' && parts.BYMONTHDAY) {
    state.monthlyMode = 'day';
    state.monthDay = parseInt(parts.BYMONTHDAY, 10);
  } else if (parts.FREQ === 'MONTHLY' && parts.BYDAY) {
    const match = parts.BYDAY.match(/^(-?\d+)([A-Z]{2})$/);
    if (match) {
      state.monthlyMode = 'ordinal';
      state.ordinal = match[1];
      state.ordinalWeekday = match[2];
    }
  }
  return state;
}

export default function RecurrencePicker({ value, onChange, initialRule, hasPreferredDay, onHasPreferredDayChange }) {
  const { t } = useTranslation();
  const [state, setState] = useState(() => parseRuleToState(initialRule));

  useEffect(() => {
    onChange(buildRule(state));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const set = (patch) => setState((s) => ({ ...s, ...patch }));

  const toggleDay = (day) => {
    set({
      byday: state.byday.includes(day)
        ? state.byday.filter((d) => d !== day)
        : [...state.byday, day],
    });
  };

  const weekdayLabel = (day) => t(`tasks.recurrence.weekday.${day.toLowerCase()}`);

  return (
    <div className="border rounded p-3 bg-gray-50">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="text-xs text-gray-500">{t('tasks.recurrence.every')}</span>
        <input
          type="number"
          min="1"
          value={state.interval}
          onChange={(e) => set({ interval: Math.max(1, parseInt(e.target.value, 10) || 1) })}
          className="border rounded px-2 py-1 text-sm w-16"
        />
        <select
          value={state.freq}
          onChange={(e) => set({ freq: e.target.value })}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="DAILY">{t('tasks.recurrence.days', { count: state.interval })}</option>
          <option value="WEEKLY">{t('tasks.recurrence.weeks', { count: state.interval })}</option>
          <option value="MONTHLY">{t('tasks.recurrence.months', { count: state.interval })}</option>
        </select>
      </div>

      {onHasPreferredDayChange && (
        <label className="flex items-center gap-2 text-sm mb-2">
          <input
            type="checkbox"
            checked={hasPreferredDay}
            onChange={(e) => onHasPreferredDayChange(e.target.checked)}
          />
          {t('tasks.recurrence.hasPreferredDay')}
        </label>
      )}
      {onHasPreferredDayChange && !hasPreferredDay && (
        <p className="text-xs text-gray-500 mb-2">{t('tasks.recurrence.noPreferredDayHint')}</p>
      )}

      {state.freq === 'WEEKLY' && (hasPreferredDay === undefined || hasPreferredDay) && (
        <div className="flex gap-1 flex-wrap mb-2">
          {WEEKDAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={`text-xs px-2 py-1 rounded border ${
                state.byday.includes(day)
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-600 border-gray-300'
              }`}
            >
              {weekdayLabel(day)}
            </button>
          ))}
        </div>
      )}

      {state.freq === 'MONTHLY' && (hasPreferredDay === undefined || hasPreferredDay) && (
        <div className="flex items-center gap-2 flex-wrap mb-2 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={state.monthlyMode === 'ordinal'}
              onChange={() => set({ monthlyMode: 'ordinal' })}
            />
            {t('tasks.recurrence.theNth')}
          </label>
          <select
            value={state.ordinal}
            disabled={state.monthlyMode !== 'ordinal'}
            onChange={(e) => set({ ordinal: e.target.value, monthlyMode: 'ordinal' })}
            className="border rounded px-1 py-0.5 text-sm"
          >
            {ORDINALS.map((o) => (
              <option key={o} value={o}>{t(`tasks.recurrence.ordinal.${o}`)}</option>
            ))}
          </select>
          <select
            value={state.ordinalWeekday}
            disabled={state.monthlyMode !== 'ordinal'}
            onChange={(e) => set({ ordinalWeekday: e.target.value, monthlyMode: 'ordinal' })}
            className="border rounded px-1 py-0.5 text-sm"
          >
            {WEEKDAYS.map((day) => (
              <option key={day} value={day}>{weekdayLabel(day)}</option>
            ))}
          </select>

          <label className="flex items-center gap-1 ml-3">
            <input
              type="radio"
              checked={state.monthlyMode === 'day'}
              onChange={() => set({ monthlyMode: 'day' })}
            />
            {t('tasks.recurrence.dayOfMonth')}
          </label>
          <input
            type="number"
            min="1"
            max="31"
            value={state.monthDay}
            disabled={state.monthlyMode !== 'day'}
            onChange={(e) => set({ monthDay: Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)), monthlyMode: 'day' })}
            className="border rounded px-2 py-1 text-sm w-16"
          />
        </div>
      )}

      <p className="text-xs text-gray-500 italic mt-1">
        {hasPreferredDay === false
          ? t('tasks.recurrence.summary.noPreferredDay', { every: summarizeRecurrenceRule(`FREQ=${state.freq}${state.interval > 1 ? `;INTERVAL=${state.interval}` : ''}`, t) })
          : summarizeRecurrenceRule(value, t)}
      </p>
    </div>
  );
}
