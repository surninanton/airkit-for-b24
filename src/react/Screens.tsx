import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { createChart, sparkline, type ChartHandle, type ChartOptions } from '../js/chart';
import { Icon } from './Icon';
import type { IconName } from '../icons';
import { cx } from './utils';

/* ── Графики ─────────────────────────────────────────────
 * Обёртки над createChart / sparkline: данные меняются — график перерисовывается.
 */
export interface ChartProps extends ChartOptions {
  className?: string;
  style?: CSSProperties;
}
export function Chart({ className, style, ...options }: ChartProps) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<ChartHandle | null>(null);
  const opts = useRef(options);
  opts.current = options;
  // функции формата сравниваем по факту наличия, данные — по значению
  const key = JSON.stringify(options, (_k, v) => (typeof v === 'function' ? 'fn' : v));
  useEffect(() => {
    if (!host.current) return;
    chart.current = createChart(host.current, opts.current);
    return () => { chart.current?.destroy(); chart.current = null; };
  }, []);
  useEffect(() => { chart.current?.update(opts.current); }, [key]);
  return <div ref={host} className={className} style={style} />;
}

export function Sparkline({ data, color, width = 96, height = 32 }: { data: number[]; color?: string; width?: number; height?: number }) {
  const host = useRef<SVGSVGElement>(null);
  const key = data.join(',');
  useEffect(() => { if (host.current) sparkline(host.current, data, { color, width, height }); }, [key, color, width, height]);
  return <svg ref={host} className="b24-sparkline" width={width} height={height} />;
}

/* ── KPI-плитка ── */
export function Kpi({ label, value, delta, trend = 'up', period, spark, span, className }: {
  label: ReactNode; value: ReactNode; delta?: ReactNode; trend?: 'up' | 'down' | 'flat'; period?: ReactNode;
  /** значения для спарклайна */
  spark?: number[];
  /** ширина в сетке .b24-dashboard: 3, 4, 6, 8 или 12 колонок */
  span?: 3 | 4 | 6 | 8 | 12;
  className?: string;
}) {
  const arrow = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '';
  return (
    <div className={cx('b24-kpi', span && `b24-span-${span}`, className)}>
      <span className="b24-kpi__label">{label}</span>
      <span className="b24-kpi__value">{value}</span>
      {(delta || spark) && (
        <div className="b24-kpi__row">
          {delta ? <span className={`b24-kpi__delta b24-kpi__delta--${trend}`}>{arrow && `${arrow} `}{delta}{period && <> <span className="b24-kpi__period">{period}</span></>}</span> : <span />}
          {spark && <Sparkline data={spark} />}
        </div>
      )}
    </div>
  );
}

/* ── Степпер ── */
export interface StepItem { title: ReactNode; description?: ReactNode; error?: boolean }
export function Stepper({ steps, current, vertical, onStepClick, className }: {
  steps: StepItem[];
  /** индекс текущего шага; пройденные — до него */
  current: number;
  vertical?: boolean;
  /** клик по пройденному шагу — вернуться к нему */
  onStepClick?: (index: number) => void;
  className?: string;
}) {
  return (
    <ol className={cx('b24-stepper', vertical && 'b24-stepper--vertical', className)}>
      {steps.map((s, i) => {
        const inner = (
          <>
            <span className="b24-stepper__marker" />
            <span className="b24-stepper__title">{s.title}</span>
            {s.description && <span className="b24-stepper__desc">{s.description}</span>}
          </>
        );
        return (
          <li key={i} className={cx('b24-stepper__item', i < current && 'is-done', i === current && 'is-current', s.error && 'is-error')} aria-current={i === current ? 'step' : undefined}>
            {onStepClick && i < current ? <button type="button" onClick={() => onStepClick(i)}>{inner}</button> : inner}
          </li>
        );
      })}
    </ol>
  );
}

/* ── Настройки ── */
export function SettingRow({ label, hint, htmlFor, block, danger, children }: {
  label: ReactNode; hint?: ReactNode;
  /** id контрола — подпись станет <label> */
  htmlFor?: string;
  /** контрол под подписью на всю ширину */
  block?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  const Label = htmlFor ? 'label' : 'div';
  return (
    <div className={cx('b24-setting', block && 'b24-setting--block', danger && 'b24-setting--danger')}>
      <div>
        <Label className="b24-setting__label" {...(htmlFor ? { htmlFor } : {})}>{label}</Label>
        {hint && <p className="b24-setting__hint">{hint}</p>}
      </div>
      <div className={cx('b24-setting__control', block && 'b24-stack')}>{children}</div>
    </div>
  );
}

export function SaveBar({ open, saving, onSave, onCancel, text = 'Есть несохранённые изменения', saveText = 'Сохранить', cancelText = 'Отменить' }: {
  open: boolean; saving?: boolean; onSave?: () => void; onCancel?: () => void;
  text?: ReactNode; saveText?: ReactNode; cancelText?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="b24-savebar" role="region" aria-label="Несохранённые изменения">
      <span className="b24-savebar__text">{text}</span>
      {onCancel && <button className="b24-btn b24-btn--secondary" type="button" onClick={onCancel} disabled={saving}>{cancelText}</button>}
      <button className={cx('b24-btn b24-btn--success', saving && 'b24-btn--loading')} type={onSave ? 'button' : 'submit'} onClick={onSave}>{saveText}</button>
    </div>
  );
}

/* ── Пустое состояние с тоном ── */
export function EmptyScreen({ icon = 'search', tone = 'primary', compact, glass, title, children, actions, note }: {
  icon?: IconName;
  tone?: 'primary' | 'neutral' | 'access' | 'error' | 'success';
  compact?: boolean; glass?: boolean;
  title: ReactNode; children?: ReactNode; actions?: ReactNode;
  /** мелкая строка под кнопками: код ошибки, к кому обратиться */
  note?: ReactNode;
}) {
  return (
    <div className={cx('b24-empty', tone !== 'primary' && `b24-empty--${tone}`, compact && 'b24-empty--compact', glass && 'b24-empty--glass')}>
      <div className="b24-empty__icon"><Icon name={icon} /></div>
      <h3 className="b24-empty__title">{title}</h3>
      {children && <p className="b24-empty__text">{children}</p>}
      {actions && <div className="b24-empty__actions">{actions}</div>}
      {note && <p className="b24-empty__note">{note}</p>}
    </div>
  );
}
