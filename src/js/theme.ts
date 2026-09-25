export type Theme = 'light' | 'dark' | 'auto';
export type AirPreset = 'blue' | 'violet' | 'teal' | 'graphite';

export function setTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.dataset.b24Theme = theme;
}

export function getTheme(root: HTMLElement = document.documentElement): Theme {
  return (root.dataset.b24Theme as Theme) ?? 'light';
}

export function setAirPreset(preset: AirPreset, root: HTMLElement = document.documentElement): void {
  if (preset === 'blue') delete root.dataset.b24Air;
  else root.dataset.b24Air = preset;
}
