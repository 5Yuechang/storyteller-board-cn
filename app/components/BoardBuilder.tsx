'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AlertTriangle, BellRing, BookOpen, Check, ChevronDown, ChevronRight, ChevronUp, CircleHelp, Dice5, EyeOff, Gauge, LayoutGrid, Lightbulb, List, Lock, Maximize2, Moon, Play, Plus, RotateCcw, ShieldCheck, Shuffle, Skull, Sparkles, Sunrise, Trash2, UserRound, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { alignmentMeta, scripts, type Alignment, type NightStep, type Role } from '@/app/data/scripts';
import { evaluateBoardBalance } from '@/app/data/balance';
import { specialAttention } from '@/app/data/special-attention';

const alignments: Alignment[] = ['townsfolk', 'outsider', 'minion', 'demon'];
type ViewMode = 'roles' | 'seats' | 'night' | 'advice' | 'history';
type GamePhase = 'firstNight'|'day'|'night';
type LogKind = 'system'|'death'|'status'|'role'|'night'|'note';
type LogEntry = { id:string; dayNumber:number; phase:GamePhase; kind:LogKind; title:string; detail?:string; createdAt:number };
type SeatStatus = 'poisoned'|'drunk'|'protected'|'noAbility'|'abilityUsed'|'turnedGood'|'turnedEvil';
type Seat = { number: number; roleId: string | null; alive: boolean; statuses: SeatStatus[] };
type SavedGameState = {
  version:number; savedAt:number; scriptId:string; playerCount:number; selected:string[]; locked:string[]; view:ViewMode;
  seats:Seat[]; activeSeat:number; nightMode:'first'|'other'; nightFocusMode:boolean; completedSteps:string[];
  gameStarted:boolean; gamePhase:GamePhase; dayNumber:number; gameLog:LogEntry[]; demonBluffs:(string|null)[];
};

const seatStatusMeta: Record<SeatStatus, { label: string; short: string }> = {
  poisoned:{label:'中毒',short:'毒'}, drunk:{label:'醉酒',short:'醉'}, protected:{label:'受保护',short:'护'},
  noAbility:{label:'失去能力',short:'封'}, abilityUsed:{label:'能力已使用',short:'用'},
  turnedGood:{label:'已转为善良',short:'善'}, turnedEvil:{label:'已转为邪恶',short:'恶'},
};
const seatStatuses = Object.keys(seatStatusMeta) as SeatStatus[];
const localGameKey = 'storyteller-board-current-game-v2';
const phaseName = (phase: GamePhase, dayNumber: number) => phase === 'firstNight' ? '首个夜晚' : `第 ${dayNumber} ${phase === 'day' ? '天' : '夜'}`;

const makeSeats = (count: number): Seat[] => Array.from({ length: count }, (_, index) => ({ number: index + 1, roleId: null, alive: true, statuses: [] }));
const withBalloonistSetup = (quota: Record<Alignment, number>, enabled: boolean): Record<Alignment, number> => enabled ? {
  ...quota,
  townsfolk: Math.max(0, quota.townsfolk - 1),
  outsider: quota.outsider + 1,
} : quota;
const shuffled = <T,>(items: T[]) => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1));
    [result[index], result[next]] = [result[next], result[index]];
  }
  return result;
};

function RoleIcon({ role, className = '' }: { role: Role; className?: string }) {
  return <img className={`role-icon ${className}`} src={`/roles/${role.id}.webp`} alt="" aria-hidden="true"/>;
}

function RoleCard({ role, selected, locked, onSelect, onLock }: { role: Role; selected: boolean; locked: boolean; onSelect: () => void; onLock: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return <article className={`role-card role-${role.alignment} ${selected ? 'is-selected' : ''} ${expanded ? 'is-expanded' : ''}`}>
    <div className="role-topline">
      <Checkbox checked={selected} onCheckedChange={onSelect} aria-label={`选择${role.name}`} />
      <RoleIcon role={role}/>
      <button className="role-name" onClick={onSelect}>{role.name}</button>
      <span className="timing">{role.timing}</span>
      <button className="role-expand" onClick={() => setExpanded((open) => !open)} aria-expanded={expanded} aria-label={`${expanded ? '收起' : '查看'}${role.name}技能`}>{expanded ? <ChevronUp/> : <ChevronDown/>}</button>
      <button className={`lock-button ${locked ? 'is-locked' : ''}`} onClick={onLock} aria-label={`${locked ? '取消锁定' : '锁定'}${role.name}`} title={locked ? '取消锁定' : '锁定角色'}><Lock size={14}/></button>
    </div>
    <div className="role-details"><p>{role.ability}</p>
      <div className="role-foot">{role.setup && <span className="setup">配置：{role.setup}</span>}{role.note && <span className="data-note"><CircleHelp size={12}/>{role.note}</span>}</div>
    </div>
  </article>;
}

function SeatMap({ seats, roles, activeSeat, onSelect }: { seats: Seat[]; roles: Role[]; activeSeat: number; onSelect: (number: number) => void }) {
  const aliveCount = seats.filter((seat) => seat.alive).length;
  const deathsUntilEvilWin = Math.max(0, aliveCount - 2);
  const demonSeats = seats.filter((seat) => roles.find((role) => role.id === seat.roleId)?.alignment === 'demon');
  const demonDefeated = demonSeats.length > 0 && demonSeats.every((seat) => !seat.alive);
  return <div className="seat-ring" aria-label={`${seats.length}人环形座位图`}>
    <div className="ring-lines" aria-hidden="true"><span/><span/><span/></div>
    <div className={`ring-center ${demonDefeated ? 'is-good-win' : ''}`}><span>{aliveCount}</span><small>存活</small><b>{seats.length} 人魔典</b><em>{demonDefeated ? '恶魔死亡 · 善良胜利' : deathsUntilEvilWin ? `再死亡 ${deathsUntilEvilWin} 人` : '已到邪恶胜利线'}</em></div>
    {seats.map((seat, index) => {
      const angle = (index / seats.length) * Math.PI * 2;
      const role = roles.find((item) => item.id === seat.roleId);
      const side = seat.statuses.includes('turnedEvil') ? 'evil' : seat.statuses.includes('turnedGood') ? 'good' : role && (role.alignment === 'minion' || role.alignment === 'demon') ? 'evil' : role ? 'good' : '';
      return <button
        key={seat.number}
        className={`seat-token ${role ? `seat-${role.alignment}` : ''} ${side ? `seat-side-${side}` : ''} ${seat.alive ? 'is-alive' : 'is-dead'} ${activeSeat === seat.number ? 'is-active' : ''}`}
        style={{
          '--seat-left': `${50 + Math.sin(angle) * 43}%`,
          '--seat-top': `${50 - Math.cos(angle) * 43}%`,
          '--seat-left-mobile': `${50 + Math.sin(angle) * 38}%`,
          '--seat-top-mobile': `${50 - Math.cos(angle) * 38}%`,
        } as CSSProperties}
        onClick={() => onSelect(seat.number)}
        aria-label={`${seat.number}号，${role?.name ?? '未分配'}，${seat.alive ? '存活' : '死亡'}`}
      >
        <span><b>{seat.number}号</b><i>{seat.alive ? '存活' : '死亡'}</i></span>
        <strong>{role && <RoleIcon role={role}/>}<span>{role?.name ?? '未分配身份'}</span></strong>
        {!!seat.statuses.length && <span className="seat-status-list">{seat.statuses.map((status) => <i key={status} className={`seat-status status-${status}`} title={seatStatusMeta[status].label}>{seatStatusMeta[status].short}</i>)}</span>}
      </button>;
    })}
  </div>;
}

function visibleNightSteps(steps: NightStep[], selected: Set<string>, seats: Seat[], roles: Role[]) {
  return steps.filter((step) => {
    if (step.requiredAlignment && !roles.some((role) => role.alignment === step.requiredAlignment && selected.has(role.id))) return false;
    if (step.skipWhenRolePresent && selected.has(step.skipWhenRolePresent)) return false;
    if (!step.roleId) return true;
    if (!selected.has(step.roleId)) return false;
    const assignedSeat = seats.find((seat) => seat.roleId === step.roleId);
    if (!assignedSeat) return step.deadMode !== 'only';
    const assignedRole = roles.find((role) => role.id === step.roleId);
    if (assignedSeat.statuses.includes('noAbility')) return false;
    if (assignedSeat.statuses.includes('abilityUsed') && assignedRole?.timing === '一次') return false;
    if (step.deadMode === 'show') return true;
    if (step.deadMode === 'only') return !assignedSeat.alive;
    return assignedSeat.alive;
  });
}

function nightStepDetail(step: NightStep, selected: Set<string>, roles: Role[], bluffs: (string|null)[]) {
  const isDemonInfo = step.id.endsWith('demon-info');
  const poppyDemonInfo = selected.has('poppy-grower') && isDemonInfo;
  const bluffNames = isDemonInfo ? bluffs.map((id) => roles.find((role) => role.id === id)?.name).filter(Boolean) : [];
  return isDemonInfo && bluffNames.length ? `${poppyDemonInfo ? '罂粟种植者在场：不告知爪牙。' : step.note} 说书人展示给恶魔：${bluffNames.join('、')}。` : poppyDemonInfo ? '罂粟种植者在场：说书人只向恶魔展示三项伪装，不告知爪牙。' : step.note;
}

function NightList({ title, steps, selected, seats, roles, bluffs, completed, onToggle }: { title: string; steps: NightStep[]; selected: Set<string>; seats: Seat[]; roles: Role[]; bluffs: (string|null)[]; completed: Set<string>; onToggle: (id: string) => void }) {
  const visible = visibleNightSteps(steps, selected, seats, roles);
  return <section className="night-list">
    <div className="night-list-heading"><div><span className="eyebrow">WAKE ORDER</span><h3>{title}</h3></div><b>{visible.filter((step) => completed.has(step.id)).length} / {visible.length}</b></div>
    <ol>{visible.map((step, index) => {
      const assignedSeat = step.roleId ? seats.find((seat) => seat.roleId === step.roleId) : undefined;
      const assignedRole = step.roleId ? roles.find((role) => role.id === step.roleId) : undefined;
      const demonInfo = nightStepDetail(step, selected, roles, bluffs);
      return <li key={step.id} className={completed.has(step.id) ? 'is-complete' : ''}>
        <span className="night-index">{String(index + 1).padStart(2, '0')}</span>
        <Checkbox checked={completed.has(step.id)} onCheckedChange={() => onToggle(step.id)} aria-label={`完成${step.name}`}/>
        {assignedRole ? <RoleIcon role={assignedRole} className="night-role-icon"/> : <span className="night-role-icon system-icon"><Moon/></span>}
        <button onClick={() => onToggle(step.id)}><strong>{step.name}</strong><small>{demonInfo}</small></button>
        <span className={`phase phase-${step.phase}`}>{step.phase}</span>
        {assignedRole && <span className={`night-seat night-seat-${assignedRole.alignment}`}>{assignedSeat ? `${assignedSeat.number}号${assignedSeat.alive ? '' : ' · 已死亡'}` : '未入座'}</span>}
      </li>;
    })}</ol>
  </section>;
}

function NightFocus({ title, steps, selected, seats, roles, bluffs, completed, onToggle }: { title:string; steps:NightStep[]; selected:Set<string>; seats:Seat[]; roles:Role[]; bluffs:(string|null)[]; completed:Set<string>; onToggle:(id:string) => void }) {
  const visible = visibleNightSteps(steps, selected, seats, roles);
  const currentIndex = visible.findIndex((step) => !completed.has(step.id));
  const current = currentIndex >= 0 ? visible[currentIndex] : undefined;
  if (!current) return <section className="night-focus night-focus-complete"><Check/><span className="eyebrow">{title}</span><h3>本轮夜序已完成</h3><p>所有需要处理的角色都已标记完成。</p></section>;
  const assignedSeat = current.roleId ? seats.find((seat) => seat.roleId === current.roleId) : undefined;
  const assignedRole = current.roleId ? roles.find((role) => role.id === current.roleId) : undefined;
  const detail = nightStepDetail(current, selected, roles, bluffs);
  return <section className="night-focus">
    <header><span>{String(currentIndex + 1).padStart(2,'0')} / {String(visible.length).padStart(2,'0')}</span><b>{title}</b></header>
    <div className="night-focus-role">{assignedRole ? <RoleIcon role={assignedRole}/> : <span className="night-focus-system"><Moon/></span>}<div><small>{current.phase}{assignedSeat ? ` · ${assignedSeat.number}号座位` : assignedRole ? ' · 未入座' : ''}</small><h3>{current.name}</h3>{assignedRole && <span>{alignmentMeta[assignedRole.alignment].short}</span>}</div></div>
    {assignedRole && <div className="night-focus-block"><small>角色能力</small><p>{assignedRole.ability}</p></div>}
    <div className="night-focus-block is-action"><small>本步提示</small><p>{detail}</p></div>
    <Button className="night-focus-next" onClick={() => onToggle(current.id)}><Check/>完成并进入下一位<ChevronRight/></Button>
    <p className="night-focus-hint">如需返回修改已完成步骤，可切换至“完整列表”。</p>
  </section>;
}

export default function BoardBuilder() {
  const [scriptId, setScriptId] = useState(scripts[0].id);
  const [playerCount, setPlayerCount] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [view, setView] = useState<ViewMode>('roles');
  const [seats, setSeats] = useState<Seat[]>(makeSeats(10));
  const [activeSeat, setActiveSeat] = useState(1);
  const [nightMode, setNightMode] = useState<'first'|'other'>('first');
  const [nightFocusMode, setNightFocusMode] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [gameStarted, setGameStarted] = useState(false);
  const [gamePhase, setGamePhase] = useState<GamePhase>('firstNight');
  const [dayNumber, setDayNumber] = useState(1);
  const [gameLog, setGameLog] = useState<LogEntry[]>([]);
  const [manualNote, setManualNote] = useState('');
  const [demonBluffs, setDemonBluffs] = useState<(string|null)[]>([null,null,null]);
  const [historyReady, setHistoryReady] = useState(false);
  const [mobileBoardOpen, setMobileBoardOpen] = useState(false);
  const script = scripts.find((item) => item.id === scriptId) ?? scripts[0];
  const baseQuota = script.counts[playerCount];
  const balloonistSetupActive = selected.has('balloonist');
  const quota = useMemo(() => withBalloonistSetup(baseQuota, balloonistSetupActive), [baseQuota, balloonistSetupActive]);
  const selectedRoles = script.roles.filter((role) => selected.has(role.id));
  const boardBalance = useMemo(() => evaluateBoardBalance(selectedRoles), [selectedRoles]);
  const attentionRoles = selectedRoles.flatMap((role) => (specialAttention[role.id] ?? []).map((item) => ({ role, item })));
  const blueFactor = [...boardBalance.factors].filter((factor) => factor.value > 0).sort((a,b) => b.value - a.value)[0];
  const redFactor = [...boardBalance.factors].filter((factor) => factor.value < 0).sort((a,b) => a.value - b.value)[0];
  const availableBluffs = script.roles.filter((role) => (role.alignment === 'townsfolk' || role.alignment === 'outsider') && !selected.has(role.id));
  const adviceRoles = selectedRoles.filter((role) => role.misinformation?.length);
  const activeSeatState = seats.find((seat) => seat.number === activeSeat) ?? seats[0];
  const totals = useMemo(() => Object.fromEntries(alignments.map((alignment) => [alignment, selectedRoles.filter((role) => role.alignment === alignment).length])) as Record<Alignment, number>, [selectedRoles]);
  const aliveCount = seats.filter((seat) => seat.alive).length;
  const deathsUntilEvilWin = Math.max(0, aliveCount - 2);
  const demonSeats = seats.filter((seat) => script.roles.find((role) => role.id === seat.roleId)?.alignment === 'demon');
  const demonDefeated = demonSeats.length > 0 && demonSeats.every((seat) => !seat.alive);

  useEffect(() => {
    let cancelled = false;
    const restore = (saved: Partial<SavedGameState>) => {
      const savedScript = scripts.find((item) => item.id === saved.scriptId);
      const savedCount = Number(saved.playerCount);
      if (!savedScript || !savedScript.counts[savedCount] || cancelled) return false;
      const roleIds = new Set(savedScript.roles.map((role) => role.id));
      const restoredSeats = Array.from({ length:savedCount }, (_, index) => {
        const seat = Array.isArray(saved.seats) ? saved.seats[index] : undefined;
        return { number:index + 1, roleId:seat?.roleId && roleIds.has(seat.roleId) ? seat.roleId : null, alive:seat?.alive !== false, statuses:Array.isArray(seat?.statuses) ? seat.statuses.filter((status) => seatStatuses.includes(status)) : [] };
      });
      setScriptId(savedScript.id); setPlayerCount(savedCount);
      setSelected(new Set(Array.isArray(saved.selected) ? saved.selected.filter((id) => roleIds.has(id)) : []));
      setLocked(new Set(Array.isArray(saved.locked) ? saved.locked.filter((id) => roleIds.has(id)) : []));
      setView(['roles','seats','night','advice','history'].includes(saved.view ?? '') ? saved.view! : 'roles');
      setSeats(restoredSeats); setActiveSeat(Math.min(Math.max(1,Number(saved.activeSeat) || 1),savedCount));
      setNightMode(saved.nightMode === 'other' ? 'other' : 'first'); setNightFocusMode(Boolean(saved.nightFocusMode));
      setCompletedSteps(new Set(Array.isArray(saved.completedSteps) ? saved.completedSteps : []));
      setGameStarted(Boolean(saved.gameStarted)); setGamePhase(['firstNight','day','night'].includes(saved.gamePhase ?? '') ? saved.gamePhase! : 'firstNight');
      setDayNumber(Math.max(1,Number(saved.dayNumber) || 1)); setGameLog(Array.isArray(saved.gameLog) ? saved.gameLog : []);
      setDemonBluffs(Array.isArray(saved.demonBluffs) ? [0,1,2].map((index) => saved.demonBluffs?.[index] ?? null) : [null,null,null]);
      return true;
    };
    const load = async () => {
      let localState: Partial<SavedGameState>|null = null;
      let remoteState: Partial<SavedGameState>|null = null;
      try {
        const raw = window.localStorage?.getItem(localGameKey);
        if (raw) localState = JSON.parse(raw) as Partial<SavedGameState>;
      } catch { window.localStorage?.removeItem(localGameKey); }
      try {
        const response = await fetch('/api/game-history');
        if (response.ok) {
          const body = await response.json() as { state?:Partial<SavedGameState>|null };
          remoteState = body.state ?? null;
        }
      } catch { /* Local backup remains available when offline. */ }
      const latest = (remoteState?.savedAt ?? 0) > (localState?.savedAt ?? 0) ? remoteState : localState ?? remoteState;
      if (latest) restore(latest);
      if (!cancelled) setHistoryReady(true);
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!historyReady) return;
    const timer = window.setTimeout(() => {
      const state: SavedGameState = { version:2, savedAt:Date.now(), scriptId, playerCount, selected:[...selected], locked:[...locked], view, seats, activeSeat, nightMode, nightFocusMode, completedSteps:[...completedSteps], gameStarted, gamePhase, dayNumber, gameLog, demonBluffs };
      try { window.localStorage?.setItem(localGameKey,JSON.stringify(state)); } catch { /* Database backup remains available. */ }
      void fetch('/api/game-history',{ method:'PUT', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ state }) }).catch(() => undefined);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [activeSeat, completedSteps, dayNumber, demonBluffs, gameLog, gamePhase, gameStarted, historyReady, locked, nightFocusMode, nightMode, playerCount, scriptId, seats, selected, view]);

  useEffect(() => {
    setDemonBluffs((current) => current.map((id) => id && selected.has(id) ? null : id));
  }, [selected]);

  const messages = useMemo(() => {
    const result: { type: 'ok'|'warn'|'info'; text: string }[] = [];
    const mismatches = alignments.filter((alignment) => totals[alignment] !== quota[alignment]);
    result.push(!mismatches.length ? { type:'ok', text:'阵营名额已配齐，可以进入座位安排。' } : { type:'info', text:`还需调整：${mismatches.map((alignment) => `${alignmentMeta[alignment].short} ${totals[alignment]}/${quota[alignment]}`).join('、')}` });
    if (selected.has('damsel') && !selected.has('huntsman')) result.push({ type:'warn', text:'落难少女在场但没有巡山人；确认这是你想要的配置。' });
    if (selected.has('atheist') && selectedRoles.some((role) => role.alignment === 'minion' || role.alignment === 'demon')) result.push({ type:'warn', text:'无神论者要求没有邪恶角色在场，与当前选择冲突。' });
    if (selected.has('balloonist')) result.push({ type:'ok', text:'已应用气球驾驶员配置：镇民 -1，外来者 +1。' });
    if (selected.has('marionette')) result.push({ type:'info', text:'提线木偶需要与恶魔邻座，安排座位时请检查。' });
    if (selected.has('godfather')) result.push({ type:'info', text:'教父会让外来者数量 -1 或 +1；请按本局决定手动调整配板。' });
    if (selected.has('vigormortis')) result.push({ type:'info', text:'亡骨魔配置通常为外来者 -1、镇民 +1；请检查最终名额。' });
    if (selected.has('fang-gu')) result.push({ type:'info', text:'方古配置通常为外来者 +1、镇民 -1；请检查最终名额。' });
    const assignedCount = seats.filter((seat) => seat.roleId).length;
    if (assignedCount && assignedCount < playerCount) result.push({ type:'info', text:`座位身份已分配 ${assignedCount}/${playerCount}。` });
    return result;
  }, [playerCount, quota, seats, selected, selectedRoles, totals]);

  function addLog(kind: LogKind, title: string, detail?: string, phase = gamePhase, day = dayNumber) {
    const createdAt = Date.now();
    setGameLog((current) => [...current, { id:`${createdAt}-${Math.random().toString(36).slice(2,8)}`, dayNumber:day, phase, kind, title, detail, createdAt }]);
  }
  function resetRoundState() { setSeats(makeSeats(playerCount)); setActiveSeat(1); setCompletedSteps(new Set()); setGameStarted(false); setGamePhase('firstNight'); setDayNumber(1); setGameLog([]); }
  function toggleRole(role: Role) {
    if (locked.has(role.id)) return;
    setSelected((current) => { const next = new Set(current); next.has(role.id) ? next.delete(role.id) : next.add(role.id); return next; });
    setSeats((current) => current.map((seat) => seat.roleId === role.id ? { ...seat, roleId:null } : seat));
    setCompletedSteps(new Set());
  }
  function toggleLock(role: Role) {
    setLocked((current) => { const next = new Set(current); next.has(role.id) ? next.delete(role.id) : next.add(role.id); return next; });
    setSelected((current) => new Set(current).add(role.id));
  }
  function buildBoard(random: boolean) {
    const next = new Set(locked);
    const addToAlignment = (alignment: Alignment, target: number) => {
      const candidates = script.roles.filter((role) => role.alignment === alignment && !next.has(role.id));
      const already = script.roles.filter((role) => role.alignment === alignment && next.has(role.id)).length;
      const pool = random ? shuffled(candidates) : candidates;
      pool.slice(0, Math.max(0, target - already)).forEach((role) => next.add(role.id));
    };

    addToAlignment('townsfolk', baseQuota.townsfolk);
    const targetQuota = withBalloonistSetup(baseQuota, next.has('balloonist'));
    if (next.has('balloonist')) {
      const removableTownsfolk = script.roles.filter((role) => role.alignment === 'townsfolk' && role.id !== 'balloonist' && next.has(role.id) && !locked.has(role.id));
      while (script.roles.filter((role) => role.alignment === 'townsfolk' && next.has(role.id)).length > targetQuota.townsfolk && removableTownsfolk.length) {
        next.delete(removableTownsfolk.pop()!.id);
      }
    }
    addToAlignment('outsider', targetQuota.outsider);
    addToAlignment('minion', targetQuota.minion);
    addToAlignment('demon', targetQuota.demon);
    const bluffPool = script.roles.filter((role) => (role.alignment === 'townsfolk' || role.alignment === 'outsider') && !next.has(role.id));
    setSelected(next); setDemonBluffs(shuffled(bluffPool).slice(0,3).map((role) => role.id)); setSeats(makeSeats(playerCount)); setCompletedSteps(new Set());
  }
  function changePlayerCount(count: number) {
    setPlayerCount(count);
    setSeats((current) => Array.from({ length:count }, (_, index) => current[index] ? { ...current[index], number:index + 1 } : { number:index + 1, roleId:null, alive:true, statuses:[] }));
    setActiveSeat((current) => Math.min(current, count));
    setCompletedSteps(new Set());
  }
  function changeScript(id: string) {
    setScriptId(id); setSelected(new Set()); setLocked(new Set()); setDemonBluffs([null,null,null]); setSeats(makeSeats(playerCount)); setActiveSeat(1); setCompletedSteps(new Set()); setGameStarted(false); setGamePhase('firstNight'); setDayNumber(1); setGameLog([]); setView('roles'); setMobileBoardOpen(false);
  }
  function randomizeBluffs() {
    setDemonBluffs(shuffled(availableBluffs).slice(0,3).map((role) => role.id));
  }
  function setBluff(index: number, roleId: string | null) {
    setDemonBluffs((current) => current.map((id, currentIndex) => currentIndex === index ? roleId : id === roleId ? null : id));
  }
  function assignRole(seatNumber: number, roleId: string | null) {
    const currentSeat = seats.find((seat) => seat.number === seatNumber);
    const oldRole = script.roles.find((role) => role.id === currentSeat?.roleId);
    const newRole = script.roles.find((role) => role.id === roleId);
    setSeats((current) => current.map((seat) => {
      if (roleId && seat.roleId === roleId) return { ...seat, roleId:null };
      return seat.number === seatNumber ? { ...seat, roleId } : seat;
    }));
    if (gameStarted && oldRole?.id !== newRole?.id) addLog('role', `${seatNumber}号身份${oldRole ? '发生变化' : '已设置'}`, `${oldRole?.name ?? '未分配'} → ${newRole?.name ?? '未分配'}`);
  }
  function randomizeSeats() {
    const roles = shuffled(selectedRoles);
    setSeats((current) => current.map((seat, index) => ({ ...seat, roleId:roles[index]?.id ?? null, alive:true, statuses:[] })));
  }
  function toggleSeatStatus(seatNumber: number, status: SeatStatus) {
    const target = seats.find((seat) => seat.number === seatNumber);
    const adding = !target?.statuses.includes(status);
    setSeats((current) => current.map((seat) => {
      if (seat.number !== seatNumber) return seat;
      const next = new Set(seat.statuses);
      if (next.has(status)) next.delete(status);
      else {
        next.add(status);
        if (status === 'turnedGood') next.delete('turnedEvil');
        if (status === 'turnedEvil') next.delete('turnedGood');
      }
      return { ...seat, statuses:Array.from(next) };
    }));
    if (gameStarted) addLog('status', `${seatNumber}号${adding ? '获得' : '移除'}“${seatStatusMeta[status].label}”`, script.roles.find((role) => role.id === target?.roleId)?.name);
  }
  function toggleSeatAlive(seatNumber: number) {
    const target = seats.find((seat) => seat.number === seatNumber);
    if (!target) return;
    setSeats((current) => current.map((seat) => seat.number === seatNumber ? { ...seat, alive:!seat.alive } : seat));
    if (gameStarted) addLog('death', `${seatNumber}号${target.alive ? '死亡' : '复活'}`, script.roles.find((role) => role.id === target.roleId)?.name);
  }
  function toggleNightStep(id: string) {
    const completing = !completedSteps.has(id);
    setCompletedSteps((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
    if (gameStarted && completing) {
      const step = [...script.nightOrder.first,...script.nightOrder.other].find((item) => item.id === id);
      if (step) addLog('night', `完成夜间步骤：${step.name}`, step.note);
    }
  }
  function startGame() {
    setGameStarted(true); setGamePhase('firstNight'); setDayNumber(1); setNightMode('first');
    addLog('system','游戏开始','进入首个夜晚','firstNight',1);
  }
  function advancePhase() {
    let nextPhase: GamePhase;
    let nextDay = dayNumber;
    if (gamePhase === 'firstNight') nextPhase = 'day';
    else if (gamePhase === 'day') nextPhase = 'night';
    else { nextPhase = 'day'; nextDay += 1; }
    setGamePhase(nextPhase); setDayNumber(nextDay); setNightMode(nextPhase === 'firstNight' ? 'first' : 'other'); setCompletedSteps(new Set());
    addLog('system',`进入${phaseName(nextPhase,nextDay)}`,undefined,nextPhase,nextDay);
  }
  function clearHistory() {
    if (!gameLog.length || window.confirm(`清空${phaseName(gamePhase,dayNumber)}及之前的全部日志？当前阶段不会改变。`)) setGameLog([]);
  }
  function resetCurrentGame() {
    if (!window.confirm('重置本局？将清空日志、死亡状态、状态标记和夜间进度，但保留当前配板及座位身份。')) return;
    setSeats((current) => current.map((seat) => ({ ...seat, alive:true, statuses:[] })));
    setCompletedSteps(new Set());
    setGameStarted(false);
    setGamePhase('firstNight');
    setDayNumber(1);
    setNightMode('first');
    setGameLog([]);
    setManualNote('');
  }
  function submitManualNote() {
    const text = manualNote.trim();
    if (!text) return;
    if (!gameStarted) startGame();
    addLog('note',text,undefined,gameStarted ? gamePhase : 'firstNight',gameStarted ? dayNumber : 1);
    setManualNote('');
  }

  if (!historyReady) return <main className="game-restoring"><span className="brand-mark"><span>血</span></span><p>正在恢复本局…</p></main>;

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand-mark"><span>血</span></div><div className="brand-copy"><p>STORYTELLER DESK</p><h1>说书人配板台</h1></div>
      <div className="header-controls">
        <label><span>板子 / 剧本</span><NativeSelect value={scriptId} onChange={(event) => changeScript(event.target.value)} aria-label="选择剧本">{scripts.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect></label>
        <label><span>玩家人数</span><NativeSelect value={playerCount} onChange={(event) => changePlayerCount(Number(event.target.value))} aria-label="玩家人数">{Object.keys(script.counts).map((count) => <NativeSelectOption key={count} value={count}>{count} 人</NativeSelectOption>)}</NativeSelect></label>
      </div>
    </header>
    <section className="workspace">
      <button className="mobile-board-toggle" onClick={() => setMobileBoardOpen((open) => !open)} aria-expanded={mobileBoardOpen} aria-controls="current-board-panel">
        <span className="mobile-board-toggle-title"><LayoutGrid/><span><small>当前配板</small><strong>{selectedRoles.length} / {playerCount} 个角色</strong></span></span>
        <span className="mobile-board-quota">{alignments.map((alignment) => <i key={alignment}>{alignmentMeta[alignment].short}{totals[alignment]}/{quota[alignment]}</i>)}</span>
        {mobileBoardOpen ? <ChevronUp/> : <ChevronDown/>}
      </button>
      <div className="catalog-panel">
        <div className="script-heading"><div><span className="eyebrow">当前剧本</span><h2>{script.name}</h2></div></div>
        {!!script.specialRules?.length && <div className="special-rule-strip">{script.specialRules.map((rule) => <span key={rule.name}><CircleHelp/><b>{rule.name}</b>{rule.description}</span>)}</div>}
        <div className="quota-strip"><span className="quota-title"><Users size={16}/>{playerCount} 人{balloonistSetupActive ? '调整后' : '标准'}名额</span>{alignments.map((alignment) => <span key={alignment} className={`quota quota-${alignment}`}>{alignmentMeta[alignment].short}<b>{quota[alignment]}</b></span>)}{balloonistSetupActive && <span className="quota-modifier">气球驾驶员：镇民 −1 · 外来者 +1</span>}</div>
        <nav className="workspace-nav" aria-label="工具视图">
          <button className={view === 'roles' ? 'is-active' : ''} onClick={() => setView('roles')}><LayoutGrid/>角色配板</button>
          <button className={view === 'seats' ? 'is-active' : ''} onClick={() => setView('seats')}><Users/>环形座位</button>
          <button className={view === 'night' ? 'is-active' : ''} onClick={() => setView('night')}><Moon/>唤醒顺序</button>
          <button className={view === 'advice' ? 'is-active' : ''} onClick={() => setView('advice')}><Lightbulb/>错误信息</button>
          <button className={view === 'history' ? 'is-active' : ''} onClick={() => setView('history')}><BookOpen/>对局日志</button>
        </nav>
        <section className={`phase-bar ${gameStarted ? 'is-running' : ''}`}><div><span className="phase-dot"/><p><small>当前阶段</small><strong>{gameStarted ? phaseName(gamePhase,dayNumber) : '尚未开始记录'}</strong></p></div>{gameStarted ? <Button onClick={advancePhase}>进入下一阶段<ChevronRight/></Button> : <Button onClick={startGame}><Play/>开始记录</Button>}<button className="log-shortcut" onClick={() => setView('history')}><BookOpen/><span>{gameLog.length} 条记录</span></button><Button className="reset-game-button" variant="outline" onClick={resetCurrentGame}><RotateCcw/>重置本局</Button></section>

        {view === 'roles' && <Tabs defaultValue="townsfolk" className="role-tabs">
          <TabsList className="alignment-tabs" aria-label="按阵营浏览角色">{alignments.map((alignment) => <TabsTrigger key={alignment} value={alignment}>{alignmentMeta[alignment].short}<span>{script.roles.filter((role) => role.alignment === alignment).length}</span></TabsTrigger>)}</TabsList>
          {alignments.map((alignment) => <TabsContent key={alignment} value={alignment}><div className="section-title"><h3>{alignmentMeta[alignment].label}</h3><p>勾选加入当前配板，锁定后随机配板会保留该角色。</p></div><div className="role-grid">{script.roles.filter((role) => role.alignment === alignment).map((role) => <RoleCard key={role.id} role={role} selected={selected.has(role.id)} locked={locked.has(role.id)} onSelect={() => toggleRole(role)} onLock={() => toggleLock(role)}/>)}</div></TabsContent>)}
        </Tabs>}

        {view === 'seats' && <section className="seat-workspace">
          <div className="view-heading"><div><span className="eyebrow">GRIMOIRE SEATS</span><h3>环形座位魔典</h3><p>点选座位，在下方分配身份并切换存活状态。</p></div><div><Button onClick={randomizeSeats} disabled={!selectedRoles.length}><Shuffle/>随机入座</Button><Button variant="outline" onClick={() => setSeats(makeSeats(playerCount))}><RotateCcw/>清空座位</Button></div></div>
          <SeatMap seats={seats} roles={script.roles} activeSeat={activeSeat} onSelect={setActiveSeat}/>
          <div className="seat-editor">
            <div className="seat-editor-number"><span>{activeSeatState.number}</span><div><b>{activeSeatState.number}号座位</b><small>{activeSeatState.alive ? '当前存活' : '当前死亡'}</small></div></div>
            <label><span>身份</span><NativeSelect value={activeSeatState.roleId ?? ''} onChange={(event) => assignRole(activeSeatState.number, event.target.value || null)} aria-label={`${activeSeatState.number}号身份`}><NativeSelectOption value="">未分配身份</NativeSelectOption>{alignments.map((alignment) => <optgroup key={alignment} label={alignmentMeta[alignment].short}>{selectedRoles.filter((role) => role.alignment === alignment).map((role) => <NativeSelectOption key={role.id} value={role.id}>{role.name}</NativeSelectOption>)}</optgroup>)}</NativeSelect></label>
            <Button variant={activeSeatState.alive ? 'outline' : 'destructive'} onClick={() => toggleSeatAlive(activeSeatState.number)}>{activeSeatState.alive ? <><UserRound/>标记死亡</> : <><Sparkles/>恢复存活</>}</Button>
            <div className="seat-status-editor"><span>状态标记</span><div>{seatStatuses.map((status) => <button key={status} className={`${activeSeatState.statuses.includes(status) ? 'is-active' : ''} status-${status}`} onClick={() => toggleSeatStatus(activeSeatState.number,status)} aria-pressed={activeSeatState.statuses.includes(status)}>{seatStatusMeta[status].short}<b>{seatStatusMeta[status].label}</b></button>)}</div></div>
          </div>
        </section>}

        {view === 'night' && <section className="night-workspace">
          <div className="view-heading"><div><span className="eyebrow">NIGHT PHASE</span><h3>夜间唤醒顺序</h3><p>只显示当前配板相关步骤；完成后勾选，座位号会自动关联。</p></div><Button variant="outline" onClick={() => setCompletedSteps(new Set())}><RotateCcw/>重置进度</Button></div>
          <div className="night-rule-banner"><Moon/><div><strong>夜序已按主动能力过滤</strong><span>“每夜”包含首夜；“每夜*”从第二夜开始。死亡、失去能力及已使用的一次性角色会按规则自动跳过。</span></div></div>
          <div className="night-control-row"><div className="night-toggle"><button className={nightMode === 'first' ? 'is-active' : ''} onClick={() => setNightMode('first')}><Moon/>首个夜晚</button><button className={nightMode === 'other' ? 'is-active' : ''} onClick={() => setNightMode('other')}><Sunrise/>其他夜晚</button></div><div className="night-display-toggle"><button className={!nightFocusMode ? 'is-active' : ''} onClick={() => setNightFocusMode(false)}><List/>完整列表</button><button className={nightFocusMode ? 'is-active' : ''} onClick={() => setNightFocusMode(true)}><Maximize2/>专注模式</button></div></div>
          {nightFocusMode
            ? <NightFocus title={nightMode === 'first' ? '首个夜晚' : '其他夜晚'} steps={script.nightOrder[nightMode]} selected={selected} seats={seats} roles={script.roles} bluffs={demonBluffs} completed={completedSteps} onToggle={toggleNightStep}/>
            : <NightList title={nightMode === 'first' ? '首个夜晚' : '其他夜晚'} steps={script.nightOrder[nightMode]} selected={selected} seats={seats} roles={script.roles} bluffs={demonBluffs} completed={completedSteps} onToggle={toggleNightStep}/>}
          <p className="night-footnote">提示：中毒、醉酒、角色变化及自定义能力可能改变实际处理方式，说书人应结合当前场况判断。</p>
        </section>}

        {view === 'advice' && <section className="advice-workspace">
          <div className="view-heading"><div><span className="eyebrow">MISINFORMATION DESK</span><h3>错误信息建议</h3><p>根据本局的信息角色和座位状态，快速准备可信、可推理的误导方案。</p></div></div>
          <div className="advice-rule-banner"><EyeOff/><div><strong>醉酒或中毒的玩家没有能力</strong><span>说书人仍会模拟其能力，给出的信息可以为真也可以为假。下方建议是备选思路，不会自动改变规则或日志。</span></div></div>
          <div className="advice-grid">{adviceRoles.length ? adviceRoles.map((role) => {
            const seat = seats.find((item) => item.roleId === role.id);
            const canMislead = seat?.statuses.includes('poisoned') || seat?.statuses.includes('drunk');
            return <article key={role.id} className={`advice-card ${canMislead ? 'is-active' : ''}`}>
              <header><RoleIcon role={role}/><div><h4>{role.name}</h4><span>{seat ? `${seat.number}号 · ${canMislead ? '当前可给错误信息' : '当前未标记醉酒/中毒'}` : '尚未分配座位'}</span></div>{canMislead && <b>可误导</b>}</header>
              <p>{role.ability}</p>
              <ul>{role.misinformation!.map((tip) => <li key={tip}><Lightbulb/>{tip}</li>)}</ul>
            </article>;
          }) : <div className="advice-empty"><Lightbulb/><h4>当前配板没有可建议的信息角色</h4><p>选择贵族、店小二、占卜师、气球驾驶员、博学者、失忆者或秉笔后，这里会生成对应建议。</p></div>}</div>
        </section>}

        {view === 'history' && <section className="history-workspace">
          <div className="view-heading"><div><span className="eyebrow">GAME REVIEW</span><h3>对局日志与复盘</h3><p>关键操作自动记录，也可以随时补充说书人备注。</p></div>{gameLog.length > 0 && <Button variant="outline" onClick={clearHistory}><Trash2/>清空日志</Button>}</div>
          <form className="quick-note" onSubmit={(event) => { event.preventDefault(); submitManualNote(); }}><Input value={manualNote} onChange={(event) => setManualNote(event.target.value)} placeholder="记录提名、处决、能力结果或其他关键事件…" aria-label="对局备注"/><Button type="submit" disabled={!manualNote.trim()}><Plus/>添加记录</Button></form>
          <div className="history-timeline">{gameLog.length ? gameLog.map((entry,index) => {
            const previous = gameLog[index - 1];
            const showPhase = !previous || previous.phase !== entry.phase || previous.dayNumber !== entry.dayNumber;
            return <div key={entry.id}>{showPhase && <h4><span/>{phaseName(entry.phase,entry.dayNumber)}</h4>}<article className={`log-entry log-${entry.kind}`}><span className="log-mark"/><div><strong>{entry.title}</strong>{entry.detail && <p>{entry.detail}</p>}</div><time>{new Date(entry.createdAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</time><button onClick={() => setGameLog((current) => current.filter((item) => item.id !== entry.id))} aria-label={`删除记录：${entry.title}`}><Trash2/></button></article></div>;
          }) : <div className="history-empty"><BookOpen/><h4>当前没有日志</h4><p>{gameStarted ? `仍处于${phaseName(gamePhase,dayNumber)}；之后的新记录会继续归入这个阶段。` : '点击上方“开始记录”，死亡、状态变化和夜间步骤会自动出现在这里。'}</p></div>}</div>
        </section>}
      </div>

      <aside id="current-board-panel" className={`board-panel ${mobileBoardOpen ? 'is-mobile-open' : ''}`}>
        <div className="board-heading"><div><span className="eyebrow">LIVE BOARD</span><h2>当前配板</h2></div><span className="total-count">{selectedRoles.length}<small>/{playerCount}</small></span></div>
        <div className="board-actions"><Button className="random-board" onClick={() => buildBoard(true)}><Dice5/>随机配板</Button><Button variant="outline" onClick={() => buildBoard(false)}><Sparkles/>按名额补齐</Button><Button variant="outline" onClick={() => { setSelected(new Set(locked)); resetRoundState(); }}><RotateCcw/>清空未锁定</Button></div>
        <section className={`balance-card balance-${boardBalance.tendency}`}>
          <div className="balance-heading"><Gauge/><div><span>阵营压力指数</span><small>综合角色能力与干扰强度估算</small></div><b>{boardBalance.label}</b></div>
          <div className="balance-numbers"><strong className="balance-blue">蓝 {boardBalance.blue}%</strong><strong className="balance-red">红 {boardBalance.red}%</strong></div>
          <div className="balance-track" aria-label={`蓝方 ${boardBalance.blue}%，红方 ${boardBalance.red}%`}><i style={{ width:`${boardBalance.blue}%` }}/><i style={{ width:`${boardBalance.red}%` }}/></div>
          {selectedRoles.length ? <div className="balance-factors">{blueFactor && <span className="factor-blue"><b>{blueFactor.role.name}</b>{blueFactor.reason}</span>}{redFactor && <span className="factor-red"><b>{redFactor.role.name}</b>{redFactor.reason}</span>}</div> : <p className="balance-empty">选择角色后自动计算当前配板倾向。</p>}
          <p className="balance-disclaimer">仅供说书人配板参考，不代表实际胜率或规则判定。</p>
        </section>
        {!!attentionRoles.length && <section className="attention-card">
          <div className="attention-heading"><BellRing/><div><span>特殊角色提醒</span><small>按当前配板自动出现</small></div><b>{attentionRoles.length}</b></div>
          <div className="attention-list">{attentionRoles.map(({ role, item }, index) => <article key={`${role.id}-${index}`}><RoleIcon role={role} className="attention-role-icon"/><div><header><strong>{role.name}</strong><span>{item.when}</span></header><p>{item.text}</p></div></article>)}</div>
        </section>}
        <section className={`evil-win-status ${demonDefeated ? 'is-good-win' : deathsUntilEvilWin === 0 ? 'is-at-line' : ''}`}>{demonDefeated ? <ShieldCheck/> : <Skull/>}<div><span>{demonDefeated ? '游戏胜负' : '邪恶方人数胜利线'}</span><strong>{demonDefeated ? '恶魔已死亡，善良方获胜' : deathsUntilEvilWin ? `还需死亡 ${deathsUntilEvilWin} 人` : '邪恶方胜利人数条件已达成'}</strong><small>{demonDefeated ? '角色能力另有说明时除外' : '所有阵营都计入存活人数；恶魔死亡则善良获胜'}</small></div><b>{aliveCount}<small> 存活</small></b></section>
        <section className="demon-bluffs"><div className="bluff-heading"><div><EyeOff/><span><b>给恶魔的三个伪装</b><small>由说书人准备三个当前不在场的善良角色，首夜展示给恶魔</small></span></div><button onClick={randomizeBluffs} disabled={!selectedRoles.some((role) => role.alignment === 'demon') || availableBluffs.length < 3}><Shuffle/>随机准备</button></div>
          {selectedRoles.some((role) => role.alignment === 'demon') ? <div className="bluff-slots">{demonBluffs.map((roleId,index) => {
            const role = script.roles.find((item) => item.id === roleId);
            const options = availableBluffs.filter((item) => !demonBluffs.includes(item.id) || item.id === roleId);
            return <label className="bluff-slot" key={index}><span>{role ? <RoleIcon role={role}/> : <b>{index + 1}</b>}</span><NativeSelect value={roleId ?? ''} onChange={(event) => setBluff(index,event.target.value || null)} aria-label={`说书人准备的第${index + 1}个伪装`}><NativeSelectOption value="">说书人选择</NativeSelectOption>{options.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name} · {alignmentMeta[item.alignment].short}</NativeSelectOption>)}</NativeSelect></label>;
          })}</div> : <p className="bluff-empty">选入恶魔后，由说书人在这里准备身份；随机配板会自动准备三个不在场的善良角色。</p>}
        </section>
        <div className="selected-groups">{alignments.map((alignment) => <section key={alignment} className={`selected-group group-${alignment}`}><div><span>{alignmentMeta[alignment].short}</span><b>{totals[alignment]} / {quota[alignment]}</b></div><ul>{selectedRoles.filter((role) => role.alignment === alignment).map((role) => <li key={role.id}><RoleIcon role={role} className="mini-role-icon"/>{role.name}{locked.has(role.id) && <Lock size={11}/>}</li>)}</ul>{!totals[alignment] && <p>尚未选择</p>}</section>)}</div>
        <section className="validation"><h3><ShieldCheck size={17}/>基础校验</h3><div className="message-list">{messages.map((message,index) => <div key={`${message.text}-${index}`} className={`message message-${message.type}`}>{message.type === 'warn' ? <AlertTriangle size={15}/> : message.type === 'ok' ? <Check size={15}/> : <CircleHelp size={15}/>}<span>{message.text}</span></div>)}</div></section>
      </aside>
    </section>
  </main>;
}
