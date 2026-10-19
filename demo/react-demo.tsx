import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/styles/index.css';
import {
  B24Provider, AppShell, Sidebar, SidebarGroup, SidebarItem, TopNav, PageHeader,
  Button, DataTable, Pagination, Badge, User, StageMini, Stages,
  SidePanel, Modal, Dropdown, Card, SectionTitle, Props, Field, Input, Select, Textarea, Switch,
  Alert, Stat, Kpi, Chart, toast, confirm, type Column, type Stage,
  Filter, emptyFilterState, Kanban, KanbanCard, applyKanbanMove, DatePicker, DateRangePicker, resolvePeriod, parseDate,
  type FilterField, type FilterPreset, type FilterState, type DateRange,
  Combobox, EntitySelector, Uploader, EntityEditor, Timeline, TimelineItem, TimelineActivity, TimelineDivider, TimelineComposer,
  formatTimelineTime, Icon, Credit, openSidePanel, modal, type DialogItem, type EditorField, type EditorSection, type EditorValues,
} from '../src/react';

const STAGES: Stage[] = [
  { id: 'new', name: 'Новая', color: '#2fc6f6' },
  { id: 'prep', name: 'Подготовка документов', color: '#39a8ef' },
  { id: 'invoice', name: 'Счёт на оплату', color: '#55d0e0' },
  { id: 'work', name: 'В работе', color: '#faa72c' },
  { id: 'won', name: 'Сделка успешна', color: '#1bce7b', semantic: 'success' },
  { id: 'lost', name: 'Провалена', color: '#ff5752', semantic: 'fail' },
];

interface Deal { id: number; title: string; kind: string; stage: string; sum: number; owner: string; created: string; missed?: boolean }

const OWNERS = ['Дмитрий Лесников', 'Елена Ракитина', 'Вероника Белозёрова', 'Олег Тихомиров', 'Вера Полянская'];
const TITLES = ['Поставка оборудования', 'Входящий звонок', 'Годовая лицензия', 'Обучение персонала', 'Внедрение CRM', 'Консалтинг', 'Разработка сайта', 'Техподдержка'];
const DEALS: Deal[] = Array.from({ length: 37 }, (_, i) => ({
  id: 1000 + i,
  title: `${TITLES[i % TITLES.length]}${i > 7 ? ` #${i}` : ''}`,
  kind: i % 3 ? 'Первичная' : 'Повторная',
  stage: STAGES[(i * 7) % 5].id,
  sum: ((i * 7919) % 200) * 1000,
  owner: OWNERS[i % OWNERS.length],
  created: `${(i % 28) + 1}.09.2026`,
  missed: i % 9 === 1,
}));

const money = (n: number) => `${n.toLocaleString('ru-RU')} ₽`;

/* ── Справочники для селекторов ── */
const POSITIONS = ['Руководитель отдела продаж', 'Менеджер', 'Старший менеджер', 'Менеджер по работе с клиентами', 'Маркетолог'];
const USERS: DialogItem[] = [...OWNERS, 'Григорий Воронцов', 'Зоя Кравец', 'Роман Ефимцев', 'Лариса Шевелёва'].map((name, i) => ({
  id: i + 1, entityId: 'user', title: name, subtitle: POSITIONS[i % POSITIONS.length], tab: 'users',
}));
const DEPARTMENTS: DialogItem[] = ['Отдел продаж', 'Маркетинг', 'Поддержка', 'Бухгалтерия'].map((title, i) => ({
  id: 100 + i, entityId: 'department', title, subtitle: `${3 + i * 2} сотрудников`, tab: 'departments',
}));
const SELECTOR_TABS = [{ id: 'users', title: 'Сотрудники', icon: 'users' as const }, { id: 'departments', title: 'Отделы', icon: 'department' as const }];
const userByName = (name: string) => USERS.find((u) => u.title === name) ?? null;
/** Имитация серверного поиска (в портале — bx24UserLoader()) */
const searchUsers = (q: string, tab: string | null) => new Promise<DialogItem[]>((resolve) => setTimeout(() => {
  const src = tab === 'departments' ? DEPARTMENTS : USERS;
  resolve(src.filter((u) => u.title.toLowerCase().includes(q.toLowerCase())));
}, 250));

const SOURCES = [
  { value: 'CALL', label: 'Звонок' }, { value: 'WEB', label: 'Сайт', subtitle: 'Форма на лендинге' }, { value: 'EMAIL', label: 'E-mail' },
  { value: 'YANDEX', label: 'Яндекс.Директ', group: 'Реклама' }, { value: 'VK', label: 'VK Реклама', group: 'Реклама' },
  { value: 'TG', label: 'Telegram', group: 'Мессенджеры' }, { value: 'WA', label: 'WhatsApp', group: 'Мессенджеры' }, { value: 'MAX', label: 'MAX', group: 'Мессенджеры' },
  { value: 'PARTNER', label: 'Партнёр' }, { value: 'REPEAT', label: 'Повторная продажа' },
];

const EDITOR_FIELDS: EditorField[] = [
  { id: 'title', label: 'Название', type: 'text', required: true },
  { id: 'sum', label: 'Сумма', type: 'money', currency: '₽' },
  { id: 'closeDate', label: 'Дата закрытия', type: 'date', hint: 'Планируемая дата завершения сделки' },
  { id: 'source', label: 'Источник', type: 'select', options: SOURCES },
  { id: 'owner', label: 'Ответственный', type: 'user', required: true, dialog: { items: USERS } },
  { id: 'observers', label: 'Наблюдатели', type: 'users', dialog: { load: searchUsers, tabs: SELECTOR_TABS } },
  { id: 'phone', label: 'Телефон', type: 'phone' },
  { id: 'email', label: 'E-mail', type: 'email' },
  { id: 'comment', label: 'Комментарий', type: 'textarea' },
  { id: 'repeat', label: 'Повторная сделка', type: 'boolean' },
];
const EDITOR_SECTIONS: EditorSection[] = [
  { id: 'main', title: 'О сделке', fields: ['title', 'sum', 'closeDate', 'source', 'owner', 'observers', 'repeat'] },
  { id: 'client', title: 'Клиент', fields: ['phone', 'email', 'comment'] },
];

interface FeedEntry { id: number; kind: 'comment' | 'activity' | 'stage' | 'sms' | 'created'; text: string; at: Date; done?: boolean; deadline?: string; overdue?: boolean; from?: string; to?: string }

const FILTER_FIELDS: FilterField[] = [
  { id: 'title', label: 'Название', type: 'text', b24Field: 'TITLE' },
  { id: 'stage', label: 'Стадия сделки', type: 'multiselect', b24Field: 'STAGE_ID', options: STAGES.map((s) => ({ value: s.id, label: s.name })) },
  { id: 'owner', label: 'Ответственный', type: 'select', b24Field: 'ASSIGNED_BY_ID', options: OWNERS.map((o) => ({ value: o, label: o })) },
  { id: 'sum', label: 'Сумма', type: 'number', b24Field: 'OPPORTUNITY' },
  { id: 'created', label: 'Дата создания', type: 'date', b24Field: 'DATE_CREATE' },
  { id: 'kind', label: 'Тип', type: 'select', default: false, options: [{ value: 'Первичная', label: 'Первичная' }, { value: 'Повторная', label: 'Повторная' }] },
  { id: 'missed', label: 'Пропущенный звонок', type: 'checkbox', default: false },
];

const INITIAL_PRESETS: FilterPreset[] = [
  { id: 'work', name: 'Сделки в работе', system: true, values: { stage: ['new', 'prep', 'invoice', 'work'] } },
  { id: 'won', name: 'Успешные', system: true, values: { stage: ['won'] } },
  { id: 'big', name: 'Крупные (от 100 000)', values: { sum: { from: '100000' } } },
];

/** Клиентская фильтрация демо-данных тем же состоянием, что уходит в REST. */
function matches(d: Deal, st: FilterState): boolean {
  const v = st.values;
  if (st.search && !d.title.toLowerCase().includes(st.search.toLowerCase())) return false;
  if (v.title && !d.title.toLowerCase().includes(String(v.title).toLowerCase())) return false;
  if (Array.isArray(v.stage) && v.stage.length && !v.stage.includes(d.stage)) return false;
  if (v.owner && d.owner !== v.owner) return false;
  if (v.kind && d.kind !== v.kind) return false;
  if (v.missed && (v.missed === 'Y') !== !!d.missed) return false;
  const sum = v.sum as { from?: string; to?: string } | undefined;
  if (sum?.from && d.sum < Number(sum.from)) return false;
  if (sum?.to && d.sum > Number(sum.to)) return false;
  const r = resolvePeriod(v.created as never);
  const created = parseDate(d.created);
  if (r && created && ((r.from && created < r.from) || (r.to && created > r.to))) return false;
  return true;
}

function DealsPage() {
  const [view, setView] = useState('list');
  const [filter, setFilter] = useState<FilterState>({ ...emptyFilterState, presetId: 'work', values: INITIAL_PRESETS[0].values });
  const [presets, setPresets] = useState(INITIAL_PRESETS);
  const [restFilter, setRestFilter] = useState<Record<string, unknown>>({});
  const [selected, setSelected] = useState<Array<string | number>>([]);
  const [page, setPage] = useState(1);
  const [deals, setDeals] = useState(DEALS);
  const [openDeal, setOpenDeal] = useState<Deal | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => deals.filter((d) => matches(d, filter)), [deals, filter]);
  const pageSize = 10;
  const pages = Math.ceil(filtered.length / pageSize);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  const columns: Column<Deal>[] = [
    {
      key: 'title', title: 'Сделка', sortable: true, pinned: true,
      render: (d) => (
        <>
          <a href="#" onClick={(e) => { e.preventDefault(); setOpenDeal(d); }}>{d.title}</a>
          {d.missed && <> <Badge tone="danger" size="sm">Пропущен</Badge></>}
          <div className="b24-table__muted">{d.kind}</div>
        </>
      ),
    },
    {
      key: 'stage', title: 'Стадия', sortable: true, sortValue: (d) => STAGES.findIndex((s) => s.id === d.stage),
      render: (d) => {
        const i = STAGES.findIndex((s) => s.id === d.stage);
        return <StageMini total={5} done={i + 1} color={STAGES[i].color} label={STAGES[i].name} />;
      },
    },
    { key: 'sum', title: 'Сумма', sortable: true, numeric: true, render: (d) => money(d.sum), editable: { type: 'number', value: (d) => String(d.sum) } },
    { key: 'owner', title: 'Ответственный', render: (d) => <User name={d.owner} href="#" />, editable: { type: 'select', options: OWNERS.map((o) => ({ value: o, label: o })) } },
    { key: 'created', title: 'Создана', sortable: true, sortValue: (d) => d.id },
  ];

  const total = filtered.reduce((s, d) => s + d.sum, 0);

  return (
    <div className="b24-stack" style={{ ['--b24-gap' as string]: '16px' }}>
      <PageHeader
        title="Сделки"
        create={{
          onClick: () => setCreateOpen(true),
          menu: [
            { label: 'Сделку', icon: 'deal', onClick: () => setCreateOpen(true) },
            { label: 'Из шаблона', icon: 'copy' },
            { type: 'divider' },
            { label: 'Импорт', icon: 'upload', hint: 'CSV' },
          ],
        }}
        filter={
          <Filter
            glass
            fields={FILTER_FIELDS}
            presets={presets}
            onPresetsChange={setPresets}
            value={filter}
            onChange={(st, rest) => { setFilter(st); setRestFilter(rest); setPage(1); }}
          />
        }
        tools={
          <Dropdown
            placement="bottom-end"
            trigger={<Button variant="glass" iconOnly icon="settings" aria-label="Настройки" />}
            items={[
              { type: 'title', label: 'Вид' },
              { label: 'Компактный', checked: true },
              { label: 'Показывать итоги', checked: false },
              { type: 'divider' },
              { label: 'Экспорт в Excel', icon: 'download' },
            ]}
          />
        }
        views={{
          value: view, onChange: setView, items: [
            { id: 'kanban', label: 'Канбан' }, { id: 'list', label: 'Список' }, { id: 'activity', label: 'Дела' }, { id: 'calendar', label: 'Календарь' },
          ],
        }}
        counters={[{ label: 'Входящие', count: 23, tone: 'success' }, { label: 'Запланированные', count: 0 }]}
        extra={<Button variant="glass" size="sm">Роботы</Button>}
      />

      {view === 'list' ? (
        <>
          <div className="b24-dashboard">
            <Kpi span={3} label="Сделок в работе" value={filtered.length} delta="12%" period="к прошлой неделе" trend="up" spark={[18, 21, 19, 24, 26, filtered.length]} />
            <Kpi span={3} label="Сумма" value={money(total)} />
            <Kpi span={3} label="Конверсия" value="18,4%" delta="2,1 п. п." trend="down" spark={[21, 20.8, 20.1, 19.6, 18.9, 18.4]} />
            <Card className="b24-span-3" title="По стадиям">
              <Chart type="donut" height={120} labels={STAGES.slice(0, 4).map((st) => st.name)} series={[{ name: 'Сделки', data: STAGES.slice(0, 4).map((st) => filtered.filter((d) => d.stage === st.id).length) }]} title="Сделки по стадиям" />
            </Card>
          </div>
          <DataTable
            columns={columns}
            rows={visible}
            rowKey={(d) => d.id}
            selectable
            selected={selected}
            onSelectionChange={setSelected}
            stateKey="demo-react-deals"
            onCellEdit={async (d, key, value) => {
              await new Promise((r) => setTimeout(r, 400));
              if (key === 'sum') {
                const n = Number(value.replace(/\s/g, '').replace(',', '.'));
                if (n > 10_000_000) throw new Error('Сервер: сумма больше 10 000 000 ₽ требует согласования');
                setDeals((l) => l.map((x) => (x.id === d.id ? { ...x, sum: n } : x)));
              }
              if (key === 'owner') setDeals((l) => l.map((x) => (x.id === d.id ? { ...x, owner: value } : x)));
              toast('Сохранено', { type: 'success' });
            }}
            resizable
            reorderable
            columnSettings
            rowActions={(d) => [
              { label: 'Открыть', icon: 'eye', onClick: () => setOpenDeal(d) },
              { label: 'Копировать', icon: 'copy', onClick: () => toast(`Скопировано: ${d.title}`) },
              { type: 'divider' },
              { label: 'Удалить', icon: 'trash', danger: true, onClick: () => { setDeals((l) => l.filter((x) => x.id !== d.id)); toast('Сделка удалена', { type: 'success' }); } },
            ]}
            groupActions={[
              { id: 'export', label: 'Выгрузить', icon: 'download', onClick: (ids) => toast(`Выгружено: ${ids.length}`) },
              { id: 'delete', label: 'Удалить', icon: 'trash', variant: 'tinted-danger', confirm: 'Удалить отмеченные сделки ({n})?', onClick: (ids) => {
                setDeals((list) => list.filter((d) => !ids.includes(d.id)));
                setSelected([]);
                toast('Сделки удалены', { type: 'success', action: { label: 'Отменить', onClick: () => setDeals(DEALS) } });
              } },
            ]}
            footer={
              <>
                <span>Всего: {filtered.length}</span>
                <span className="b24-spacer" />
                <Pagination page={page} pages={pages} onChange={setPage} />
              </>
            }
          />
        </>
      ) : view === 'kanban' ? (
        <Kanban
          columns={STAGES.map((s) => {
            const list = filtered.filter((d) => d.stage === s.id);
            return { id: s.id, title: s.name, color: s.color, total: money(list.reduce((a, d) => a + d.sum, 0)) };
          })}
          items={Object.fromEntries(STAGES.map((s) => [s.id, filtered.filter((d) => d.stage === s.id)]))}
          getId={(d) => d.id}
          getAccent={(d) => (d.missed ? '#ff5752' : undefined)}
          onMove={async (m) => {
            if (m.to === 'lost' && m.from !== 'lost') {
              const ok = await confirm('Сделка будет отмечена как проваленная.', { title: 'Провалить сделку?', okText: 'Провалить', danger: true });
              if (!ok) return false;
            }
            setDeals((list) => {
              const grouped = Object.fromEntries(STAGES.map((s) => [s.id, list.filter((d) => d.stage === s.id)]));
              const moved = applyKanbanMove(grouped, m, (d) => d.id);
              return STAGES.flatMap((s) => (moved[s.id] ?? []).map((d) => ({ ...d, stage: s.id })));
            });
            const stage = STAGES.find((s) => s.id === m.to)!;
            if (m.from !== m.to) toast(`Сделка перенесена в «${stage.name}»`, { type: 'success' });
          }}
          onAdd={() => setCreateOpen(true)}
          onCardClick={(d) => setOpenDeal(d)}
          emptyText="Перетащите сюда сделку"
          renderCard={(d) => (
            <KanbanCard
              title={d.title}
              price={money(d.sum)}
              fields={[{ label: 'Ответственный', value: <User name={d.owner} size="xs" /> }]}
              footer={d.missed ? <Badge tone="danger" size="sm">Пропущен</Badge> : '+ Дело'}
              footerRight={d.created}
            >
              <span className="b24-row" style={{ ['--b24-gap' as string]: '4px' }}><Badge size="sm" tone={d.kind === 'Повторная' ? 'violet' : 'primary'}>{d.kind}</Badge></span>
            </KanbanCard>
          )}
        />
      ) : view === 'calendar' ? (
        <CalendarDemo />
      ) : (
        <Card><Alert tone="primary" title="Раздел в разработке">Вид «{view}» пока не реализован в демо.</Alert></Card>
      )}
      {Object.keys(restFilter).length > 0 && view === 'list' && (
        <Card title="Фильтр для REST" subtitle="toBitrixFilter() — можно отдавать в crm.deal.list">
          <pre className="b24-mono b24-text-sm" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(restFilter, null, 2)}</pre>
        </Card>
      )}

      <SidePanel
        open={!!openDeal}
        onClose={() => setOpenDeal(null)}
        title={openDeal?.title}
        air
        headerActions={<Button variant="glass" size="sm" icon="more" iconOnly aria-label="Ещё" />}
      >
        {openDeal && (
          <div className="b24-stack" style={{ ['--b24-gap' as string]: '16px' }}>
            <Stages
              stages={STAGES}
              current={openDeal.stage}
              onChange={(id) => {
                setDeals((list) => list.map((d) => (d.id === openDeal.id ? { ...d, stage: id } : d)));
                setOpenDeal({ ...openDeal, stage: id });
              }}
            />
            <div className="b24-grid" style={{ ['--b24-grid-min' as string]: '340px', alignItems: 'start' }}>
              <DealEditor deal={openDeal} onSaved={(title) => {
                setDeals((list) => list.map((d) => (d.id === openDeal.id ? { ...d, title } : d)));
                setOpenDeal({ ...openDeal, title });
              }} />
              <DealTimeline key={openDeal.id} deal={openDeal} />
            </div>
          </div>
        )}
      </SidePanel>

      <CreateDealModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={(d) => { setDeals((l) => [d, ...l]); setPage(1); }} />
    </div>
  );
}

function CreateDealModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (d: Deal) => void }) {
  const [title, setTitle] = useState('');
  const [sum, setSum] = useState('');
  const [closeDate, setCloseDate] = useState<Date | null>(null);
  const [owner, setOwner] = useState<DialogItem | null>(USERS[5]);
  const [observers, setObservers] = useState<DialogItem[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [channels, setChannels] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!title.trim()) { setError('Укажите название'); return; }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    onCreate({ id: Date.now(), title, kind: 'Первичная', stage: 'new', sum: Number(sum) || 0, owner: owner?.title ?? 'Григорий Воронцов', created: 'сегодня' });
    setSaving(false); setTitle(''); setSum(''); setError('');
    onClose();
    toast('Сделка создана', { type: 'success' });
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новая сделка"
      footer={<><Button variant="success" loading={saving} onClick={submit}>Создать</Button><Button variant="link" onClick={onClose}>Отмена</Button></>}
    >
      <div className="b24-form">
        <Field label="Название" required error={error}>
          <Input autoFocus value={title} onChange={(e) => { setTitle(e.target.value); setError(''); }} placeholder="Например, Поставка оборудования" />
        </Field>
        <div className="b24-form-row">
          <Field label="Сумма, ₽"><Input inputMode="decimal" value={sum} onChange={(e) => setSum(e.target.value)} /></Field>
          <Field label="Воронка"><Select options={[{ value: 'main', label: 'Общая' }, { value: 'school', label: 'Розница' }]} /></Field>
        </div>
        <Field label="Дата закрытия" hint="Можно ввести вручную: 30.09.2026">
          <DatePicker value={closeDate} onChange={setCloseDate} min={new Date()} />
        </Field>
        <div className="b24-form-row">
          <Field label="Ответственный" required><EntitySelector value={owner} onChange={setOwner} items={USERS} /></Field>
          <Field label="Источник"><Combobox value={source} onChange={(v) => setSource(v)} options={SOURCES} placeholder="Выберите источник" /></Field>
        </div>
        <Field label="Наблюдатели" hint="Поиск идёт «на сервере» — как bx24UserLoader() в портале">
          <EntitySelector multiple value={observers} onChange={setObservers} load={searchUsers} tabs={SELECTOR_TABS} />
        </Field>
        <Field label="Каналы связи"><Combobox multiple value={channels} onChange={(v) => setChannels(v)} options={SOURCES.filter((o) => o.group === 'Мессенджеры')} placeholder="Не выбрано" /></Field>
        <Field label="Документы"><Uploader compact accept=".pdf,.doc,.docx,image/*" maxSize={10 * 1024 * 1024} /></Field>
        <Switch label="Повторная сделка" description="Клиент уже покупал ранее" />
      </div>
    </Modal>
  );
}

function DealEditor({ deal, onSaved }: { deal: Deal; onSaved: (title: string) => void }) {
  const values: EditorValues = useMemo(() => ({
    title: deal.title,
    sum: String(deal.sum),
    closeDate: '30.09.2026',
    source: 'CALL',
    owner: userByName(deal.owner),
    observers: [USERS[7]],
    phone: '+7 900 123-45-67',
    email: '',
    comment: '',
    repeat: deal.kind === 'Повторная',
  }), [deal.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <EntityEditor
      fields={EDITOR_FIELDS}
      sections={EDITOR_SECTIONS}
      values={values}
      onSave={async (v, changed) => {
        await new Promise((r) => setTimeout(r, 500));
        if (String(v.title).toLowerCase().includes('ошибка')) return { title: 'Сервер: такое название уже занято' };
        onSaved(String(v.title));
        toast(`Сохранено: ${changed.join(', ') || 'без изменений'}`, { type: 'success' });
      }}
    />
  );
}

function DealTimeline({ deal }: { deal: Deal }) {
  const now = new Date();
  const ago = (min: number) => new Date(now.getTime() - min * 60000);
  const [feed, setFeed] = useState<FeedEntry[]>([
    { id: 1, kind: 'activity', text: 'Перезвонить клиенту и уточнить состав заказа', at: ago(30), deadline: 'сегодня, 18:00', overdue: false },
    { id: 2, kind: 'activity', text: 'Отправить коммерческое предложение', at: ago(60 * 26), deadline: 'вчера, 12:00', overdue: true },
    { id: 3, kind: 'sms', text: 'Спасибо за регистрацию! Для быстрой связи с менеджерами: t.me/example', at: ago(42) },
    { id: 4, kind: 'stage', text: '', from: 'Новая', to: 'Подготовка документов', at: ago(55) },
    { id: 5, kind: 'created', text: deal.title, at: ago(60 * 24 * 3) },
  ]);
  const activities = feed.filter((f) => f.kind === 'activity' && !f.done);
  const history = feed.filter((f) => !(f.kind === 'activity' && !f.done)).sort((a, b) => +b.at - +a.at);
  const toggle = (id: number, done: boolean) => {
    setFeed((l) => l.map((f) => (f.id === id ? { ...f, done } : f)));
    if (done) toast('Дело выполнено', { type: 'success' });
  };
  const renderEntry = (f: FeedEntry) => {
    const time = formatTimelineTime(f.at);
    switch (f.kind) {
      case 'activity':
        return <TimelineActivity key={f.id} title={f.text} time={time} deadline={f.deadline} overdue={f.overdue} done={f.done} onToggle={(d) => toggle(f.id, d)} />;
      case 'comment':
        return <TimelineItem key={f.id} icon="comment" tone="gray" title="Комментарий" time={time} actions={<Button variant="plain" size="xs" iconOnly icon="more" aria-label="Действия" />}><p>{f.text}</p></TimelineItem>;
      case 'sms':
        return <TimelineItem key={f.id} icon="sms" title="Отправлено SMS-сообщение" time={time}><div className="b24-timeline__quote">{f.text}</div><div className="b24-timeline__meta">Отправлено роботом · <a href="#">{deal.owner}</a></div></TimelineItem>;
      case 'stage':
        return <TimelineItem key={f.id} icon="arrowRight" tone="outline" title="Стадия изменена" time={time}><span className="b24-timeline__change"><Badge>{f.from}</Badge><Icon name="arrowRight" /><Badge tone="primary">{f.to}</Badge></span></TimelineItem>;
      case 'created':
        return <TimelineItem key={f.id} icon="plus" tone="outline" title="Создана сделка" time={time}>{f.text}</TimelineItem>;
    }
  };
  return (
    <div className="b24-stack" style={{ ['--b24-gap' as string]: '12px' }}>
      <TimelineComposer
        tabs={[
          { id: 'comment', label: 'Комментарий', placeholder: 'Оставьте комментарий' },
          { id: 'activity', label: 'Дело', placeholder: 'Что нужно сделать' },
          { id: 'sms', label: 'SMS', placeholder: 'Текст сообщения клиенту' },
        ]}
        tools={<Button variant="plain" size="xs" iconOnly icon="paperclip" aria-label="Прикрепить файл" />}
        onSubmit={async (text, tab) => {
          await new Promise((r) => setTimeout(r, 300));
          const entry: FeedEntry = tab === 'activity'
            ? { id: Date.now(), kind: 'activity', text, at: new Date(), deadline: 'завтра, 10:00' }
            : { id: Date.now(), kind: tab === 'sms' ? 'sms' : 'comment', text, at: new Date() };
          setFeed((l) => [entry, ...l]);
        }}
      />
      <Timeline>
        {activities.length > 0 && <TimelineDivider tone="success">Что нужно сделать</TimelineDivider>}
        {activities.map(renderEntry)}
        <TimelineDivider>История</TimelineDivider>
        {history.map(renderEntry)}
        <TimelineItem icon="paperclip" tone="violet" title="Файлы" time="вчера, 16:20">
          <Uploader view="grid" files={[{ id: 1, name: 'Договор.pdf', size: 248000 }, { id: 2, name: 'Счёт_42.xlsx', size: 31200 }]}
            upload={(file, { onProgress, signal }) => new Promise((resolve, reject) => {
              let p = 0;
              const t = setInterval(() => {
                p += 20; onProgress(p);
                if (p >= 100) { clearInterval(t); file.name.includes('fail') ? reject(new Error('Сервер отклонил файл')) : resolve({ id: Date.now() }); }
              }, 200);
              signal.addEventListener('abort', () => clearInterval(t));
            })}
          />
        </TimelineItem>
      </Timeline>
    </div>
  );
}

function CalendarDemo() {
  const [date, setDate] = useState<Date | null>(new Date());
  const [dateTime, setDateTime] = useState<Date | null>(null);
  const [range, setRange] = useState<DateRange>({ from: null, to: null });
  return (
    <div className="b24-grid" style={{ ['--b24-grid-min' as string]: '300px' }}>
      <Card title="DatePicker">
        <div className="b24-form">
          <Field label="Дата"><DatePicker value={date} onChange={setDate} /></Field>
          <Field label="Дата и время"><DatePicker value={dateTime} onChange={setDateTime} withTime /></Field>
        </div>
      </Card>
      <Card title="DateRangePicker">
        <Field label="Период" hint="Слева — быстрые периоды"><DateRangePicker value={range} onChange={setRange} /></Field>
      </Card>
    </div>
  );
}

function Demo() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [section, setSection] = useState('crm');
  return (
    <B24Provider theme={theme}>
      <AppShell
        vendor={{
          name: 'Кедр Софт',
          logoOnDark: 'vendor-logo-on-dark.svg',
          logo: 'vendor-logo.svg',
          icon: 'vendor-icon.svg',
          app: { name: 'Мини-CRM', version: '0.9.2' },
          links: {
            support: () => openSidePanel({ title: 'Мои обращения', content: 'Здесь список обращений в поддержку разработчика.', width: 700 }),
            newTicket: () => modal({ title: 'Новое обращение', content: 'Форма обращения в поддержку.', buttons: [{ text: 'Отправить', variant: 'primary' }, { text: 'Отмена', variant: 'link' }] }),
            privacy: 'https://example.com/privacy',
            contacts: 'https://example.com/contacts',
            site: 'https://example.com',
            marketplace: 'https://example.com/market',
          },
        }}
        sidebar={
          <Sidebar brand="Мой портал">
            <SidebarItem icon="home" label="Главная" active={section === 'home'} onClick={() => setSection('home')} />
            <SidebarItem icon="crm" label="CRM" counter={37} active={section === 'crm'} onClick={() => setSection('crm')} />
            <SidebarItem icon="tasks" label="Задачи" counter={4} active={section === 'tasks'} onClick={() => setSection('tasks')} />
            <SidebarGroup title="Совместная работа">
              <SidebarItem icon="chat" label="Мессенджер" counter={12} />
              <SidebarItem icon="calendar" label="Календарь" />
              <SidebarItem icon="folder" label="Диск" />
            </SidebarGroup>
            <SidebarItem icon="robot" label="Автоматизация" />
            <SidebarItem icon="apps" label="Приложения" />
            <SidebarItem icon="settings" label="Настройки" />
          </Sidebar>
        }
        header={
          <>
            <TopNav items={[
              { label: 'Сделки', active: true, counter: 24 }, { label: 'Счета' }, { label: 'Компании' }, { label: 'Контакты', counter: 13 }, { label: 'Аналитика' },
            ]} />
            <span className="b24-spacer" />
            <Button variant="glass" size="sm" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}</Button>
            <a className="b24-btn b24-btn--glass b24-btn--sm b24-hide-mobile" href="index.html">Витрина</a>
          </>
        }
      >
        {section === 'crm' ? <DealsPage /> : (
          <Card><Alert title="Демо">Раздел «{section}» — заглушка. Откройте CRM.</Alert></Card>
        )}
        <Credit />
      </AppShell>
    </B24Provider>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Demo /></StrictMode>);
