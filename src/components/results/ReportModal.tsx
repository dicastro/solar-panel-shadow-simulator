import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportDay } from '../../pdf/PdfReportGenerator';

interface Props {
  year: number;
  onGenerate: (selectedDays: ReportDay[]) => void;
  onCancel: () => void;
}

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const daysInMonth = (month1based: number, year: number): number =>
  new Date(year, month1based, 0).getDate();

/**
 * Modal for optionally selecting representative days before PDF generation.
 * Month and day names shown in the picker are taken from the active i18next
 * language so the UI stays consistent with the rest of the app.
 */
export function ReportModal({ year, onGenerate, onCancel }: Props) {
  const { t } = useTranslation();

  const monthNamesLong: string[] = t('months.long', { returnObjects: true }) as string[];
  const monthNamesShort: string[] = t('months.short', { returnObjects: true }) as string[];

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate() - 1);
  const [days, setDays] = useState<ReportDay[]>([]);

  const dayCount = useMemo(() => daysInMonth(selectedMonth + 1, year), [selectedMonth, year]);
  const clampedDay = Math.min(selectedDay, dayCount - 1);

  const formatLabel = (month: number, day: number): string =>
    `${day + 1} ${monthNamesShort[month] ?? MONTH_SHORT_EN[month]} ${year}`;

  const handleAddDay = () => {
    const key = `${selectedMonth}-${clampedDay}`;
    if (days.some(d => `${d.month}-${d.day}` === key)) return;
    setDays(prev => [...prev, { month: selectedMonth, day: clampedDay, label: formatLabel(selectedMonth, clampedDay) }]);
  };

  const handleRemoveDay = (key: string) => {
    setDays(prev => prev.filter(d => `${d.month}-${d.day}` !== key));
  };

  return (
    <div className="report-modal-backdrop">
      <div className="report-modal">
        <h3 className="report-modal__title">{t('report.modalTitle')}</h3>
        <p className="report-modal__description">{t('report.modalDescription')}</p>

        <div className="report-modal__day-picker">
          <label className="report-modal__label">{t('report.monthLabel')}</label>
          <select
            value={selectedMonth}
            onChange={e => {
              const m = Number(e.target.value);
              setSelectedMonth(m);
              if (clampedDay >= daysInMonth(m + 1, year)) setSelectedDay(daysInMonth(m + 1, year) - 1);
            }}
          >
            {(monthNamesLong.length === 12 ? monthNamesLong : MONTH_NAMES_EN).map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>

          <label className="report-modal__label">{t('report.dayLabel')}</label>
          <select value={clampedDay} onChange={e => setSelectedDay(Number(e.target.value))}>
            {Array.from({ length: dayCount }, (_, i) => (
              <option key={i} value={i}>{i + 1}</option>
            ))}
          </select>

          <button className="report-modal__add-btn" onClick={handleAddDay}>
            {t('report.addDay')}
          </button>
        </div>

        {days.length > 0 && (
          <div className="report-modal__chips">
            {days.map(d => {
              const key = `${d.month}-${d.day}`;
              return (
                <span key={key} className="report-modal__chip">
                  {d.label}
                  <button className="report-modal__chip-remove" onClick={() => handleRemoveDay(key)} title={t('report.removeDay')}>✕</button>
                </span>
              );
            })}
          </div>
        )}

        <div className="report-modal__actions">
          <button className="report-modal__btn report-modal__btn--secondary" onClick={onCancel}>
            {t('report.cancel')}
          </button>
          <button className="report-modal__btn report-modal__btn--primary" onClick={() => onGenerate(days)}>
            {t('report.generate')}
          </button>
        </div>
      </div>
    </div>
  );
}