import { useEffect, useRef, type MutableRefObject } from 'react';
import {
  createCallCard, createDialpad, createLineStatus, createMicMeter,
  type CallCardHandle, type CallCardOptions, type DialpadHandle, type DialpadOptions, type LineStatusHandle, type LineStatusOptions, type MicMeterHandle, type MicMeterOptions,
} from '../js/phone';
import { createAudioPlayer, type AudioPlayerHandle, type AudioPlayerOptions } from '../js/audio-player';
import { createCallLog, type CallLogHandle, type CallLogItem, type CallLogOptions } from '../js/call-log';

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
export interface CallCardProps extends CallCardOptions {
  /** свой текст итога под именем («Ответил коллега»); сбрасывается при смене состояния */
  statusText?: string | null;
  handleRef?: MutableRefObject<CallCardHandle | null> }
export function CallCard({ state, name, number, avatar, meta, startedAt, actions, floating, minimized, onMinimize, onClose, closeLabel, statusText, accent, brand, onAnswer, onDecline, onHangup, onAction, handleRef }: CallCardProps) {
  const host = useRef<HTMLDivElement>(null);
  const h = useRef<CallCardHandle | null>(null);
  const cbs = useRef({ onAnswer, onDecline, onHangup, onAction, onMinimize, onClose });
  cbs.current = { onAnswer, onDecline, onHangup, onAction, onMinimize, onClose };
  useEffect(() => {
    h.current = createCallCard(host.current!, {
      state, name, number, avatar, meta, startedAt, actions, floating, minimized, closeLabel, accent, brand,
      onClose: onClose ? () => cbs.current.onClose?.() : undefined,
      onMinimize: (m) => cbs.current.onMinimize?.(m),
      onAnswer: () => cbs.current.onAnswer?.(), onDecline: () => cbs.current.onDecline?.(), onHangup: () => cbs.current.onHangup?.(),
      onAction: (id, p) => cbs.current.onAction?.(id, p),
    });
    if (handleRef) handleRef.current = h.current;
    return () => { if (handleRef) handleRef.current = null; h.current?.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (state) h.current?.setState(state, statusText != null ? { text: statusText } : undefined); }, [state, statusText]);
  useEffect(() => { if (startedAt != null) h.current?.setStartedAt(startedAt); }, [startedAt]);
  useEffect(() => { h.current?.setAccent(accent ?? null); }, [accent]);
  const brandKey = JSON.stringify(brand ?? null);
  useEffect(() => { h.current?.setBrand(brand ?? null); }, [brandKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { h.current?.setInfo({ name, number, avatar, meta }); }, [name, number, avatar, meta]);
  useEffect(() => { if (minimized != null) { if (minimized) h.current?.minimize(); else h.current?.restore(); } }, [minimized]);
  return <div ref={host} style={floating ? undefined : { display: 'contents' }} />;
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

/** Журнал звонков: строки с иконкой направления, временем и длительностью, группы по дням, «пропущенный» красным */
export interface CallLogProps extends Omit<CallLogOptions, 'items'> { items: CallLogItem[]; className?: string }
export function CallLog({ items, onSelect, onAction, groupByDay, emptyText, onMissedChange, label }: CallLogProps) {
  const host = useRef<HTMLDivElement>(null);
  const h = useRef<CallLogHandle | null>(null);
  const cbs = useRef({ onSelect, onMissedChange, onAction });
  cbs.current = { onSelect, onMissedChange, onAction };
  useEffect(() => {
    h.current = createCallLog(host.current!, { items, groupByDay, emptyText, label, onSelect: onSelect ? (id, it) => cbs.current.onSelect?.(id, it) : undefined, onMissedChange: (n) => cbs.current.onMissedChange?.(n), onAction: onAction ? (a, it) => cbs.current.onAction?.(a, it) : undefined });
    return () => h.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const first = useRef(true);
  const key = JSON.stringify(items);
  useEffect(() => { if (first.current) { first.current = false; return; } h.current?.setItems(items); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={host} style={{ display: 'contents' }} />;
}

/** Плеер записи разговора: <AudioPlayer src={url} duration={125} compact download onError={…} /> */
export interface AudioPlayerProps extends Omit<AudioPlayerOptions, 'src'> { src: string; className?: string; handleRef?: MutableRefObject<AudioPlayerHandle | null> }
export function AudioPlayer({ src, duration, compact, speeds, speed, download, label, preload, autoplay, exclusive, errorText, onPlay, onPause, onEnd, onError, onTime, handleRef, className }: AudioPlayerProps) {
  const host = useRef<HTMLDivElement>(null);
  const h = useRef<AudioPlayerHandle | null>(null);
  const cbs = useRef({ onPlay, onPause, onEnd, onError, onTime });
  cbs.current = { onPlay, onPause, onEnd, onError, onTime };
  const optKey = JSON.stringify([compact, speeds, speed, download, label, preload, exclusive, errorText]);
  useEffect(() => {
    h.current = createAudioPlayer(host.current!, {
      src, duration, compact, speeds, speed, download, label, preload, autoplay, exclusive, errorText,
      onPlay: () => cbs.current.onPlay?.(), onPause: () => cbs.current.onPause?.(), onEnd: () => cbs.current.onEnd?.(),
      onError: (e) => cbs.current.onError?.(e), onTime: (c, d) => cbs.current.onTime?.(c, d),
    });
    if (handleRef) handleRef.current = h.current;
    return () => { if (handleRef) handleRef.current = null; h.current?.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optKey]);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } h.current?.setSrc(src, duration); }, [src, duration]);
  return <div ref={host} className={className} style={{ display: 'contents' }} />;
}
