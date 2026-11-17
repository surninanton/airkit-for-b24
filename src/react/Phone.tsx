import { useEffect, useRef, type MutableRefObject } from 'react';
import {
  createCallCard, createDialpad, createLineStatus, createMicMeter,
  type CallCardHandle, type CallCardOptions, type DialpadHandle, type DialpadOptions, type LineStatusHandle, type LineStatusOptions, type MicMeterHandle, type MicMeterOptions,
} from '../js/phone';

/** Клавиатура-набиратель: <Dialpad onDial={(n) => call(n)} /> ; в звонке mode="dtmf" onKey={sendTone} */
export interface DialpadProps extends Omit<DialpadOptions, 'value'> { value?: string; handleRef?: MutableRefObject<DialpadHandle | null> }
export function Dialpad({ value, mode, onDial, onKey, onChange, captureKeyboard, normalize, dialLabel, disabled, handleRef }: DialpadProps) {
  const host = useRef<HTMLDivElement>(null);
  const h = useRef<DialpadHandle | null>(null);
  const cbs = useRef({ onDial, onKey, onChange });
  cbs.current = { onDial, onKey, onChange };
  useEffect(() => {
    h.current = createDialpad(host.current!, {
      value, mode, captureKeyboard, normalize, dialLabel, disabled,
      onDial: (n, f) => cbs.current.onDial?.(n, f), onKey: (k) => cbs.current.onKey?.(k), onChange: (n) => cbs.current.onChange?.(n),
    });
    if (handleRef) handleRef.current = h.current;
    return () => { if (handleRef) handleRef.current = null; h.current?.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (mode) h.current?.setMode(mode); }, [mode]);
  useEffect(() => { if (value != null && h.current && h.current.getValue() !== value) h.current.setValue(value); }, [value]);
  useEffect(() => { h.current?.setDisabled(!!disabled); }, [disabled]);
  return <div ref={host} style={{ display: 'contents' }} />;
}

/** Карточка звонка: состояние и данные — пропсами, действия — колбэками. Место под кнопками — через handleRef.current.slots.extra */
export interface CallCardProps extends CallCardOptions { handleRef?: MutableRefObject<CallCardHandle | null> }
export function CallCard({ state, name, number, avatar, meta, startedAt, actions, onAnswer, onDecline, onHangup, onAction, handleRef }: CallCardProps) {
  const host = useRef<HTMLDivElement>(null);
  const h = useRef<CallCardHandle | null>(null);
  const cbs = useRef({ onAnswer, onDecline, onHangup, onAction });
  cbs.current = { onAnswer, onDecline, onHangup, onAction };
  useEffect(() => {
    h.current = createCallCard(host.current!, {
      state, name, number, avatar, meta, startedAt, actions,
      onAnswer: () => cbs.current.onAnswer?.(), onDecline: () => cbs.current.onDecline?.(), onHangup: () => cbs.current.onHangup?.(),
      onAction: (id, p) => cbs.current.onAction?.(id, p),
    });
    if (handleRef) handleRef.current = h.current;
    return () => { if (handleRef) handleRef.current = null; h.current?.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (state) h.current?.setState(state); }, [state]);
  useEffect(() => { h.current?.setInfo({ name, number, avatar, meta }); }, [name, number, avatar, meta]);
  return <div ref={host} style={{ display: 'contents' }} />;
}

/** Статус линии; с onChange — выбор «На линии / Перерыв» */
export interface LineStatusProps extends LineStatusOptions { className?: string }
export function LineStatus({ status, label, onChange, labels }: LineStatusProps) {
  const host = useRef<HTMLSpanElement>(null);
  const h = useRef<LineStatusHandle | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    h.current = createLineStatus(host.current!, { status, label, labels, onChange: onChange ? (s) => cb.current?.(s) : undefined });
    return () => h.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!onChange]);
  useEffect(() => { if (status) h.current?.setStatus(status, label); }, [status, label]);
  return <span ref={host} style={{ display: 'contents' }} />;
}

/** Уровень микрофона: <MicMeter level={0.4} /> или stream={mediaStream} — уровень считается сам */
export interface MicMeterProps extends MicMeterOptions { stream?: MediaStream | null }
export function MicMeter({ level, bars, label, muted, stream }: MicMeterProps) {
  const host = useRef<HTMLSpanElement>(null);
  const h = useRef<MicMeterHandle | null>(null);
  useEffect(() => {
    h.current = createMicMeter(host.current!, { level, bars, label, muted });
    return () => h.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars]);
  useEffect(() => { if (level != null && !stream) h.current?.setLevel(level); }, [level, stream]);
  useEffect(() => { h.current?.setMuted(!!muted); }, [muted]);
  useEffect(() => { if (stream) h.current?.connect(stream); else h.current?.disconnect(); }, [stream]);
  return <span ref={host} style={{ display: 'contents' }} />;
}
