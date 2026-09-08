'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, CircleHelp, Dice5, LayoutGrid, Lock, Moon, RotateCcw, ShieldCheck, Shuffle, Skull, Sparkles, Sunrise, UserRound, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { alignmentMeta, scripts, type Alignment, type NightStep, type Role } from '@/app/data/scripts';

const alignments: Alignment[] = ['townsfolk', 'outsider', 'minion', 'demon'];
type ViewMode = 'roles' | 'seats' | 'night';
type SeatStatus = 'poisoned'|'drunk'|'protected'|'noAbility'|'abilityUsed'|'turnedGood'|'turnedEvil';
type Seat = { number: number; roleId: string | null; alive: boolean; statuses: SeatStatus[] };

const seatStatusMeta: Record<SeatStatus, { label: string; short: string }> = {
  poisoned:{label:'中毒',short:'毒'}, drunk:{label:'醉酒',short:'醉'}, protected:{label:'受保护',short:'护'},
  noAbility:{label:'失去能力',short:'封'}, abilityUsed:{label:'能力已使用',short:'用'},
  turnedGood:{label:'已转为善良',short:'善'}, turnedEvil:{label:'已转为邪恶',short:'恶'},
};
const seatStatuses = Object.keys(seatStatusMeta) as SeatStatus[];

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
  return <article className={`role-card role-${role.alignment} ${selected ? 'is-selected' : ''}`}>
    <div className="role-topline">
      <Checkbox checked={selected} onCheckedChange={onSelect} aria-label={`选择${role.name}`} />
      <RoleIcon role={role}/>
      <button className="role-name" onClick={onSelect}>{role.name}</button>
      <span className="timing">{role.timing}</span>
      <button className={`lock-button ${locked ? 'is-locked' : ''}`} onClick={onLock} aria-label={`${locked ? '取消锁定' : '锁定'}${role.name}`} title={locked ? '取消锁定' : '锁定角色'}><Lock size={14}/></button>
    </div>
    <p>{role.ability}</p>
    <div className="role-foot">{role.setup && <span className="setup">配置：{role.setup}</span>}{role.note && <span className="data-note"><CircleHelp size={12}/>{role.note}</span>}</div>
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
        style={{ left: `${50 + Math.sin(angle) * 43}%`, top: `${50 - Math.cos(angle) * 43}%` }}
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

function NightList({ title, steps, selected, seats, roles, completed, onToggle }: { title: string; steps: NightStep[]; selected: Set<string>; seats: Seat[]; roles: Role[]; completed: Set<string>; onToggle: (id: string) => void }) {
  const visible = steps.filter((step) => {
    if (!step.roleId) return true;
    if (!selected.has(step.roleId)) return false;
    const assignedSeat = seats.find((seat) => seat.roleId === step.roleId);
    if (!assignedSeat) return step.deadMode !== 'only';
    if (step.deadMode === 'show') return true;
    if (step.deadMode === 'only') return !assignedSeat.alive;
    return assignedSeat.alive;
  });
  return <section className="night-list">
    <div className="night-list-heading"><div><span className="eyebrow">WAKE ORDER</span><h3>{title}</h3></div><b>{visible.filter((step) => completed.has(step.id)).length} / {visible.length}</b></div>
    <ol>{visible.map((step, index) => {
      const assignedSeat = step.roleId ? seats.find((seat) => seat.roleId === step.roleId) : undefined;
      const assignedRole = step.roleId ? roles.find((role) => role.id === step.roleId) : undefined;
      const skipped = selected.has('poppy-grower') && (step.id === 'minion-info' || step.id === 'demon-info');
      return <li key={step.id} className={`${completed.has(step.id) ? 'is-complete' : ''} ${skipped ? 'is-skipped' : ''}`}>
        <span className="night-index">{String(index + 1).padStart(2, '0')}</span>
        <Checkbox checked={completed.has(step.id)} onCheckedChange={() => onToggle(step.id)} aria-label={`完成${step.name}`}/>
        {assignedRole ? <RoleIcon role={assignedRole} className="night-role-icon"/> : <span className="night-role-icon system-icon"><Moon/></span>}
        <button onClick={() => onToggle(step.id)}><strong>{step.name}</strong><small>{skipped ? '罂粟种植者在场，本项跳过' : step.note}</small></button>
        <span className={`phase phase-${step.phase}`}>{step.phase}</span>
        {assignedRole && <span className={`night-seat night-seat-${assignedRole.alignment}`}>{assignedSeat ? `${assignedSeat.number}号${assignedSeat.alive ? '' : ' · 已死亡'}` : '未入座'}</span>}
      </li>;
    })}</ol>
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
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const script = scripts.find((item) => item.id === scriptId) ?? scripts[0];
  const baseQuota = script.counts[playerCount];
  const balloonistSetupActive = selected.has('balloonist');
  const quota = useMemo(() => withBalloonistSetup(baseQuota, balloonistSetupActive), [baseQuota, balloonistSetupActive]);
  const selectedRoles = script.roles.filter((role) => selected.has(role.id));
  const activeSeatState = seats.find((seat) => seat.number === activeSeat) ?? seats[0];
  const totals = useMemo(() => Object.fromEntries(alignments.map((alignment) => [alignment, selectedRoles.filter((role) => role.alignment === alignment).length])) as Record<Alignment, number>, [selectedRoles]);
  const aliveCount = seats.filter((seat) => seat.alive).length;
  const deathsUntilEvilWin = Math.max(0, aliveCount - 2);
  const demonSeats = seats.filter((seat) => script.roles.find((role) => role.id === seat.roleId)?.alignment === 'demon');
  const demonDefeated = demonSeats.length > 0 && demonSeats.every((seat) => !seat.alive);

  const messages = useMemo(() => {
    const result: { type: 'ok'|'warn'|'info'; text: string }[] = [];
    const mismatches = alignments.filter((alignment) => totals[alignment] !== quota[alignment]);
    result.push(!mismatches.length ? { type:'ok', text:'阵营名额已配齐，可以进入座位安排。' } : { type:'info', text:`还需调整：${mismatches.map((alignment) => `${alignmentMeta[alignment].short} ${totals[alignment]}/${quota[alignment]}`).join('、')}` });
    if (selected.has('damsel') && !selected.has('huntsman')) result.push({ type:'warn', text:'落难少女在场但没有巡山人；确认这是你想要的配置。' });
    if (selected.has('atheist') && selectedRoles.some((role) => role.alignment === 'minion' || role.alignment === 'demon')) result.push({ type:'warn', text:'无神论者要求没有邪恶角色在场，与当前选择冲突。' });
    if (selected.has('balloonist')) result.push({ type:'ok', text:'已应用气球驾驶员配置：镇民 -1，外来者 +1。' });
    if (selected.has('marionette')) result.push({ type:'info', text:'提线木偶需要与恶魔邻座，安排座位时请检查。' });
    const assignedCount = seats.filter((seat) => seat.roleId).length;
    if (assignedCount && assignedCount < playerCount) result.push({ type:'info', text:`座位身份已分配 ${assignedCount}/${playerCount}。` });
    return result;
  }, [playerCount, quota, seats, selected, selectedRoles, totals]);

  function resetRoundState() { setSeats(makeSeats(playerCount)); setActiveSeat(1); setCompletedSteps(new Set()); }
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
    setSelected(next); setSeats(makeSeats(playerCount)); setCompletedSteps(new Set());
  }
  function changePlayerCount(count: number) {
    setPlayerCount(count);
    setSeats((current) => Array.from({ length:count }, (_, index) => current[index] ? { ...current[index], number:index + 1 } : { number:index + 1, roleId:null, alive:true, statuses:[] }));
    setActiveSeat((current) => Math.min(current, count));
    setCompletedSteps(new Set());
  }
  function changeScript(id: string) {
    setScriptId(id); setSelected(new Set()); setLocked(new Set()); setSeats(makeSeats(playerCount)); setActiveSeat(1); setCompletedSteps(new Set()); setView('roles');
  }
  function assignRole(seatNumber: number, roleId: string | null) {
    setSeats((current) => current.map((seat) => {
      if (roleId && seat.roleId === roleId) return { ...seat, roleId:null };
      return seat.number === seatNumber ? { ...seat, roleId } : seat;
    }));
  }
  function randomizeSeats() {
    const roles = shuffled(selectedRoles);
    setSeats((current) => current.map((seat, index) => ({ ...seat, roleId:roles[index]?.id ?? null, alive:true, statuses:[] })));
  }
  function toggleSeatStatus(seatNumber: number, status: SeatStatus) {
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
  }
  function toggleNightStep(id: string) {
    setCompletedSteps((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand-mark"><span>血</span></div><div className="brand-copy"><p>STORYTELLER DESK</p><h1>说书人配板台</h1></div>
      <div className="header-controls">
        <label><span>板子 / 剧本</span><NativeSelect value={scriptId} onChange={(event) => changeScript(event.target.value)} aria-label="选择剧本">{scripts.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect></label>
        <label><span>玩家人数</span><NativeSelect value={playerCount} onChange={(event) => changePlayerCount(Number(event.target.value))} aria-label="玩家人数">{Object.keys(script.counts).map((count) => <NativeSelectOption key={count} value={count}>{count} 人</NativeSelectOption>)}</NativeSelect></label>
      </div>
    </header>
    <section className="workspace">
      <div className="catalog-panel">
        <div className="script-heading"><div><span className="eyebrow">当前剧本</span><h2>{script.name}</h2><p>{script.description}</p></div><span className="author">作者 · {script.author}</span></div>
        <div className="quota-strip"><span className="quota-title"><Users size={16}/>{playerCount} 人{balloonistSetupActive ? '调整后' : '标准'}名额</span>{alignments.map((alignment) => <span key={alignment} className={`quota quota-${alignment}`}>{alignmentMeta[alignment].short}<b>{quota[alignment]}</b></span>)}{balloonistSetupActive && <span className="quota-modifier">气球驾驶员：镇民 −1 · 外来者 +1</span>}</div>
        <nav className="workspace-nav" aria-label="工具视图">
          <button className={view === 'roles' ? 'is-active' : ''} onClick={() => setView('roles')}><LayoutGrid/>角色配板</button>
          <button className={view === 'seats' ? 'is-active' : ''} onClick={() => setView('seats')}><Users/>环形座位</button>
          <button className={view === 'night' ? 'is-active' : ''} onClick={() => setView('night')}><Moon/>唤醒顺序</button>
        </nav>

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
            <Button variant={activeSeatState.alive ? 'outline' : 'destructive'} onClick={() => setSeats((current) => current.map((seat) => seat.number === activeSeatState.number ? { ...seat, alive:!seat.alive } : seat))}>{activeSeatState.alive ? <><UserRound/>标记死亡</> : <><Sparkles/>恢复存活</>}</Button>
            <div className="seat-status-editor"><span>状态标记</span><div>{seatStatuses.map((status) => <button key={status} className={`${activeSeatState.statuses.includes(status) ? 'is-active' : ''} status-${status}`} onClick={() => toggleSeatStatus(activeSeatState.number,status)} aria-pressed={activeSeatState.statuses.includes(status)}>{seatStatusMeta[status].short}<b>{seatStatusMeta[status].label}</b></button>)}</div></div>
          </div>
        </section>}

        {view === 'night' && <section className="night-workspace">
          <div className="view-heading"><div><span className="eyebrow">NIGHT PHASE</span><h3>夜间唤醒顺序</h3><p>只显示当前配板相关步骤；完成后勾选，座位号会自动关联。</p></div><Button variant="outline" onClick={() => setCompletedSteps(new Set())}><RotateCcw/>重置进度</Button></div>
          <div className="night-toggle"><button className={nightMode === 'first' ? 'is-active' : ''} onClick={() => setNightMode('first')}><Moon/>首个夜晚</button><button className={nightMode === 'other' ? 'is-active' : ''} onClick={() => setNightMode('other')}><Sunrise/>其他夜晚</button></div>
          <NightList title={nightMode === 'first' ? '首个夜晚' : '其他夜晚'} steps={script.nightOrder[nightMode]} selected={selected} seats={seats} roles={script.roles} completed={completedSteps} onToggle={toggleNightStep}/>
          <p className="night-footnote">提示：中毒、醉酒、角色变化及自定义能力可能改变实际处理方式，说书人应结合当前场况判断。</p>
        </section>}
      </div>

      <aside className="board-panel">
        <div className="board-heading"><div><span className="eyebrow">LIVE BOARD</span><h2>当前配板</h2></div><span className="total-count">{selectedRoles.length}<small>/{playerCount}</small></span></div>
        <div className="board-actions"><Button className="random-board" onClick={() => buildBoard(true)}><Dice5/>随机配板</Button><Button variant="outline" onClick={() => buildBoard(false)}><Sparkles/>按名额补齐</Button><Button variant="outline" onClick={() => { setSelected(new Set(locked)); resetRoundState(); }}><RotateCcw/>清空未锁定</Button></div>
        <section className={`evil-win-status ${demonDefeated ? 'is-good-win' : deathsUntilEvilWin === 0 ? 'is-at-line' : ''}`}>{demonDefeated ? <ShieldCheck/> : <Skull/>}<div><span>{demonDefeated ? '游戏胜负' : '邪恶方人数胜利线'}</span><strong>{demonDefeated ? '恶魔已死亡，善良方获胜' : deathsUntilEvilWin ? `还需死亡 ${deathsUntilEvilWin} 人` : '邪恶方胜利人数条件已达成'}</strong><small>{demonDefeated ? '角色能力另有说明时除外' : '所有阵营都计入存活人数；恶魔死亡则善良获胜'}</small></div><b>{aliveCount}<small> 存活</small></b></section>
        <div className="selected-groups">{alignments.map((alignment) => <section key={alignment} className={`selected-group group-${alignment}`}><div><span>{alignmentMeta[alignment].short}</span><b>{totals[alignment]} / {quota[alignment]}</b></div><ul>{selectedRoles.filter((role) => role.alignment === alignment).map((role) => <li key={role.id}><RoleIcon role={role} className="mini-role-icon"/>{role.name}{locked.has(role.id) && <Lock size={11}/>}</li>)}</ul>{!totals[alignment] && <p>尚未选择</p>}</section>)}</div>
        <section className="validation"><h3><ShieldCheck size={17}/>基础校验</h3><div className="message-list">{messages.map((message,index) => <div key={`${message.text}-${index}`} className={`message message-${message.type}`}>{message.type === 'warn' ? <AlertTriangle size={15}/> : message.type === 'ok' ? <Check size={15}/> : <CircleHelp size={15}/>}<span>{message.text}</span></div>)}</div></section>
      </aside>
    </section>
  </main>;
}
