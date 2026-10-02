import { enCore } from './en-core';
import { enForms } from './en-forms';
import { enData } from './en-data';
import { enReact } from './en-react';

/** Английский словарь: русская фраза → перевод. Части — по группам модулей. */
export const en: Record<string, string> = { ...enCore, ...enForms, ...enData, ...enReact };
