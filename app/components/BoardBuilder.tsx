'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { AlertTriangle, BookOpen, Check, ChevronDown, ChevronRight, ChevronUp, CircleHelp, Dice5, EyeOff, Gavel, GripVertical, LayoutGrid, List, Lock, Maximize2, Moon, Play, Plus, RotateCcw, ShieldCheck, Shuffle, Sparkles, Sunrise, Trash2, UserRound, Users, ScrollText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { alignmentMeta, scripts, type Alignment, type AutomationEffect, type NightStep, type Role, type RoleAutomation, type ScriptDefinition } from '@/app/data/scripts';
import { ScriptLibraryDialog, backupFileType } from '@/app/components/ScriptLibraryDialog';

const alignments: Alignment[] = ['townsfolk', 'outsider', 'minion', 'demon'];
const publicAsset = (path:string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${path}`;
type ViewMode = 'roles' | 'seats' | 'night' | 'history';
type GamePhase = 'firstNight'|'day'|'night';
type LogKind = 'system'|'death'|'status'|'role'|'night'|'note'|'vote';
type LogEntry = { id:string; dayNumber:number; phase:GamePhase; kind:LogKind; title:string; detail?:string; createdAt:number };
type SeatStatus = 'poisoned'|'drunk'|'protected'|'noAbility'|'abilityUsed'|'turnedGood'|'turnedEvil'|'drank';
type Seat = { number: number; roleId: string | null; alive: boolean; statuses: SeatStatus[]; name?: string };
type Nomination = { id:string; dayNumber:number; nominator:number|null; nominee:number; votes:number|null };
type AutomaticStatusEffect = { stepId:string; targetIndex:number; roleId:string; seatNumber:number; status:SeatStatus; expires:'manual'|'nextDawn'|'nextDusk'; added?:boolean };
type SnakeSwap = { stepId:string; charmerSeat:number; demonSeat:number; charmerRoleId:string; demonRoleId:string; addedPoison:boolean };
type SavedGameState = {
  version:number; savedAt:number; scriptId:string; playerCount:number; selected:string[]; locked:string[]; view:ViewMode;
  seats:Seat[]; activeSeat:number; nightMode:'first'|'other'; nightFocusMode:boolean; completedSteps:string[];
  gameStarted:boolean; gamePhase:GamePhase; dayNumber:number; gameLog:LogEntry[]; demonBluffs:(string|null)[];
  abilityTargets?:Record<string,number[]>; automaticPoisonSeat?:number|null; ringRotation?:number; drunkFakeRoleId?:string|null;
  automaticStatusEffects?:AutomaticStatusEffect[];
  announcedDeadSeats?:number[]; lastDawnDeadSeats?:number[]; openingStyle?:'long'|'short'; roleCopies?:Record<string,number>; setupChoices?:Record<string,number>;
  nominations?:Nomination[]; voteTracking?:boolean; snakeSwap?:SnakeSwap|null;
};

type NarrationScene = 'opening'|'nightfall'|'dawn'|'discussion'|'nomination'|'silence'|'execution'|'tie'|'lastWords'|'demonReveal'|'goodWin'|'evilWin';

const narrationText: Record<Exclude<NarrationScene,'dawn'|'execution'>,string> = {
  opening:'列位看官！话说钟楼古镇浓雾锁街，夜半钟鸣不绝。暗处藏有嗜血恶魔，爪牙随行伪装；满堂乡民虚实难分，正邪混杂一处。诸位生死祸福，全凭口舌辩驳分辨。阵营已然落定，今夜杀机暗藏！诸位，且闭上双眼，夜幕降临！',
  nightfall:'白日口舌争论暂且搁置一旁。且看暮色笼罩全镇，钟楼钟声缓缓回荡。诸位速速闭目，漫漫长夜将至！',
  discussion:'命案当前，疑云密布。列位看官尽可开口，梳理线索，盘问旁人身份！',
  nomination:'忽闻有人站出指认，意欲将此人送上刑场！',
  silence:'满堂静默，竟无一人敢出面指认嫌犯？诸位再细细斟酌！',
  tie:'两边票数持平，难分轻重，今日无人送上刑场，静待夜幕重来！',
  lastWords:'言尽词毕，逝者归尘。夜色再度袭来，诸位，请闭目入夜！',
  demonReveal:'好一个穷途末路的邪魔，自知藏不住踪迹，主动显露真身！即刻终止白日辩论，直接入夜！',
  goodWin:'话说连日争辩盘查，邪魔诡计尽数败露，恶魔终被伏诛！一众良善乡民拨开迷雾，钟楼小镇重归太平，善良阵营大胜！',
  evilWin:'奈何众人猜忌四起，真假无从分辨。恶魔阴谋得逞，整座钟楼小镇彻底堕入无边黑暗，邪恶阵营夺得胜局！',
};
const shortOpening = '话说钟楼祸乱丛生，善人一心诛魔，恶人假意藏奸。多余闲话不必多讲，即刻入夜！';

const seatStatusMeta: Record<SeatStatus, { label: string; short: string }> = {
  poisoned:{label:'中毒',short:'毒'}, drunk:{label:'醉酒',short:'醉'}, protected:{label:'受保护',short:'护'},
  noAbility:{label:'失去能力',short:'封'}, abilityUsed:{label:'能力已使用',short:'用'},
  turnedGood:{label:'已转为善良',short:'善'}, turnedEvil:{label:'已转为邪恶',short:'恶'},
  drank:{label:'今日已举杯',short:'杯'},
};
const seatStatuses = Object.keys(seatStatusMeta) as SeatStatus[];
const automationEffectLabels:Record<AutomationEffect,string> = { record:'只记录',poisoned:'中毒',drunk:'醉酒',protected:'受保护',noAbility:'失去能力',death:'死亡',revive:'复活',turnedGood:'转为善良',turnedEvil:'转为邪恶' };
const automationStatusEffects:Partial<Record<AutomationEffect,SeatStatus>> = { poisoned:'poisoned',drunk:'drunk',protected:'protected',noAbility:'noAbility',turnedGood:'turnedGood',turnedEvil:'turnedEvil' };
const localGameKey = 'storyteller-board-current-game-v2';
const customScriptsKey = 'storyteller-board-custom-scripts-v1';
// 第N天之后的夜晚是第N+1夜。
const phaseName = (phase: GamePhase, dayNumber: number) => phase === 'day' ? `第${dayNumber}天` : `第${phase === 'firstNight' ? 1 : dayNumber + 1}夜`;
const nightTargetCounts: Record<string,number> = {
  'snake-charmer':1, poisoner:1, widow:1, preacher:1, huntsman:1, professor:1, balloonist:1,
  dreamer:1, gambler:1, ravenkeeper:1, cerenovus:1, 'pit-hag':1, godfather:1, lunatic:1,
  noble:3, innkeeper:2, investigator:2, grandmother:1, 'fortune-teller':2, barber:2, farmer:1,
  'toy-maker':3, 'trolley-problem':3, 'black-sun':3, 'hadi-jiya':3,
  seamstress:2, witch:1, exorcist:1, 'evil-twin':1, sage:2, 'no-dashii':1, vortox:1,
  'cat-army':1, puck:1, 'magic-cat':1, empath:2, monk:1, assassin:1,
  imp:1, vigormortis:1, 'fang-gu':1, sailor:1,
  'wine-god':2,
};

// 清空座位时保留玩家昵称：昵称跟着实际座位走，不跟身份走。
const makeSeats = (count: number, previous: Seat[] = []): Seat[] => Array.from({ length: count }, (_, index) => ({ number: index + 1, roleId: null, alive: true, statuses: [], name: previous[index]?.name }));
const seatTitle = (seat: Seat) => `${seat.number}号${seat.name ? ` ${seat.name}` : ''}`;
const isCustomScript = (item: unknown): item is ScriptDefinition => {
  const value = item as Partial<ScriptDefinition>|null;
  return Boolean(value?.custom && value.id && value.name && Array.isArray(value.roles) && value.counts && value.nightOrder);
};
// 内置角色的自动结算，与导入角色的逻辑配置走同一条路径。
const builtInAutomation: Record<string,RoleAutomation> = { poisoner:{ configured:true,targetCount:1,effect:'poisoned',expires:'nextDusk' } };
// 只移除由这些效果亲自加上、且没有其他自动效果仍在维持的状态，手动标记不受影响。
const releaseEffects = (released: AutomaticStatusEffect[], remaining: AutomaticStatusEffect[]) => (list: Seat[]) => list.map((seat) => {
  const statuses = new Set(released.filter((effect) => effect.seatNumber === seat.number && effect.added !== false && !remaining.some((other) => other.seatNumber === seat.number && other.status === effect.status)).map((effect) => effect.status));
  return statuses.size ? { ...seat,statuses:seat.statuses.filter((status) => !statuses.has(status)) } : seat;
});
const setupDeltaLabel = (role:Role, delta:number) => delta === 0
  ? `${role.name}：名额不变`
  : delta > 0 ? `${role.name}：镇民 −${delta} · 外来者 +${delta}` : `${role.name}：镇民 +${Math.abs(delta)} · 外来者 −${Math.abs(delta)}`;
const setupModifiers = (roles:Role[], roleIds:Set<string>, choices:Record<string,number>) => roles.flatMap((role) => {
  if (!roleIds.has(role.id)) return [];
  const rule = role.setupRules?.outsiderDelta;
  if (!rule) return role.setupRules?.requiresNoEvil ? [{ id:role.id,label:`${role.name}：无邪恶角色`,outsiderDelta:0 }] : [];
  const outsiderDelta = rule.options.includes(choices[role.id]) ? choices[role.id] : rule.default;
  return [{ id:role.id, label:setupDeltaLabel(role,outsiderDelta), outsiderDelta }];
});
const withSetupAdjustments = (quota: Record<Alignment, number>, roles:Role[], roleIds: Set<string>, choices:Record<string,number>): Record<Alignment, number> => {
  const requestedDelta = setupModifiers(roles,roleIds,choices).reduce((total,item) => total + item.outsiderDelta,0);
  const outsider = Math.max(0,quota.outsider + requestedDelta);
  const appliedDelta = outsider - quota.outsider;
  const adjusted = { ...quota, townsfolk:Math.max(0,quota.townsfolk - appliedDelta), outsider };
  if (roles.some((role) => roleIds.has(role.id) && role.setupRules?.requiresNoEvil)) return { ...adjusted,townsfolk:adjusted.townsfolk + adjusted.minion + adjusted.demon,minion:0,demon:0 };
  return adjusted;
};
const shuffled = <T,>(items: T[]) => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1));
    [result[index], result[next]] = [result[next], result[index]];
  }
  return result;
};

function RoleIcon({ role, className = '' }: { role: Role; className?: string }) {
  if (role.glyph) return <span className={`role-icon role-glyph ${className}`} aria-hidden="true">{role.glyph}</span>;
  return <img className={`role-icon ${className}`} src={role.image ?? publicAsset(`/roles/${role.id}.webp`)} alt="" aria-hidden="true"/>;
}

function RoleCard({ role, selected, locked, copies, setupChoice, onSelect, onLock, onCopiesChange, onSetupChoiceChange }: { role: Role; selected: boolean; locked: boolean; copies:number; setupChoice?:number; onSelect: () => void; onLock: () => void; onCopiesChange:(count:number) => void; onSetupChoiceChange:(value:number) => void }) {
  const [expanded, setExpanded] = useState(false);
  return <article className={`role-card role-${role.alignment} ${selected ? 'is-selected' : ''} ${expanded ? 'is-expanded' : ''}`}>
    <div className="role-topline">
      <Checkbox checked={selected} onCheckedChange={onSelect} aria-label={`选择${role.name}`} />
      <RoleIcon role={role}/>
      <button className="role-name" onClick={onSelect}>{role.name}</button>
      <span className="timing">{role.timing}</span>
      {role.automation && <span className={`automation-state ${role.automation.configured ? 'is-ready' : 'is-manual'}`}>{role.automation.configured ? '自动' : '手动'}</span>}
      <button className="role-expand" onClick={() => setExpanded((open) => !open)} aria-expanded={expanded} aria-label={`${expanded ? '收起' : '查看'}${role.name}技能`}>{expanded ? <ChevronUp/> : <ChevronDown/>}</button>
      <button className={`lock-button ${locked ? 'is-locked' : ''}`} onClick={onLock} aria-label={`${locked ? '取消锁定' : '锁定'}${role.name}`} title={locked ? '取消锁定' : '锁定角色'}><Lock size={14}/></button>
    </div>
    <div className="role-details"><p>{role.ability}</p>
      <div className="role-foot">{role.setup && <span className="setup">配置：{role.setup}</span>}{role.note && <span className="data-note"><CircleHelp size={12}/>{role.note}</span>}</div>
    </div>
    {selected && ((role.maxCopies ?? 1) > 1 || (role.setupRules?.outsiderDelta?.options.length ?? 0) > 1) && <div className="role-config-row">
      {(role.maxCopies ?? 1) > 1 && <div className="copy-stepper"><span>在场数量</span><button onClick={() => onCopiesChange(copies - 1)} disabled={copies <= 1} aria-label={`减少${role.name}数量`}>−</button><b>{copies}</b><button onClick={() => onCopiesChange(copies + 1)} disabled={copies >= (role.maxCopies ?? 1)} aria-label={`增加${role.name}数量`}>＋</button></div>}
      {(role.setupRules?.outsiderDelta?.options.length ?? 0) > 1 && <label className="setup-choice"><span>配置修正</span><NativeSelect value={setupChoice ?? role.setupRules!.outsiderDelta!.default} onChange={(event) => onSetupChoiceChange(Number(event.target.value))} aria-label={`${role.name}配置修正`}>{role.setupRules!.outsiderDelta!.options.map((delta) => <NativeSelectOption key={delta} value={delta}>{delta === 0 ? '名额不变' : delta > 0 ? `外来者 +${delta}` : `外来者 ${delta}`}</NativeSelectOption>)}</NativeSelect></label>}
    </div>}
  </article>;
}

function SeatMap({ seats, roles, activeSeat, targetMarks, rotation, drunkFakeRoleId, onRotationChange, onSelect, onSwap }: { seats: Seat[]; roles: Role[]; activeSeat: number; targetMarks:Record<number,string[]>; rotation:number; drunkFakeRoleId:string|null; onRotationChange:(rotation:number) => void; onSelect: (number: number) => void; onSwap: (from: number, to: number) => void }) {
  const [draggingSeat, setDraggingSeat] = useState<number|null>(null);
  const [dragTarget, setDragTarget] = useState<number|null>(null);
  const [dragOffset, setDragOffset] = useState({ x:0, y:0 });
  const [rotating, setRotating] = useState(false);
  const dragStart = useRef({ x:0, y:0 });
  const didDrag = useRef(false);
  const rotationDrag = useRef<{ pointerId:number; startAngle:number; startRotation:number }|null>(null);
  const aliveCount = seats.filter((seat) => seat.alive).length;
  const deathsUntilEvilWin = Math.max(0, aliveCount - 2);
  const demonSeats = seats.filter((seat) => roles.find((role) => role.id === seat.roleId)?.alignment === 'demon');
  const demonDefeated = demonSeats.length > 0 && demonSeats.every((seat) => !seat.alive);
  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>, seatNumber: number) => {
    if (event.button !== 0) return;
    dragStart.current = { x:event.clientX, y:event.clientY };
    didDrag.current = false;
    setDraggingSeat(seatNumber); setDragTarget(null); setDragOffset({ x:0, y:0 });
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (draggingSeat === null) return;
    const offset = { x:event.clientX - dragStart.current.x, y:event.clientY - dragStart.current.y };
    if (Math.hypot(offset.x,offset.y) < 7 && !didDrag.current) return;
    didDrag.current = true; setDragOffset(offset);
    const targetNumber = document.elementsFromPoint(event.clientX,event.clientY).map((element) => Number(element.closest<HTMLElement>('[data-seat-number]')?.dataset.seatNumber)).find((number) => Number.isFinite(number) && number !== draggingSeat);
    setDragTarget(targetNumber ?? null);
  };
  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (draggingSeat === null) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const targetNumber = document.elementsFromPoint(event.clientX,event.clientY).map((element) => Number(element.closest<HTMLElement>('[data-seat-number]')?.dataset.seatNumber)).find((number) => Number.isFinite(number) && number !== draggingSeat);
    if (didDrag.current && targetNumber !== undefined) onSwap(draggingSeat,targetNumber);
    setDraggingSeat(null); setDragTarget(null); setDragOffset({ x:0, y:0 });
  };
  const pointerAngle = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.atan2(event.clientY - (rect.top + rect.height / 2),event.clientX - (rect.left + rect.width / 2)) * 180 / Math.PI;
  };
  const beginRotation = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('[data-seat-number]')) return;
    rotationDrag.current = { pointerId:event.pointerId, startAngle:pointerAngle(event), startRotation:rotation };
    setRotating(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveRotation = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = rotationDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    onRotationChange(drag.startRotation + pointerAngle(event) - drag.startAngle);
  };
  const finishRotation = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (rotationDrag.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    rotationDrag.current = null;
    setRotating(false);
  };
  return <div className={`seat-ring ${rotating ? 'is-rotating' : ''}`} aria-label={`${seats.length}人环形座位图；拖动空白处可旋转`} onPointerDown={beginRotation} onPointerMove={moveRotation} onPointerUp={finishRotation} onPointerCancel={finishRotation}>
    <span className="ring-rotate-hint" aria-hidden="true">拖动空白处旋转</span>
    <div className="ring-lines" aria-hidden="true"><span/><span/><span/></div>
    <div className={`ring-center ${demonDefeated ? 'is-good-win' : ''}`}><span>{aliveCount}</span><small>存活</small><b>{seats.length} 人魔典</b><em>{demonDefeated ? '恶魔死亡 · 善良胜利' : deathsUntilEvilWin ? `再死亡 ${deathsUntilEvilWin} 人` : '已到邪恶胜利线'}</em></div>
    {seats.map((seat, index) => {
      const angle = -(index / seats.length) * Math.PI * 2 + rotation * Math.PI / 180;
      const role = roles.find((item) => item.id === seat.roleId);
      const drunkFakeRole = role?.id === 'drunk' ? roles.find((item) => item.id === drunkFakeRoleId) : undefined;
      const side = seat.statuses.includes('turnedEvil') ? 'evil' : seat.statuses.includes('turnedGood') ? 'good' : role && (role.alignment === 'minion' || role.alignment === 'demon') ? 'evil' : role ? 'good' : '';
      const tooltipVertical = Math.cos(angle) > 0 ? 'tooltip-below' : 'tooltip-above';
      const tooltipHorizontal = Math.sin(angle) < -0.45 ? 'tooltip-align-left' : Math.sin(angle) > 0.45 ? 'tooltip-align-right' : 'tooltip-align-center';
      return <button
        key={seat.number}
        data-seat-number={seat.number}
        className={`seat-token ${role ? `seat-${role.alignment}` : ''} ${side ? `seat-side-${side}` : ''} ${seat.alive ? 'is-alive' : 'is-dead'} ${activeSeat === seat.number ? 'is-active' : ''} ${draggingSeat === seat.number ? 'is-dragging' : ''} ${dragTarget === seat.number ? 'is-drop-target' : ''}`}
        style={{
          '--seat-left': `${50 + Math.sin(angle) * 43}%`,
          '--seat-top': `${50 - Math.cos(angle) * 43}%`,
          '--seat-left-mobile': `${50 + Math.sin(angle) * 38}%`,
          '--seat-top-mobile': `${50 - Math.cos(angle) * 38}%`,
          '--drag-x': draggingSeat === seat.number ? `${dragOffset.x}px` : '0px',
          '--drag-y': draggingSeat === seat.number ? `${dragOffset.y}px` : '0px',
        } as CSSProperties}
        onPointerDown={(event) => beginDrag(event,seat.number)}
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        onPointerCancel={() => { setDraggingSeat(null); setDragTarget(null); setDragOffset({ x:0, y:0 }); didDrag.current = false; }}
        onClick={() => { if (didDrag.current) { didDrag.current = false; return; } onSelect(seat.number); }}
        aria-label={`${seatTitle(seat)}，${role?.name ?? '未分配'}，${seat.alive ? '存活' : '死亡'}`}
        aria-describedby={role ? `seat-ability-${seat.number}` : undefined}
      >
        <span><b>{seat.number}号</b><i>{seat.alive ? '存活' : '死亡'}</i></span>
        {seat.name && <span className="seat-player-name">{seat.name}</span>}
        <strong>{role && <RoleIcon role={role}/>}<span>{role?.name ?? '未分配身份'}</span></strong>
        {drunkFakeRole && <span className="seat-fake-role">伪装：{drunkFakeRole.name}</span>}
        {!!seat.statuses.length && <span className="seat-status-list">{seat.statuses.map((status) => <i key={status} className={`seat-status status-${status}`} title={seatStatusMeta[status].label}>{seatStatusMeta[status].short}</i>)}</span>}
        {!!targetMarks[seat.number]?.length && <span className="seat-target-mark" title={`本夜技能目标：${targetMarks[seat.number].join('、')}`}>目标{targetMarks[seat.number].length > 1 ? ` ×${targetMarks[seat.number].length}` : ''}</span>}
        {role && <span id={`seat-ability-${seat.number}`} role="tooltip" className={`seat-ability-card ${tooltipVertical} ${tooltipHorizontal}`}>
          <span className="seat-ability-heading"><RoleIcon role={role}/><span><b>{role.name}</b><small>{alignmentMeta[role.alignment].short} · {role.timing ?? '被动'}</small></span></span>
          <span className="seat-ability-text">{role.ability}</span>
          {drunkFakeRole && <span className="seat-ability-setup">假身份：{drunkFakeRole.name}</span>}
          {role.setup && <span className="seat-ability-setup">配置：{role.setup}</span>}
        </span>}
      </button>;
    })}
  </div>;
}

function NominationPanel({ dayNumber, seats, nominations, voteTracking, aliveCount, onVoteTrackingChange, onAdd, onVotesChange, onVotesStep, onRemove, onExecute, onTie, onClose }: { dayNumber:number; seats:Seat[]; nominations:Nomination[]; voteTracking:boolean; aliveCount:number; onVoteTrackingChange:(value:boolean) => void; onAdd:(nominator:number|null, nominee:number) => void; onVotesChange:(id:string, votes:number|null) => void; onVotesStep:(id:string, delta:number) => void; onRemove:(id:string) => void; onExecute:(seatNumber:number) => void; onTie:() => void; onClose:() => void }) {
  const [nominator,setNominator] = useState('');
  const [nominee,setNominee] = useState('');
  const threshold = Math.ceil(aliveCount / 2);
  const usedNominators = new Set(nominations.map((item) => item.nominator));
  const usedNominees = new Set(nominations.map((item) => item.nominee));
  // 达到门槛且唯一最高票者将被处决；最高票平票则无人处决。
  const counted = voteTracking ? nominations.filter((item) => item.votes !== null && item.votes >= threshold) : [];
  const topVotes = counted.reduce((max,item) => Math.max(max,item.votes ?? 0),0);
  const leaders = counted.filter((item) => item.votes === topVotes);
  const leader = leaders.length === 1 ? leaders[0] : undefined;
  const seatOption = (seat:Seat) => `${seatTitle(seat)}${seat.alive ? '' : ' · 已死亡'}`;
  return <section className="nomination-panel" aria-label="今日提名">
    <header>
      <span><b>第{dayNumber}天提名</b><small>存活 {aliveCount} 人{voteTracking ? ` · 处决至少 ${threshold} 票` : ''}</small></span>
      <label className="vote-toggle"><Checkbox checked={voteTracking} onCheckedChange={(value) => onVoteTrackingChange(value === true)}/>记录票数</label>
      <button onClick={onClose} aria-label="关闭提名面板"><X/></button>
    </header>
    <form className="nomination-form" onSubmit={(event) => { event.preventDefault(); if (!nominee) return; onAdd(nominator ? Number(nominator) : null,Number(nominee)); setNominator(''); setNominee(''); }}>
      <label><span>提名者</span><NativeSelect value={nominator} onChange={(event) => setNominator(event.target.value)} aria-label="提名者"><NativeSelectOption value="">不记录</NativeSelectOption>{seats.map((seat) => <NativeSelectOption key={seat.number} value={seat.number} disabled={!seat.alive || usedNominators.has(seat.number)}>{seatOption(seat)}</NativeSelectOption>)}</NativeSelect></label>
      <label><span>被提名者</span><NativeSelect value={nominee} onChange={(event) => setNominee(event.target.value)} aria-label="被提名者"><NativeSelectOption value="">请选择</NativeSelectOption>{seats.map((seat) => <NativeSelectOption key={seat.number} value={seat.number} disabled={usedNominees.has(seat.number)}>{seatOption(seat)}</NativeSelectOption>)}</NativeSelect></label>
      <Button type="submit" disabled={!nominee}><Plus/>记录提名</Button>
    </form>
    {nominations.length ? <ol>{nominations.map((item) => <li key={item.id} className={leader?.id === item.id ? 'is-leading' : ''}>
      <span className="nomination-pair">{item.nominator ? <>{item.nominator}号<ChevronRight/></> : <small>被提名</small>}<b>{item.nominee}号</b></span>
      {voteTracking && <span className="vote-stepper">
        <button type="button" onClick={() => onVotesStep(item.id,-1)} aria-label={`${item.nominee}号减少一票`}>−</button>
        <input inputMode="numeric" value={item.votes ?? ''} placeholder="票数" onChange={(event) => { const digits = event.target.value.replace(/\D/g,''); onVotesChange(item.id,digits ? Number(digits) : null); }} aria-label={`${item.nominee}号得票`}/>
        <button type="button" onClick={() => onVotesStep(item.id,1)} aria-label={`${item.nominee}号增加一票`}>＋</button>
      </span>}
      {(!voteTracking || leader?.id === item.id) && <button className="nomination-execute" onClick={() => onExecute(item.nominee)}><Gavel/>处决</button>}
      <button className="nomination-remove" onClick={() => onRemove(item.id)} aria-label={`删除对${item.nominee}号的提名`}><X/></button>
    </li>)}</ol> : <p className="nomination-empty">今天还没有提名。</p>}
    {voteTracking && nominations.length > 0 && <footer>{leader ? <span>{leader.nominee}号 {leader.votes} 票，目前将被处决</span> : leaders.length > 1 ? <><span>最高票 {topVotes} 票平票，今日无人处决</span><button onClick={onTie}>平票台词</button></> : <span>暂无人达到 {threshold} 票</span>}</footer>}
  </section>;
}

function nightActorRole(step: NightStep, selected: Set<string>, roles: Role[]) {
  if (step.roleId) return roles.find((role) => role.id === step.roleId);
  if (step.requiredAlignment === 'demon' && step.phase === '行动') return roles.find((role) => role.alignment === 'demon' && selected.has(role.id));
  return undefined;
}

function nightActorSeat(step: NightStep, selected: Set<string>, seats: Seat[], roles: Role[]) {
  const role = nightActorRole(step,selected,roles);
  if (!role) return undefined;
  const seatRoleId = step.drunkActor ? 'drunk' : role.id;
  return seats.find((seat) => seat.roleId === seatRoleId);
}

function nightImpairment(step: NightStep, seat: Seat|undefined) {
  if (step.drunkActor) return '是酒鬼';
  if (seat?.statuses.includes('poisoned')) return '已中毒';
  if (seat?.statuses.includes('drunk')) return '已醉酒';
  return null;
}

function nightTargetCount(step: NightStep, selected: Set<string>, roles: Role[]) {
  const role = nightActorRole(step,selected,roles);
  return role?.automation?.configured ? role.automation.targetCount : nightTargetCounts[role?.id ?? ''] ?? 0;
}

function NightTargetPicker({ step, selected, seats, roles, targets, onChange, onConfirmDeath }: { step:NightStep; selected:Set<string>; seats:Seat[]; roles:Role[]; targets:number[]; onChange:(index:number, seatNumber:number|null) => void; onConfirmDeath?:(seatNumber:number) => void }) {
  const count = nightTargetCount(step,selected,roles);
  if (!count) return null;
  return <div className="night-target-picker"><span>技能目标</span><div>{Array.from({ length:count }, (_, index) => <label key={index}>
    <small>{count > 1 ? `目标 ${index + 1}` : '选择玩家'}</small>
    <NativeSelect value={targets[index] ?? ''} onChange={(event) => onChange(index,event.target.value ? Number(event.target.value) : null)} aria-label={`${step.name}目标${index + 1}`}>
      <NativeSelectOption value="">请选择</NativeSelectOption>
      {seats.map((seat) => {
        const role = roles.find((item) => item.id === seat.roleId);
        const duplicate = targets.some((value,targetIndex) => targetIndex !== index && value === seat.number);
        return <NativeSelectOption key={seat.number} value={seat.number} disabled={duplicate}>{seatTitle(seat)} · {role?.name ?? '未分配'}{seat.alive ? '' : ' · 已死亡'}</NativeSelectOption>;
      })}
    </NativeSelect>
  </label>)}</div>
    {onConfirmDeath && targets.some(Boolean) && <div className="night-confirm-death">{targets.filter(Boolean).map((seatNumber) => seats.find((seat) => seat.number === seatNumber)?.alive
      ? <button key={seatNumber} type="button" title="保护、免死等情况由说书人判断后再确认" onClick={() => onConfirmDeath(seatNumber)}><UserRound/>确认 {seatNumber} 号死亡</button>
      : <span key={seatNumber}>{seatNumber} 号已死亡</span>)}</div>}
  </div>;
}

function canConfirmNightDeath(step: NightStep, role: Role|undefined, impairment: string|null) {
  return !impairment && step.phase === '行动' && role?.alignment === 'demon' && !role.automation?.configured;
}

function visibleNightSteps(steps: NightStep[], selected: Set<string>, seats: Seat[], roles: Role[]) {
  return steps.filter((step) => {
    if (step.requiredAlignment && !roles.some((role) => role.alignment === step.requiredAlignment && selected.has(role.id))) return false;
    if (step.skipWhenRolePresent && selected.has(step.skipWhenRolePresent)) return false;
    if (!step.roleId) return true;
    const actorRoleId = step.drunkActor ? 'drunk' : step.roleId;
    if (!selected.has(actorRoleId)) return false;
    const assignedSeats = seats.filter((seat) => seat.roleId === actorRoleId);
    if (!assignedSeats.length) return step.deadMode !== 'only';
    const assignedRole = roles.find((role) => role.id === step.roleId);
    const capableSeats = assignedSeats.filter((seat) => !seat.statuses.includes('noAbility') && !(seat.statuses.includes('abilityUsed') && assignedRole?.timing === '一次'));
    if (!capableSeats.length) return false;
    if (step.deadMode === 'show') return true;
    if (step.deadMode === 'only') return capableSeats.some((seat) => !seat.alive);
    return capableSeats.some((seat) => seat.alive);
  });
}

function nightStepDetail(step: NightStep, selected: Set<string>, roles: Role[], bluffs: (string|null)[]) {
  const isDemonInfo = step.id.endsWith('demon-info');
  const poppyDemonInfo = selected.has('poppy-grower') && isDemonInfo;
  const bluffNames = isDemonInfo ? bluffs.map((id) => roles.find((role) => role.id === id)?.name).filter(Boolean) : [];
  return isDemonInfo && bluffNames.length ? `${poppyDemonInfo ? '罂粟种植者在场：不告知爪牙。' : step.note} 说书人展示给恶魔：${bluffNames.join('、')}。` : poppyDemonInfo ? '罂粟种植者在场：说书人只向恶魔展示三项伪装，不告知爪牙。' : step.note;
}

function nightStepSeatLabel(step: NightStep, selected: Set<string>, seats: Seat[], roles: Role[], roleCopies:Record<string,number>) {
  const actorRoleId = step.drunkActor ? 'drunk' : step.roleId;
  const alignment = actorRoleId ? roles.find((role) => role.id === actorRoleId)?.alignment : step.requiredAlignment;
  const expectedRoles = actorRoleId
    ? roles.filter((role) => role.id === actorRoleId && selected.has(role.id))
    : alignment ? roles.filter((role) => role.alignment === alignment && selected.has(role.id)) : [];
  if (!expectedRoles.length) return null;
  const roleIds = new Set(expectedRoles.map((role) => role.id));
  const assigned = seats.filter((seat) => seat.roleId && roleIds.has(seat.roleId));
  const expectedCount = actorRoleId ? Math.max(1,roleCopies[actorRoleId] ?? 1) : expectedRoles.reduce((total,role) => total + Math.max(1,roleCopies[role.id] ?? 1),0);
  const unassignedCount = Math.max(0,expectedCount - assigned.length);
  const assignedText = assigned.map((seat) => `${seatTitle(seat)}${seat.alive ? '' : '（死亡）'}`).join('、');
  const missingText = unassignedCount ? expectedCount === 1 ? '未入座' : `${unassignedCount}名未入座` : '';
  const text = [assignedText,missingText].filter(Boolean).join(' · ');
  return { text, alignment };
}

function NightList({ title, steps, selected, seats, roles, roleCopies, bluffs, completed, targets, onToggle, onTargetChange, onConfirmDeath }: { title: string; steps: NightStep[]; selected: Set<string>; seats: Seat[]; roles: Role[]; roleCopies:Record<string,number>; bluffs: (string|null)[]; completed: Set<string>; targets:Record<string,number[]>; onToggle: (id: string) => void; onTargetChange:(step:NightStep,index:number,seatNumber:number|null) => void; onConfirmDeath:(step:NightStep,seatNumber:number) => void }) {
  const visible = visibleNightSteps(steps, selected, seats, roles);
  return <section className="night-list">
    <div className="night-list-heading"><div><span className="eyebrow">唤醒次序</span><h3>{title}</h3></div><b>{visible.filter((step) => completed.has(step.id)).length} / {visible.length}</b></div>
    <ol>{visible.map((step, index) => {
      const assignedRole = nightActorRole(step,selected,roles);
      const seatLabel = nightStepSeatLabel(step,selected,seats,roles,roleCopies);
      const actorSeat = nightActorSeat(step,selected,seats,roles);
      const impairment = nightImpairment(step,actorSeat);
      const demonInfo = nightStepDetail(step, selected, roles, bluffs);
      return <li key={step.id} className={`${completed.has(step.id) ? 'is-complete' : ''} ${impairment ? 'is-impaired' : ''}`}>
        <span className="night-index">{String(index + 1).padStart(2, '0')}</span>
        <Checkbox checked={completed.has(step.id)} onCheckedChange={() => onToggle(step.id)} aria-label={`完成${step.name}`}/>
        {assignedRole ? <span className="night-role-trigger"><RoleIcon role={assignedRole} className="night-role-icon"/></span> : <span className="night-role-icon system-icon"><Moon/></span>}
        <button className="night-step-main" onClick={() => onToggle(step.id)} aria-describedby={assignedRole ? `night-ability-${step.id}` : undefined}><strong>{step.name}</strong><small>{demonInfo}</small></button>
        <span className={`phase phase-${step.phase}`}>{step.phase}</span>
        {seatLabel && <span className={`night-seat ${seatLabel.alignment ? `night-seat-${seatLabel.alignment}` : ''}`}><b>玩家</b>{seatLabel.text}</span>}
        {impairment && <div className="night-impairment"><AlertTriangle/> {actorSeat ? `${actorSeat.number}号` : '该玩家'}{impairment}：照常唤醒并记录选择，但能力无效</div>}
        <NightTargetPicker step={step} selected={selected} seats={seats} roles={roles} targets={targets[step.id] ?? []} onChange={(index,seatNumber) => onTargetChange(step,index,seatNumber)} onConfirmDeath={canConfirmNightDeath(step,assignedRole,impairment) ? (seatNumber) => onConfirmDeath(step,seatNumber) : undefined}/>
        {assignedRole && <span id={`night-ability-${step.id}`} role="tooltip" className="night-list-ability-card">
          <span className="seat-ability-heading"><RoleIcon role={assignedRole}/><span><b>{assignedRole.name}</b><small>{alignmentMeta[assignedRole.alignment].short} · {assignedRole.timing ?? '被动'}</small></span></span>
          <span className="seat-ability-text">{assignedRole.ability}</span>
          {assignedRole.setup && <span className="seat-ability-setup">配置：{assignedRole.setup}</span>}
        </span>}
      </li>;
    })}</ol>
  </section>;
}

function NightFocus({ title, steps, selected, seats, roles, roleCopies, bluffs, completed, targets, onToggle, onTargetChange, onConfirmDeath }: { title:string; steps:NightStep[]; selected:Set<string>; seats:Seat[]; roles:Role[]; roleCopies:Record<string,number>; bluffs:(string|null)[]; completed:Set<string>; targets:Record<string,number[]>; onToggle:(id:string) => void; onTargetChange:(step:NightStep,index:number,seatNumber:number|null) => void; onConfirmDeath:(step:NightStep,seatNumber:number) => void }) {
  const visible = visibleNightSteps(steps, selected, seats, roles);
  const currentIndex = visible.findIndex((step) => !completed.has(step.id));
  const current = currentIndex >= 0 ? visible[currentIndex] : undefined;
  if (!current) return <section className="night-focus night-focus-complete"><Check/><span className="eyebrow">{title}</span><h3>本轮夜序已完成</h3><p>所有需要处理的角色都已标记完成。</p></section>;
  const assignedRole = nightActorRole(current,selected,roles);
  const seatLabel = nightStepSeatLabel(current,selected,seats,roles,roleCopies);
  const actorSeat = nightActorSeat(current,selected,seats,roles);
  const impairment = nightImpairment(current,actorSeat);
  const detail = nightStepDetail(current, selected, roles, bluffs);
  return <section className="night-focus">
    <header><span>{String(currentIndex + 1).padStart(2,'0')} / {String(visible.length).padStart(2,'0')}</span><b>{title}</b></header>
    <div className="night-focus-role">{assignedRole ? <RoleIcon role={assignedRole}/> : <span className="night-focus-system"><Moon/></span>}<div><small>{current.phase}</small><h3>{current.name}</h3>{assignedRole && <span>{alignmentMeta[assignedRole.alignment].short}</span>}</div>{seatLabel && <div className={`night-focus-seat ${seatLabel.alignment ? `night-focus-seat-${seatLabel.alignment}` : ''}`}><small>对应玩家</small><strong>{seatLabel.text}</strong></div>}</div>
    {assignedRole && <div className="night-focus-block"><small>角色能力</small><p>{assignedRole.ability}</p></div>}
    {impairment && <div className="night-focus-impaired"><AlertTriangle/><div><strong>{actorSeat ? `${actorSeat.number}号` : '该玩家'}{impairment}</strong><span>照常唤醒并让玩家操作，但本次能力不会产生效果。</span></div></div>}
    <div className="night-focus-block is-action"><small>本步提示</small><p>{detail}</p></div>
    <NightTargetPicker step={current} selected={selected} seats={seats} roles={roles} targets={targets[current.id] ?? []} onChange={(index,seatNumber) => onTargetChange(current,index,seatNumber)} onConfirmDeath={canConfirmNightDeath(current,assignedRole,impairment) ? (seatNumber) => onConfirmDeath(current,seatNumber) : undefined}/>
    <Button className="night-focus-next" onClick={() => onToggle(current.id)}><Check/>完成并进入下一位<ChevronRight/></Button>
    <p className="night-focus-hint">如需返回修改已完成步骤，可切换至“完整列表”。</p>
  </section>;
}

export default function BoardBuilder() {
  const [customScripts,setCustomScripts] = useState<ScriptDefinition[]>([]);
  const [scriptLibraryOpen,setScriptLibraryOpen] = useState(false);
  const [scriptId, setScriptId] = useState(scripts[0].id);
  const [playerCount, setPlayerCount] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [roleCopies, setRoleCopies] = useState<Record<string,number>>({});
  const [setupChoices, setSetupChoices] = useState<Record<string,number>>({});
  const [view, setView] = useState<ViewMode>('roles');
  const [seats, setSeats] = useState<Seat[]>(makeSeats(10));
  const [activeSeat, setActiveSeat] = useState(1);
  const [nightMode, setNightMode] = useState<'first'|'other'>('first');
  const [nightFocusMode, setNightFocusMode] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [abilityTargets, setAbilityTargets] = useState<Record<string,number[]>>({});
  const [snakeSwap, setSnakeSwap] = useState<SnakeSwap|null>(null);
  const suspendAutosave = useRef(false);
  const [automaticStatusEffects, setAutomaticStatusEffects] = useState<AutomaticStatusEffect[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gamePhase, setGamePhase] = useState<GamePhase>('firstNight');
  const [dayNumber, setDayNumber] = useState(1);
  const [gameLog, setGameLog] = useState<LogEntry[]>([]);
  const [manualNote, setManualNote] = useState('');
  const [demonBluffs, setDemonBluffs] = useState<(string|null)[]>([null,null,null]);
  const [drunkFakeRoleId, setDrunkFakeRoleId] = useState<string|null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const [ringRotation, setRingRotation] = useState(0);
  const [announcedDeadSeats, setAnnouncedDeadSeats] = useState<Set<number>>(new Set());
  const [openingStyle, setOpeningStyle] = useState<'long'|'short'>('long');
  const [narrationScene, setNarrationScene] = useState<NarrationScene|null>(null);
  const [narrationSeats, setNarrationSeats] = useState<number[]>([]);
  const [narrationSeat, setNarrationSeat] = useState(1);
  const [quickLinesOpen, setQuickLinesOpen] = useState(false);
  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [voteTracking, setVoteTracking] = useState(false);
  const [nominationsOpen, setNominationsOpen] = useState(false);
  const [draggedLogId, setDraggedLogId] = useState<string|null>(null);
  const [dragOverLogId, setDragOverLogId] = useState<string|null>(null);
  const draggedLogIdRef = useRef<string|null>(null);
  const dragOverLogIdRef = useRef<string|null>(null);
  const availableScripts = useMemo(() => [...scripts,...customScripts],[customScripts]);
  const script = availableScripts.find((item) => item.id === scriptId) ?? scripts[0];
  const availableSeatStatuses = script.id === 'last-call-tavern' ? seatStatuses : seatStatuses.filter((status) => status !== 'drank');
  const baseQuota = script.counts[playerCount];
  const activeSetupModifiers = useMemo(() => setupModifiers(script.roles,selected,setupChoices), [script.roles,selected,setupChoices]);
  const quota = useMemo(() => withSetupAdjustments(baseQuota,script.roles, selected,setupChoices), [baseQuota,script.roles,selected,setupChoices]);
  const selectedRoles = script.roles.filter((role) => selected.has(role.id));
  const selectedRoleInstances = useMemo(() => selectedRoles.flatMap((role) => Array.from({ length:Math.max(1,roleCopies[role.id] ?? 1) }, () => role)),[roleCopies,selectedRoles]);
  const drunkRole = script.roles.find((role) => role.id === 'drunk');
  const drunkFakeOptions = script.roles.filter((role) => role.alignment === 'townsfolk' && !selected.has(role.id) && !demonBluffs.includes(role.id));
  const availableBluffs = script.roles.filter((role) => (role.alignment === 'townsfolk' || (quota.outsider > 0 && role.alignment === 'outsider')) && !selected.has(role.id) && role.id !== drunkFakeRoleId);
  const nightSteps = useMemo(() => {
    const steps = script.nightOrder[nightMode];
    const fakeRole = selected.has('drunk') ? script.roles.find((role) => role.id === drunkFakeRoleId) : undefined;
    if (!fakeRole) return steps;
    return steps.map((step) => step.roleId === fakeRole.id ? { ...step,drunkActor:true,name:`${step.name}（酒鬼）`,note:`酒鬼以为自己是${fakeRole.name}：照常唤醒，能力无效，可给予错误信息。${step.note}` } : step);
  }, [drunkFakeRoleId,nightMode,script.nightOrder,script.roles,selected]);
  const todaysNominations = nominations.filter((item) => item.dayNumber === dayNumber);
  const activeSeatState = seats.find((seat) => seat.number === activeSeat) ?? seats[0];
  const totals = useMemo(() => Object.fromEntries(alignments.map((alignment) => [alignment, selectedRoles.filter((role) => role.alignment === alignment).reduce((total,role) => total + Math.max(1,roleCopies[role.id] ?? 1),0)])) as Record<Alignment, number>, [roleCopies,selectedRoles]);
  const targetMarks = useMemo(() => {
    const marks: Record<number,string[]> = {};
    for (const [stepId,targetSeats] of Object.entries(abilityTargets)) {
      const step = [...script.nightOrder.first,...script.nightOrder.other].find((item) => item.id === stepId);
      const label = step?.name ?? '夜间技能';
      targetSeats.forEach((seatNumber) => { if (seatNumber) (marks[seatNumber] ??= []).push(label); });
    }
    return marks;
  }, [abilityTargets,script.nightOrder.first,script.nightOrder.other]);

  useEffect(() => {
    document.title = `说书人配板台 · ${script.name}`;
  }, [script.name]);

  // 对局进行中保持屏幕常亮；切回前台时重新申请。
  useEffect(() => {
    if (!gameStarted || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let disposed = false;
    const request = async () => {
      try { lock = await navigator.wakeLock.request('screen'); if (disposed) void lock.release(); }
      catch { /* 系统省电模式等情况下可能被拒绝 */ }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void request(); };
    void request();
    document.addEventListener('visibilitychange',onVisible);
    return () => { disposed = true; document.removeEventListener('visibilitychange',onVisible); void lock?.release().catch(() => undefined); };
  }, [gameStarted]);

  useEffect(() => {
    if (!narrationScene) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setNarrationScene(null); };
    window.addEventListener('keydown',onKey);
    return () => window.removeEventListener('keydown',onKey);
  }, [narrationScene]);

  useEffect(() => {
    let cancelled = false;
    const restore = (saved: Partial<SavedGameState>, library:ScriptDefinition[]) => {
      const savedScript = library.find((item) => item.id === saved.scriptId);
      const savedCount = Number(saved.playerCount);
      if (!savedScript || !savedScript.counts[savedCount] || cancelled) return false;
      const roleIds = new Set(savedScript.roles.map((role) => role.id));
      const restoredSeats = Array.from({ length:savedCount }, (_, index) => {
        const seat = Array.isArray(saved.seats) ? saved.seats[index] : undefined;
        return { number:index + 1, roleId:seat?.roleId && roleIds.has(seat.roleId) ? seat.roleId : null, alive:seat?.alive !== false, statuses:Array.isArray(seat?.statuses) ? seat.statuses.filter((status) => seatStatuses.includes(status)) : [], name:typeof seat?.name === 'string' && seat.name.trim() ? seat.name.slice(0,12) : undefined };
      });
      setScriptId(savedScript.id); setPlayerCount(savedCount);
      const restoredSelected = new Set(Array.isArray(saved.selected) ? saved.selected.filter((id) => roleIds.has(id)) : []);
      setSelected(restoredSelected);
      setRoleCopies(Object.fromEntries(savedScript.roles.filter((role) => restoredSelected.has(role.id)).map((role) => {
        const savedCopies = Math.floor(Number(saved.roleCopies?.[role.id]) || 1);
        return [role.id,Math.min(Math.max(1,savedCopies),role.maxCopies ?? 1)];
      })));
      setSetupChoices(Object.fromEntries(savedScript.roles.flatMap((role) => {
        const rule = role.setupRules?.outsiderDelta;
        if (!rule) return [];
        const savedChoice = Number(saved.setupChoices?.[role.id]);
        return [[role.id,rule.options.includes(savedChoice) ? savedChoice : rule.default]];
      })));
      setLocked(new Set(Array.isArray(saved.locked) ? saved.locked.filter((id) => roleIds.has(id)) : []));
      setView(['roles','seats','night','history'].includes(saved.view ?? '') ? saved.view as ViewMode : 'roles');
      setSeats(restoredSeats); setActiveSeat(Math.min(Math.max(1,Number(saved.activeSeat) || 1),savedCount));
      setNightMode(saved.nightMode === 'other' ? 'other' : 'first'); setNightFocusMode(Boolean(saved.nightFocusMode));
      setCompletedSteps(new Set(Array.isArray(saved.completedSteps) ? saved.completedSteps : []));
      const restoredTargets = Object.fromEntries(Object.entries(saved.abilityTargets ?? {}).map(([key,values]) => [key,Array.isArray(values) ? values.filter((value) => Number.isInteger(value) && value >= 1 && value <= savedCount) : []]));
      setAbilityTargets(restoredTargets);
      // 旧存档的投毒者目标迁移为普通的自动效果记录。
      const legacyPoisonSeat = Number(saved.automaticPoisonSeat);
      const legacyPoison: AutomaticStatusEffect[] = Number.isInteger(legacyPoisonSeat) && legacyPoisonSeat >= 1 && legacyPoisonSeat <= savedCount ? [{ stepId:'legacy-poisoner',targetIndex:0,roleId:'poisoner',seatNumber:legacyPoisonSeat,status:'poisoned',expires:'nextDusk' }] : [];
      setAutomaticStatusEffects([...(Array.isArray(saved.automaticStatusEffects) ? saved.automaticStatusEffects.filter((effect) => effect.seatNumber >= 1 && effect.seatNumber <= savedCount && seatStatuses.includes(effect.status)) : []),...legacyPoison]);
      setSnakeSwap(saved.snakeSwap && Number.isInteger(saved.snakeSwap.charmerSeat) && Number.isInteger(saved.snakeSwap.demonSeat) ? saved.snakeSwap : null);
      setGameStarted(Boolean(saved.gameStarted)); setGamePhase(['firstNight','day','night'].includes(saved.gamePhase ?? '') ? saved.gamePhase! : 'firstNight');
      setDayNumber(Math.max(1,Number(saved.dayNumber) || 1));
      setGameLog(Array.isArray(saved.gameLog) ? saved.gameLog
        .filter((entry) => !entry.title?.startsWith('完成夜间步骤：'))
        .map((entry) => ({
          ...entry,
          title:entry.title.replace(/首个夜晚/g,'第1夜').replace(/第\s+(\d+)\s+([天夜])/g,'第$1$2'),
          detail:entry.detail?.replace(/首个夜晚/g,'第1夜').replace(/第\s+(\d+)\s+([天夜])/g,'第$1$2'),
        })) : []);
      setDemonBluffs(Array.isArray(saved.demonBluffs) ? [0,1,2].map((index) => saved.demonBluffs?.[index] ?? null) : [null,null,null]);
      setDrunkFakeRoleId(saved.drunkFakeRoleId && roleIds.has(saved.drunkFakeRoleId) ? saved.drunkFakeRoleId : null);
      setRingRotation(Number.isFinite(saved.ringRotation) ? Number(saved.ringRotation) : 0);
      setAnnouncedDeadSeats(new Set(Array.isArray(saved.announcedDeadSeats) ? saved.announcedDeadSeats.filter((seat) => Number.isInteger(seat) && seat >= 1 && seat <= savedCount) : []));
      setNarrationSeats(Array.isArray(saved.lastDawnDeadSeats) ? saved.lastDawnDeadSeats.filter((seat) => Number.isInteger(seat) && seat >= 1 && seat <= savedCount) : []);
      setOpeningStyle(saved.openingStyle === 'short' ? 'short' : 'long');
      setNominations(Array.isArray(saved.nominations) ? saved.nominations.filter((item) => Number.isInteger(item?.nominee) && item.nominee >= 1 && item.nominee <= savedCount) : []);
      setVoteTracking(Boolean(saved.voteTracking));
      return true;
    };
    const load = () => {
      let localState: Partial<SavedGameState>|null = null;
      let loadedCustomScripts:ScriptDefinition[] = [];
      try {
        const customRaw = window.localStorage?.getItem(customScriptsKey);
        if (customRaw) {
          const parsed = JSON.parse(customRaw) as unknown;
          loadedCustomScripts = Array.isArray(parsed) ? parsed.filter(isCustomScript) : [];
          setCustomScripts(loadedCustomScripts);
        }
        const raw = window.localStorage?.getItem(localGameKey);
        if (raw) localState = JSON.parse(raw) as Partial<SavedGameState>;
      } catch { window.localStorage?.removeItem(localGameKey); }
      if (localState) restore(localState,[...scripts,...loadedCustomScripts]);
      if (!cancelled) setHistoryReady(true);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!historyReady) return;
    const timer = window.setTimeout(() => {
      if (suspendAutosave.current) return;
      const state: SavedGameState = { version:11, savedAt:Date.now(), scriptId, playerCount, selected:[...selected], locked:[...locked], roleCopies, setupChoices, view, seats, activeSeat, nightMode, nightFocusMode, completedSteps:[...completedSteps], abilityTargets, automaticStatusEffects, snakeSwap, gameStarted, gamePhase, dayNumber, gameLog, demonBluffs, ringRotation, drunkFakeRoleId, announcedDeadSeats:[...announcedDeadSeats], lastDawnDeadSeats:narrationSeats, openingStyle, nominations, voteTracking };
      try { window.localStorage?.setItem(localGameKey,JSON.stringify(state)); } catch { /* Storage may be unavailable in private browsing. */ }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [abilityTargets, activeSeat, announcedDeadSeats, automaticStatusEffects, completedSteps, dayNumber, demonBluffs, drunkFakeRoleId, gameLog, gamePhase, gameStarted, historyReady, locked, narrationSeats, nightFocusMode, nightMode, nominations, openingStyle, playerCount, ringRotation, roleCopies, scriptId, seats, selected, setupChoices, snakeSwap, view, voteTracking]);

  useEffect(() => {
    setDemonBluffs((current) => current.map((id) => {
      if (!id || selected.has(id) || id === drunkFakeRoleId) return null;
      const role = script.roles.find((item) => item.id === id);
      return role && (role.alignment === 'townsfolk' || (quota.outsider > 0 && role.alignment === 'outsider')) ? id : null;
    }));
  }, [drunkFakeRoleId, quota.outsider, script.roles, selected]);

  useEffect(() => {
    if (!selected.has('drunk')) {
      setDrunkFakeRoleId(null);
      return;
    }
    setDrunkFakeRoleId((current) => drunkFakeOptions.some((role) => role.id === current) ? current : shuffled(drunkFakeOptions)[0]?.id ?? null);
  }, [demonBluffs, script.roles, selected]);

  const messages = useMemo(() => {
    const result: { type: 'ok'|'warn'|'info'; text: string }[] = [];
    const mismatches = alignments.filter((alignment) => totals[alignment] !== quota[alignment]);
    result.push(!mismatches.length ? { type:'ok', text:'阵营名额已配齐，可以进入座位安排。' } : { type:'info', text:`还需调整：${mismatches.map((alignment) => `${alignmentMeta[alignment].short} ${totals[alignment]}/${quota[alignment]}`).join('、')}` });
    if (selected.has('damsel') && !selected.has('huntsman')) result.push({ type:'warn', text:'落难少女在场但没有巡山人；确认这是你想要的配置。' });
    if (selected.has('drunk')) result.push(drunkFakeRoleId ? { type:'ok', text:`酒鬼假身份已分配为${script.roles.find((role) => role.id === drunkFakeRoleId)?.name ?? '不在场镇民'}。` } : { type:'warn', text:'酒鬼在场，但当前没有可用的不在场镇民作为假身份。' });
    const noEvilRole = selectedRoles.find((role) => role.setupRules?.requiresNoEvil);
    if (noEvilRole && selectedRoles.some((role) => role.alignment === 'minion' || role.alignment === 'demon')) result.push({ type:'warn', text:`${noEvilRole.name}要求没有邪恶角色在场，与当前选择冲突。` });
    if (selected.has('marionette')) result.push({ type:'info', text:'提线木偶需要与恶魔邻座，安排座位时请检查。' });
    if (selected.has('vortox')) result.push({ type:'warn', text:'涡流在场：所有镇民信息必须错误，而且每天必须有人被处决。' });
    if (selected.has('no-dashii')) result.push({ type:'info', text:'诺-达鲺在场：安排或换位后，重新检查其两侧最近的镇民并标记中毒。' });
    const assignedCount = seats.filter((seat) => seat.roleId).length;
    if (assignedCount && assignedCount < playerCount) result.push({ type:'info', text:`座位身份已分配 ${assignedCount}/${playerCount}。` });
    return result;
  }, [activeSetupModifiers, drunkFakeRoleId, playerCount, quota, script.roles, seats, selected, selectedRoles, totals]);

  function addLog(kind: LogKind, title: string, detail?: string, phase = gamePhase, day = dayNumber) {
    const createdAt = Date.now();
    const id = `${createdAt}-${Math.random().toString(36).slice(2,8)}`;
    setGameLog((current) => [...current, { id, dayNumber:day, phase, kind, title, detail, createdAt }]);
    return id;
  }
  function resetRoundState() { setSeats((current) => makeSeats(playerCount,current)); setActiveSeat(1); setCompletedSteps(new Set()); setAbilityTargets({}); setSnakeSwap(null); setAutomaticStatusEffects([]); setGameStarted(false); setGamePhase('firstNight'); setDayNumber(1); setGameLog([]); setAnnouncedDeadSeats(new Set()); setNarrationSeats([]); setNominations([]); }
  function toggleRole(role: Role) {
    if (locked.has(role.id)) return;
    const removing = selected.has(role.id);
    setSelected((current) => { const next = new Set(current); if (next.has(role.id)) next.delete(role.id); else next.add(role.id); return next; });
    setRoleCopies((current) => { const next = { ...current }; if (removing) delete next[role.id]; else next[role.id] = 1; return next; });
    if (!removing && role.setupRules?.outsiderDelta) setSetupChoices((current) => ({ ...current, [role.id]:role.setupRules!.outsiderDelta!.default }));
    setSeats((current) => current.map((seat) => seat.roleId === role.id ? { ...seat, roleId:null } : seat));
    setCompletedSteps(new Set());
  }
  function toggleLock(role: Role) {
    setLocked((current) => { const next = new Set(current); if (next.has(role.id)) next.delete(role.id); else next.add(role.id); return next; });
    setSelected((current) => new Set(current).add(role.id));
    setRoleCopies((current) => ({ ...current, [role.id]:Math.max(1,current[role.id] ?? 1) }));
    if (role.setupRules?.outsiderDelta) setSetupChoices((current) => ({ ...current, [role.id]:current[role.id] ?? role.setupRules!.outsiderDelta!.default }));
  }
  function changeRoleCopies(role:Role, requested:number) {
    const count = Math.min(Math.max(1,requested),role.maxCopies ?? 1);
    setRoleCopies((current) => ({ ...current,[role.id]:count }));
    setSeats((current) => {
      let kept = 0;
      return current.map((seat) => seat.roleId !== role.id ? seat : ++kept <= count ? seat : { ...seat,roleId:null });
    });
    setCompletedSteps(new Set());
  }
  function changeSetupChoice(role:Role, value:number) {
    const rule = role.setupRules?.outsiderDelta;
    if (!rule?.options.includes(value)) return;
    setSetupChoices((current) => ({ ...current,[role.id]:value }));
    setCompletedSteps(new Set());
  }
  function buildBoard(random: boolean) {
    const next = new Set(locked);
    const nextCopies:Record<string,number> = Object.fromEntries([...locked].map((id) => [id,Math.max(1,roleCopies[id] ?? 1)]));
    const alignmentCount = (alignment:Alignment) => script.roles.filter((role) => role.alignment === alignment && next.has(role.id)).reduce((total,role) => total + Math.max(1,nextCopies[role.id] ?? 1),0);
    const changesSetup = (role:Role) => Boolean(role.setupRules?.outsiderDelta || role.setupRules?.requiresNoEvil);
    // “无邪恶角色”会把整局变成特殊玩法，只有锁定时才会出现在配板里。
    const addToAlignment = (alignment: Alignment, target: number, allowSetupRoles = true) => {
      const candidates = script.roles.filter((role) => role.alignment === alignment && !next.has(role.id) && !role.setupRules?.requiresNoEvil && (allowSetupRoles || !changesSetup(role)));
      const pool = random ? shuffled(candidates) : candidates;
      pool.slice(0, Math.max(0, target - alignmentCount(alignment))).forEach((role) => { next.add(role.id); nextCopies[role.id] = 1; });
    };

    alignments.forEach((alignment) => addToAlignment(alignment,baseQuota[alignment]));
    // 补齐阶段只增删不改配置的角色，避免补进来的角色又改变刚算好的名额。
    let targetQuota = withSetupAdjustments(baseQuota,script.roles,next,setupChoices);
    for (let pass = 0; pass < 4; pass += 1) {
      let setupChanged = false;
      alignments.forEach((alignment) => {
        // 先移除普通角色；仍然超额时才移除会改配置的角色，并在本轮结束后重算名额。
        const unlocked = (random ? shuffled(script.roles) : [...script.roles]).filter((role) => role.alignment === alignment && next.has(role.id) && !locked.has(role.id));
        const removable = [...unlocked.filter(changesSetup),...unlocked.filter((role) => !changesSetup(role))];
        while (alignmentCount(alignment) > targetQuota[alignment] && removable.length) {
          const role = removable.pop()!;
          next.delete(role.id); delete nextCopies[role.id];
          if (changesSetup(role)) setupChanged = true;
        }
        addToAlignment(alignment,targetQuota[alignment],false);
      });
      // 普通角色不够时才补入改配置的角色，并按新名额再调整一轮。
      const short = alignments.filter((alignment) => alignmentCount(alignment) < targetQuota[alignment]);
      if (!short.length && !setupChanged) break;
      short.forEach((alignment) => addToAlignment(alignment,targetQuota[alignment]));
      targetQuota = withSetupAdjustments(baseQuota,script.roles,next,setupChoices);
    }
    const bluffPool = script.roles.filter((role) => (role.alignment === 'townsfolk' || (targetQuota.outsider > 0 && role.alignment === 'outsider')) && !next.has(role.id));
    setDrunkFakeRoleId(null); setSelected(next); setRoleCopies(nextCopies); setDemonBluffs(shuffled(bluffPool).slice(0,3).map((role) => role.id)); setSeats((current) => makeSeats(playerCount,current)); setCompletedSteps(new Set()); setAbilityTargets({}); setSnakeSwap(null); setAutomaticStatusEffects([]);
  }
  function changePlayerCount(count: number) {
    const losesSeats = count < playerCount && (gameStarted || seats.slice(count).some((seat) => seat.roleId || !seat.alive || seat.statuses.length));
    if (losesSeats && !window.confirm(`改为${count}人会移除${count + 1}–${playerCount}号座位及其身份和状态，继续吗？`)) return;
    setPlayerCount(count);
    setSeats((current) => Array.from({ length:count }, (_, index) => current[index] ? { ...current[index], number:index + 1 } : { number:index + 1, roleId:null, alive:true, statuses:[] }));
    setActiveSeat((current) => Math.min(current, count));
    setAnnouncedDeadSeats((current) => new Set([...current].filter((seat) => seat <= count)));
    setCompletedSteps(new Set()); setAbilityTargets((current) => Object.fromEntries(Object.entries(current).map(([key,values]) => [key,values.filter((value) => value <= count)]))); setAutomaticStatusEffects((current) => current.filter((effect) => effect.seatNumber <= count));
    setNominations((current) => current.filter((item) => item.nominee <= count).map((item) => item.nominator && item.nominator > count ? { ...item,nominator:null } : item));
  }
  function changeScript(id: string, library = availableScripts) {
    const nextScript = library.find((item) => item.id === id) ?? scripts[0];
    const nextCount = nextScript.counts[playerCount] ? playerCount : Number(Object.keys(nextScript.counts)[0] ?? 7);
    setScriptId(nextScript.id); setPlayerCount(nextCount); setSelected(new Set()); setLocked(new Set()); setRoleCopies({}); setSetupChoices({}); setDemonBluffs([null,null,null]); setDrunkFakeRoleId(null); setSeats((current) => makeSeats(nextCount,current)); setActiveSeat(1); setCompletedSteps(new Set()); setAbilityTargets({}); setSnakeSwap(null); setAutomaticStatusEffects([]); setGameStarted(false); setGamePhase('firstNight'); setDayNumber(1); setGameLog([]); setAnnouncedDeadSeats(new Set()); setNarrationSeats([]); setNominations([]); setRingRotation(0); setView('roles');
  }
  function persistCustomScripts(next:ScriptDefinition[]) {
    try { window.localStorage.setItem(customScriptsKey,JSON.stringify(next)); }
    catch { window.alert('浏览器本机存储空间不足。可以先导出已有剧本 JSON，再删除不常用的自定义剧本。'); return false; }
    setCustomScripts(next);
    return true;
  }
  function saveCustomScript(nextScript:ScriptDefinition) {
    const next = [...customScripts.filter((item) => item.id !== nextScript.id),nextScript];
    if (persistCustomScripts(next)) changeScript(nextScript.id,[...scripts,...next]);
  }
  // 只更新剧本内容（如角色逻辑），不切换剧本、不清空当前对局。
  function updateCustomScript(nextScript:ScriptDefinition) {
    const exists = customScripts.some((item) => item.id === nextScript.id);
    persistCustomScripts(exists ? customScripts.map((item) => item.id === nextScript.id ? nextScript : item) : [...customScripts,nextScript]);
  }
  function deleteCustomScript(id:string) {
    if (!window.confirm('删除这个自定义剧本？已导出的 JSON 不受影响。')) return;
    if (!persistCustomScripts(customScripts.filter((item) => item.id !== id))) return;
    if (scriptId === id) changeScript(scripts[0].id);
  }
  function exportBackup() {
    let currentGame: unknown = null;
    try { const raw = window.localStorage.getItem(localGameKey); currentGame = raw ? JSON.parse(raw) : null; } catch { currentGame = null; }
    const date = new Date().toISOString().slice(0,10);
    const blob = new Blob([JSON.stringify({ type:backupFileType,version:1,exportedAt:new Date().toISOString(),customScripts,currentGame },null,2)],{ type:'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `说书人配板台备份-${date}.json`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  // 合并导入：已有的同 id 剧本保留不动；对局只有在确认后才替换。
  function importBackup(value:{ customScripts?:unknown; currentGame?:unknown }) {
    const incoming = Array.isArray(value.customScripts) ? value.customScripts.filter(isCustomScript) : [];
    const existingIds = new Set(customScripts.map((item) => item.id));
    const added = incoming.filter((item) => !existingIds.has(item.id));
    if (added.length && !persistCustomScripts([...customScripts,...added])) return;
    const summary = `已导入 ${added.length} 个新剧本${incoming.length > added.length ? `，跳过 ${incoming.length - added.length} 个已存在的剧本` : ''}。`;
    if (value.currentGame && typeof value.currentGame === 'object' && window.confirm(`${summary}\n\n备份里还有一局对局记录。要用它替换当前对局吗？\n选择“取消”则只导入剧本。`)) {
      suspendAutosave.current = true;
      try { window.localStorage.setItem(localGameKey,JSON.stringify(value.currentGame)); window.location.reload(); }
      catch { suspendAutosave.current = false; window.alert('对局恢复失败：浏览器本机存储空间不足。'); }
      return;
    }
    window.alert(summary);
  }
  function requestScriptChange(id:string) {
    if ((gameStarted || gameLog.length) && !window.confirm('切换剧本会清空当前配板、座位和对局日志，继续吗？')) return;
    changeScript(id);
  }
  function randomizeBluffs() {
    setDemonBluffs(shuffled(availableBluffs).slice(0,3).map((role) => role.id));
  }
  function randomizeDrunkFakeRole() {
    const next = shuffled(drunkFakeOptions.filter((role) => role.id !== drunkFakeRoleId))[0] ?? drunkFakeOptions[0];
    setDrunkFakeRoleId(next?.id ?? null);
  }
  function setBluff(index: number, roleId: string | null) {
    setDemonBluffs((current) => current.map((id, currentIndex) => currentIndex === index ? roleId : id === roleId ? null : id));
  }
  function assignRole(seatNumber: number, roleId: string | null) {
    const currentSeat = seats.find((seat) => seat.number === seatNumber);
    const oldRole = script.roles.find((role) => role.id === currentSeat?.roleId);
    const newRole = script.roles.find((role) => role.id === roleId);
    setSeats((current) => {
      const allowedCopies = roleId ? Math.max(1,roleCopies[roleId] ?? 1) : 1;
      const assignedSeats = roleId ? current.filter((item) => item.roleId === roleId && item.number !== seatNumber) : [];
      const seatToClear = assignedSeats.length >= allowedCopies ? assignedSeats[0]?.number : null;
      return current.map((seat) => seat.number === seatToClear ? { ...seat,roleId:null } : seat.number === seatNumber ? { ...seat, roleId } : seat);
    });
    if (gameStarted && oldRole?.id !== newRole?.id) addLog('role', `${seatNumber}号身份${oldRole ? '发生变化' : '已设置'}`, `${oldRole?.name ?? '未分配'} → ${newRole?.name ?? '未分配'}`);
  }
  function randomizeSeats() {
    const roles = shuffled(selectedRoleInstances);
    setSeats((current) => current.map((seat, index) => ({ ...seat, roleId:roles[index]?.id ?? null, alive:true, statuses:[] })));
    setAbilityTargets({}); setSnakeSwap(null); setAutomaticStatusEffects([]);
  }
  function swapSeats(from: number, to: number) {
    if (from === to) return;
    const fromSeat = seats.find((seat) => seat.number === from);
    const toSeat = seats.find((seat) => seat.number === to);
    if (!fromSeat || !toSeat) return;
    setSeats((current) => current.map((seat) => seat.number === from ? { ...toSeat, number:from, name:fromSeat.name } : seat.number === to ? { ...fromSeat, number:to, name:toSeat.name } : seat));
    setActiveSeat(to);
    if (gameStarted) {
      const fromRole = script.roles.find((role) => role.id === fromSeat.roleId)?.name ?? '未分配';
      const toRole = script.roles.find((role) => role.id === toSeat.roleId)?.name ?? '未分配';
      addLog('role',`${from}号与${to}号交换座位`,`${fromRole} ↔ ${toRole}`);
    }
  }
  function changeSeatName(seatNumber: number, name: string) {
    setSeats((current) => current.map((seat) => seat.number === seatNumber ? { ...seat,name:name.slice(0,12) || undefined } : seat));
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
    setCompletedSteps((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function changeNightTarget(step: NightStep, index: number, seatNumber: number|null) {
    const previous = abilityTargets[step.id]?.[index] ?? null;
    if (previous === seatNumber) return;
    setAbilityTargets((current) => {
      const nextTargets = [...(current[step.id] ?? [])];
      if (seatNumber === null) nextTargets.splice(index,1);
      else nextTargets[index] = seatNumber;
      const next = { ...current };
      if (nextTargets.some(Boolean)) next[step.id] = nextTargets;
      else delete next[step.id];
      return next;
    });
    // 同一步骤改选或清除目标时，先撤销这一夜已经发生的舞蛇人交换。
    const swap = snakeSwap?.stepId === step.id ? snakeSwap : null;
    const undoSwap = (list:Seat[]) => !swap ? list : list.map((seat) => {
      if (seat.number === swap.charmerSeat) return { ...seat,roleId:swap.charmerRoleId };
      if (seat.number === swap.demonSeat) return { ...seat,roleId:swap.demonRoleId,statuses:swap.addedPoison ? seat.statuses.filter((status) => status !== 'poisoned') : seat.statuses };
      return seat;
    });
    const board = undoSwap(seats);
    const phase: GamePhase = gameStarted ? gamePhase : 'firstNight';
    const day = gameStarted ? dayNumber : 1;
    if (!gameStarted) {
      setGameStarted(true); setGamePhase(phase); setDayNumber(1);
      addLog('system','游戏开始','进入第1夜',phase,1);
    }
    if (swap) {
      setSeats(undoSwap); setSnakeSwap(null);
      addLog('role','撤销舞蛇人交换',`${swap.charmerSeat}号与${swap.demonSeat}号的身份已换回`,phase,day);
    }
    const actorRole = nightActorRole(step,selected,script.roles);
    const actorSeat = nightActorSeat(step,selected,board,script.roles);
    const impairment = nightImpairment(step,actorSeat);
    const actorImpaired = Boolean(impairment);
    const actorName = step.drunkActor ? step.name : actorRole?.name ?? step.name;
    const targetSeat = seatNumber ? board.find((seat) => seat.number === seatNumber) : undefined;
    const targetRole = script.roles.find((role) => role.id === targetSeat?.roleId);
    if (seatNumber) addLog('night',`${actorName}发动技能`,`选择 ${seatNumber} 号玩家 · ${targetRole?.name ?? '身份未分配'}`,phase,day);
    else if (previous) addLog('night',`${actorName}清除技能目标`,`${previous}号玩家`,phase,day);
    if (seatNumber && actorImpaired) addLog('status',`${actorSeat ? `${actorSeat.number}号` : actorName}能力未生效`,`${step.drunkActor ? '实为酒鬼' : `因${impairment?.slice(1)}`}，${actorName}的本次选择只记录、不结算`,phase,day);

    const automation = actorRole?.automation?.configured ? actorRole.automation : builtInAutomation[actorRole?.id ?? ''];
    if (actorRole && automation && !actorImpaired) {
      const status = automationStatusEffects[automation.effect];
      if (status) applyTrackedStatus(step,index,seatNumber,status,automation.expires ?? 'manual',actorRole.id,board);
      else if (automation.effect === 'death' && seatNumber) setSeats((current) => current.map((seat) => seat.number === seatNumber ? { ...seat,alive:false } : seat));
      else if (automation.effect === 'revive' && seatNumber) setSeats((current) => current.map((seat) => seat.number === seatNumber ? { ...seat,alive:true } : seat));
      if (seatNumber && automation.effect !== 'record') addLog('status',
        actorRole.id === 'poisoner' ? `${seatNumber}号被投毒` : `${seatNumber}号${automationEffectLabels[automation.effect]}`,
        actorRole.id === 'poisoner' ? `${targetRole?.name ?? '身份未分配'}：本夜及明天白天能力无效` : `${actorRole.name}自动结算`,phase,day);
    }

    if (actorRole?.id === 'wine-god' && index === 0 && !actorImpaired) {
      applyTrackedStatus(step,index,seatNumber,'drunk','nextDusk',actorRole.id,board);
      if (seatNumber) addLog('status',`${seatNumber}号醉酒`,`${actorRole.name}目标1：持续至下个黄昏`,phase,day);
    }

    if (actorRole?.id === 'snake-charmer' && !actorImpaired && actorSeat?.roleId && targetSeat?.roleId && targetRole?.alignment === 'demon' && actorSeat.number !== targetSeat.number
      && window.confirm(`${targetSeat.number}号是恶魔（${targetRole.name}）。确认舞蛇人与其交换角色和阵营？\n之后改选或清除这个目标，会自动换回。`)) {
      const charmerRoleId = actorSeat.roleId;
      const demonRoleId = targetSeat.roleId;
      setSeats((current) => current.map((seat) => {
        if (seat.number === actorSeat.number) return { ...seat, roleId:demonRoleId };
        if (seat.number === targetSeat.number) return { ...seat, roleId:charmerRoleId, statuses:[...new Set([...seat.statuses,'poisoned' as SeatStatus])] };
        return seat;
      }));
      setSnakeSwap({ stepId:step.id,charmerSeat:actorSeat.number,demonSeat:targetSeat.number,charmerRoleId,demonRoleId,addedPoison:!targetSeat.statuses.includes('poisoned') });
      addLog('role',`舞蛇人命中恶魔，${actorSeat.number}号与${targetSeat.number}号交换身份`,`${actorSeat.number}号成为${targetRole.name}；${targetSeat.number}号成为舞蛇人并中毒`,phase,day);
    }
  }
  // 按“步骤 + 目标序号”记录自动状态；改选目标时只收回自己加上的状态。
  function applyTrackedStatus(step:NightStep, index:number, seatNumber:number|null, status:SeatStatus, expires:AutomaticStatusEffect['expires'], roleId:string, board:Seat[]) {
    const existing = automaticStatusEffects.find((effect) => effect.stepId === step.id && effect.targetIndex === index);
    const others = automaticStatusEffects.filter((effect) => effect !== existing);
    if (existing && existing.seatNumber !== seatNumber) setSeats(releaseEffects([existing],others));
    if (!seatNumber) { setAutomaticStatusEffects(others); return; }
    const target = board.find((seat) => seat.number === seatNumber);
    const heldByOthers = others.some((effect) => effect.seatNumber === seatNumber && effect.status === status);
    const added = existing?.seatNumber === seatNumber ? existing.added : !target?.statuses.includes(status) || heldByOthers;
    setSeats((current) => current.map((seat) => seat.number === seatNumber ? { ...seat,statuses:[...new Set([...seat.statuses,status])] } : seat));
    setAutomaticStatusEffects([...others,{ stepId:step.id,targetIndex:index,roleId,seatNumber,status,expires,added }]);
  }
  function markSeatDead(seatNumber:number, title:string, detail?:string) {
    const target = seats.find((seat) => seat.number === seatNumber);
    if (!target?.alive) return;
    setSeats((current) => current.map((seat) => seat.number === seatNumber ? { ...seat,alive:false } : seat));
    addLog('death',title,detail ?? script.roles.find((role) => role.id === target.roleId)?.name);
  }
  function confirmNightDeath(step:NightStep, seatNumber:number) {
    const roleName = script.roles.find((role) => role.id === seats.find((seat) => seat.number === seatNumber)?.roleId)?.name ?? '身份未分配';
    markSeatDead(seatNumber,`${seatNumber}号死亡`,`${roleName} · ${nightActorRole(step,selected,script.roles)?.name ?? step.name}的夜间目标，说书人确认`);
  }
  // 提名记录与日志共用同一个 id；日志里的票数在渲染时从提名记录读取。
  function addNomination(nominator:number|null, nominee:number) {
    const id = addLog('vote',nominator ? `${nominator}号提名${nominee}号` : `${nominee}号被提名`);
    setNominations((current) => [...current,{ id,dayNumber,nominator,nominee,votes:null }]);
  }
  const clampVotes = (votes:number) => Math.min(Math.max(0,votes),playerCount);
  function changeNominationVotes(id:string, votes:number|null) {
    setNominations((current) => current.map((item) => item.id === id ? { ...item,votes:votes === null ? null : clampVotes(votes) } : item));
  }
  function stepNominationVotes(id:string, delta:number) {
    setNominations((current) => current.map((item) => item.id === id ? { ...item,votes:clampVotes((item.votes ?? 0) + delta) } : item));
  }
  function removeNomination(id:string) {
    setNominations((current) => current.filter((item) => item.id !== id));
    setGameLog((current) => current.filter((entry) => entry.id !== id));
  }
  function startGame() {
    setGameStarted(true); setGamePhase('firstNight'); setDayNumber(1); setNightMode('first');
    addLog('system','游戏开始','进入第1夜','firstNight',1);
    setNarrationScene('opening');
  }
  function advancePhase() {
    let nextPhase: GamePhase;
    let nextDay = dayNumber;
    if (gamePhase === 'firstNight') nextPhase = 'day';
    else if (gamePhase === 'day') nextPhase = 'night';
    else { nextPhase = 'day'; nextDay += 1; }
    setGamePhase(nextPhase); setDayNumber(nextDay); setNightMode('other'); setCompletedSteps(new Set()); setAbilityTargets({}); setSnakeSwap(null); setQuickLinesOpen(false);
    if (nextPhase === 'day') {
      setSeats((current) => current.map((seat) => ({ ...seat,statuses:seat.statuses.filter((status) => status !== 'drank') })));
      const deadSeats = seats.filter((seat) => !seat.alive).map((seat) => seat.number);
      setNarrationSeats(deadSeats.filter((seat) => !announcedDeadSeats.has(seat)));
      setAnnouncedDeadSeats(new Set(deadSeats));
      setNarrationScene('dawn');
    } else {
      setAnnouncedDeadSeats(new Set(seats.filter((seat) => !seat.alive).map((seat) => seat.number)));
      setNarrationScene('nightfall');
    }
    // 到期效果移除状态；“手动移除”的效果在阶段切换后与夜间步骤脱钩，之后改选目标不会再收回它。
    const expiresNow = (effect:AutomaticStatusEffect) => (nextPhase === 'day' && effect.expires === 'nextDawn') || (gamePhase === 'day' && effect.expires === 'nextDusk');
    const expiring = automaticStatusEffects.filter(expiresNow);
    if (expiring.length) setSeats(releaseEffects(expiring,automaticStatusEffects.filter((effect) => !expiresNow(effect))));
    setAutomaticStatusEffects((current) => current.filter((effect) => !expiresNow(effect) && effect.expires !== 'manual'));
    addLog('system',`进入${phaseName(nextPhase,nextDay)}`,undefined,nextPhase,nextDay);
  }
  function clearHistory() {
    if (!gameLog.length || window.confirm(`清空${phaseName(gamePhase,dayNumber)}及之前的全部日志？当前阶段不会改变。`)) setGameLog([]);
  }
  function resetCurrentGame() {
    if (!window.confirm('重置本局？将清空日志、死亡状态、状态标记和夜间进度，但保留当前配板及座位身份。')) return;
    setSeats((current) => current.map((seat) => ({ ...seat, alive:true, statuses:[] })));
    setCompletedSteps(new Set());
    setAbilityTargets({}); setSnakeSwap(null);
    setAutomaticStatusEffects([]);
    setGameStarted(false);
    setGamePhase('firstNight');
    setDayNumber(1);
    setNightMode('first');
    setGameLog([]);
    setManualNote('');
    setAnnouncedDeadSeats(new Set());
    setNarrationSeats([]);
    setNominations([]);
    setNarrationScene(null);
    setQuickLinesOpen(false);
  }
  function submitManualNote() {
    const text = manualNote.trim();
    if (!text) return;
    if (!gameStarted) startGame();
    addLog('note',text,undefined,gameStarted ? gamePhase : 'firstNight',gameStarted ? dayNumber : 1);
    setManualNote('');
  }
  function moveLogEntry(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    setGameLog((current) => {
      const sourceIndex = current.findIndex((entry) => entry.id === sourceId);
      const targetIndex = current.findIndex((entry) => entry.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex,1);
      next.splice(targetIndex,0,moved);
      return next;
    });
  }

  const narrationTitles: Record<NarrationScene,string> = {
    opening:'游戏开场', nightfall:'暮色入夜', dawn:'天亮破晓', discussion:'开启自由公聊', nomination:'玩家提名', silence:'无人提名', execution:'宣判处决', tie:'平票无人处决', lastWords:'遗言结束', demonReveal:'恶魔自爆', goodWin:'善良阵营胜利', evilWin:'邪恶阵营胜利',
  };
  const dawnText = narrationSeats.length
    ? `五更天晓，雄鸡啼鸣，漫漫长夜尽数落幕！诸位，睁眼细看！怎料昨夜灾祸降临，${narrationSeats.map((seat) => `${seat} 号`).join('、')}乡民不幸殒命。`
    : '天光破晓，钟声驱散迷雾。诸位睁眼！可喜昨夜小镇安然无恙，不曾有人殒命。可诸位万万不可松懈，邪魔依旧藏在人群之内。';
  const narrationBody = narrationScene === 'opening'
    ? (openingStyle === 'long' ? narrationText.opening : shortOpening)
    : narrationScene === 'dawn'
      ? dawnText
      : narrationScene === 'execution'
        ? `一番唇枪舌战辩驳完毕，投票尘埃落定！且看票堆高悬，${narrationSeat} 号玩家被全镇乡民判以极刑！\n\n唉，世事难料，此人就此身死。虽已殒命，仍可留下遗言陈述。`
        : narrationScene ? narrationText[narrationScene] : '';

  if (!historyReady) return <main className="game-restoring"><span className="brand-mark"><img src={publicAsset('/brand-mark.svg')} alt=""/></span><p>正在恢复本局…</p></main>;

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand-mark"><img src={publicAsset('/brand-mark.svg')} alt="说书人配板台徽标"/></div><div className="brand-copy"><p>桌面魔典</p><h1>说书人配板台</h1></div>
      <div className="header-controls">
        <label className="script-select"><span>板子 / 剧本</span><NativeSelect value={scriptId} onChange={(event) => requestScriptChange(event.target.value)} aria-label="选择剧本">{availableScripts.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}{item.custom ? ' · 自定义' : ''}</NativeSelectOption>)}</NativeSelect></label>
        <label><span>玩家人数</span><NativeSelect value={playerCount} onChange={(event) => changePlayerCount(Number(event.target.value))} aria-label="玩家人数">{Object.keys(script.counts).map((count) => <NativeSelectOption key={count} value={count}>{count} 人</NativeSelectOption>)}</NativeSelect></label>
        <button className="script-library-button" onClick={() => setScriptLibraryOpen(true)}><Plus/>导入剧本</button>
      </div>
    </header>
    <section className="workspace">
      <div className="catalog-panel">
        <nav className="workspace-nav" aria-label="工具视图">
          <button className={view === 'roles' ? 'is-active' : ''} onClick={() => setView('roles')}><LayoutGrid/>角色配板</button>
          <button className={view === 'seats' ? 'is-active' : ''} onClick={() => setView('seats')}><Users/>环形座位</button>
          <button className={view === 'night' ? 'is-active' : ''} onClick={() => setView('night')}><Moon/>唤醒顺序</button>
          <button className={view === 'history' ? 'is-active' : ''} onClick={() => setView('history')}><BookOpen/>对局日志</button>
        </nav>
        {view !== 'roles' && <section className={`phase-bar ${gameStarted ? 'is-running' : ''}`}><div><span className="phase-dot"/><p><small>当前阶段</small><strong>{gameStarted ? phaseName(gamePhase,dayNumber) : '尚未开始记录'}</strong></p></div>{gameStarted ? <Button onClick={advancePhase}>进入下一阶段<ChevronRight/></Button> : <Button onClick={startGame}><Play/>开始记录</Button>}{gameStarted && gamePhase === 'day' && <Button className={`nomination-shortcut ${nominationsOpen ? 'is-open' : ''}`} variant="outline" onClick={() => setNominationsOpen((open) => !open)}><Gavel/>提名{todaysNominations.length ? ` · ${todaysNominations.length}` : ''}</Button>}{gameStarted && <Button className={`narration-shortcut ${quickLinesOpen ? 'is-open' : ''}`} variant="outline" onClick={() => setQuickLinesOpen((open) => !open)}><ScrollText/>台词</Button>}</section>}
        {view !== 'roles' && quickLinesOpen && <section className="quick-lines" aria-label="临场旁白">
          <div><span><b>台词</b></span><button onClick={() => setQuickLinesOpen(false)} aria-label="关闭台词提示"><X/></button></div>
          <nav>{([
            [gamePhase === 'day' ? 'dawn' : gamePhase === 'firstNight' ? 'opening' : 'nightfall','当前阶段'],['discussion','开启公聊'],['nomination','玩家提名'],['silence','无人提名'],['execution','宣判处决'],['tie','平票无人处决'],['lastWords','遗言结束'],['demonReveal','恶魔自爆'],['goodWin','好人胜利'],['evilWin','邪恶胜利'],
          ] as [NarrationScene,string][]).map(([scene,label]) => <button key={`${scene}-${label}`} onClick={() => { if (scene === 'execution') setNarrationSeat(activeSeat); setNarrationScene(scene); }}>{label}</button>)}</nav>
        </section>}
        {view !== 'roles' && gameStarted && gamePhase === 'day' && nominationsOpen && <NominationPanel dayNumber={dayNumber} seats={seats} nominations={todaysNominations} voteTracking={voteTracking} aliveCount={seats.filter((seat) => seat.alive).length} onVoteTrackingChange={setVoteTracking} onAdd={addNomination} onVotesChange={changeNominationVotes} onVotesStep={stepNominationVotes} onRemove={removeNomination} onExecute={(seatNumber) => { setNarrationSeat(seatNumber); setNarrationScene('execution'); }} onTie={() => setNarrationScene('tie')} onClose={() => setNominationsOpen(false)}/>}

        {view === 'roles' && <>
          <div className={`quota-strip ${activeSetupModifiers.length ? 'has-adjusted' : ''}`}><span className="quota-title"><Users size={16}/>{playerCount} 人标准名额</span>{alignments.map((alignment) => <span key={alignment} className={`quota quota-${alignment}`}>{alignmentMeta[alignment].short}<b>{baseQuota[alignment]}</b></span>)}</div>
          {!!activeSetupModifiers.length && <div className="quota-strip is-adjusted"><span className="quota-title"><Sparkles size={16}/>调整后名额</span>{alignments.map((alignment) => {
            const delta = quota[alignment] - baseQuota[alignment];
            return <span key={alignment} className={`quota quota-${alignment} ${delta ? 'is-changed' : ''}`}>{alignmentMeta[alignment].short}<b>{quota[alignment]}</b>{!!delta && <small>{delta > 0 ? `+${delta}` : delta}</small>}</span>;
          })}{activeSetupModifiers.map((modifier) => <span key={modifier.id} className="quota-modifier">{modifier.label}</span>)}</div>}
          {!!script.specialRules?.length && <div className="special-rule-strip">{script.specialRules.map((rule) => <span key={rule.name}><CircleHelp/><b>{rule.name}</b>{rule.description}</span>)}</div>}
          <div className="role-builder-layout">
            <Tabs defaultValue="townsfolk" className="role-tabs">
              <TabsList className="alignment-tabs" aria-label="按阵营浏览角色">{alignments.map((alignment) => <TabsTrigger key={alignment} value={alignment}>{alignmentMeta[alignment].short}<span>{script.roles.filter((role) => role.alignment === alignment).length}</span></TabsTrigger>)}</TabsList>
              {alignments.map((alignment) => <TabsContent key={alignment} value={alignment}><div className="section-title"><h3>{alignmentMeta[alignment].label}</h3><p>勾选加入当前配板，锁定后随机配板会保留该角色。</p></div><div className="role-grid">{script.roles.filter((role) => role.alignment === alignment).map((role) => <RoleCard key={role.id} role={role} selected={selected.has(role.id)} locked={locked.has(role.id)} copies={Math.max(1,roleCopies[role.id] ?? 1)} setupChoice={setupChoices[role.id]} onSelect={() => toggleRole(role)} onLock={() => toggleLock(role)} onCopiesChange={(count) => changeRoleCopies(role,count)} onSetupChoiceChange={(value) => changeSetupChoice(role,value)}/>)}</div></TabsContent>)}
            </Tabs>
            <aside className="board-panel">
              <div className="board-heading"><div><span className="eyebrow">本局阵容</span><h2>当前配板</h2></div><span className="total-count">{selectedRoleInstances.length}<small>/{playerCount}</small></span></div>
              <div className="board-actions"><Button className="random-board" onClick={() => buildBoard(true)}><Dice5/>随机配板</Button><Button variant="outline" onClick={() => buildBoard(false)}><Sparkles/>按名额补齐</Button><Button variant="outline" onClick={() => { setSelected(new Set(locked)); setRoleCopies(Object.fromEntries([...locked].map((id) => [id,Math.max(1,roleCopies[id] ?? 1)]))); resetRoundState(); }}><RotateCcw/>清空未锁定</Button></div>
              {selected.has('drunk') && drunkRole && <section className="drunk-fake-role"><div className="drunk-fake-heading"><RoleIcon role={drunkRole}/><span><b>酒鬼的假身份</b><small>自动从不在场镇民中选择，并避开恶魔伪装</small></span><button onClick={randomizeDrunkFakeRole} disabled={!drunkFakeOptions.length}><Shuffle/>换一个</button></div><NativeSelect value={drunkFakeRoleId ?? ''} onChange={(event) => setDrunkFakeRoleId(event.target.value || null)} aria-label="酒鬼的假身份"><NativeSelectOption value="">暂无可用镇民</NativeSelectOption>{drunkFakeOptions.map((role) => <NativeSelectOption key={role.id} value={role.id}>{role.name}</NativeSelectOption>)}</NativeSelect></section>}
              <section className="demon-bluffs"><div className="bluff-heading"><div><EyeOff/><span><b>给恶魔的三个伪装</b><small>从不在场的善良角色中选三个</small></span></div><button onClick={randomizeBluffs} disabled={!selectedRoles.some((role) => role.alignment === 'demon') || availableBluffs.length < 3}><Shuffle/>随机准备</button></div>
                {selectedRoles.some((role) => role.alignment === 'demon') ? <div className="bluff-slots">{demonBluffs.map((roleId,index) => {
                  const role = script.roles.find((item) => item.id === roleId);
                  const options = availableBluffs.filter((item) => !demonBluffs.includes(item.id) || item.id === roleId);
                  return <label className="bluff-slot" key={index}><span>{role ? <RoleIcon role={role}/> : <b>{index + 1}</b>}</span><NativeSelect value={roleId ?? ''} onChange={(event) => setBluff(index,event.target.value || null)} aria-label={`说书人准备的第${index + 1}个伪装`}><NativeSelectOption value="">说书人选择</NativeSelectOption>{options.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name} · {alignmentMeta[item.alignment].short}</NativeSelectOption>)}</NativeSelect></label>;
                })}</div> : <p className="bluff-empty">选入恶魔后再准备。</p>}
              </section>
              <div className="selected-groups">{alignments.map((alignment) => <section key={alignment} className={`selected-group group-${alignment}`}><div><span>{alignmentMeta[alignment].short}</span><b>{totals[alignment]} / {quota[alignment]}</b></div><ul>{selectedRoles.filter((role) => role.alignment === alignment).map((role) => <li key={role.id}><RoleIcon role={role} className="mini-role-icon"/>{role.name}{(roleCopies[role.id] ?? 1) > 1 && <b>×{roleCopies[role.id]}</b>}{locked.has(role.id) && <Lock size={11}/>}</li>)}</ul>{!totals[alignment] && <p>尚未选择</p>}</section>)}</div>
              <section className="validation"><h3><ShieldCheck size={17}/>基础校验</h3><div className="message-list">{messages.map((message,index) => <div key={`${message.text}-${index}`} className={`message message-${message.type}`}>{message.type === 'warn' ? <AlertTriangle size={15}/> : message.type === 'ok' ? <Check size={15}/> : <CircleHelp size={15}/>}<span>{message.text}</span></div>)}</div></section>
            </aside>
          </div>
        </>}

        {view === 'seats' && <section className="seat-workspace">
          <div className="view-heading"><div><span className="eyebrow">圆桌魔典</span><h3>环形座位</h3></div><div><Button onClick={randomizeSeats} disabled={!selectedRoleInstances.length}><Shuffle/>随机入座</Button><Button variant="outline" onClick={() => setRingRotation(0)} disabled={Math.abs(ringRotation) < 0.5}><RotateCcw/>方向归零</Button><Button variant="outline" onClick={() => { setSeats((current) => makeSeats(playerCount,current)); setAbilityTargets({}); setSnakeSwap(null); setAutomaticStatusEffects([]); }}><Trash2/>清空座位</Button></div></div>
          <SeatMap seats={seats} roles={script.roles} activeSeat={activeSeat} targetMarks={targetMarks} rotation={ringRotation} drunkFakeRoleId={drunkFakeRoleId} onRotationChange={setRingRotation} onSelect={setActiveSeat} onSwap={swapSeats}/>
          <div className="seat-editor">
            <div className="seat-editor-number"><span>{activeSeatState.number}</span><div><b>{activeSeatState.number}号座位</b><small>{activeSeatState.alive ? '当前存活' : '当前死亡'}</small></div><input className="seat-name-input" value={activeSeatState.name ?? ''} maxLength={12} placeholder="玩家昵称（可选）" onChange={(event) => changeSeatName(activeSeatState.number,event.target.value)} aria-label={`${activeSeatState.number}号玩家昵称`}/></div>
            <label><span>身份</span><NativeSelect value={activeSeatState.roleId ?? ''} onChange={(event) => assignRole(activeSeatState.number, event.target.value || null)} aria-label={`${activeSeatState.number}号身份`}><NativeSelectOption value="">未分配身份</NativeSelectOption>{alignments.map((alignment) => <optgroup key={alignment} label={alignmentMeta[alignment].short}>{selectedRoles.filter((role) => role.alignment === alignment).map((role) => <NativeSelectOption key={role.id} value={role.id}>{role.name}</NativeSelectOption>)}</optgroup>)}</NativeSelect></label>
            <Button variant={activeSeatState.alive ? 'outline' : 'destructive'} onClick={() => toggleSeatAlive(activeSeatState.number)}>{activeSeatState.alive ? <><UserRound/>标记死亡</> : <><Sparkles/>恢复存活</>}</Button>
            <div className="seat-status-editor"><span>状态标记</span><div>{availableSeatStatuses.map((status) => <button key={status} className={`${activeSeatState.statuses.includes(status) ? 'is-active' : ''} status-${status}`} onClick={() => toggleSeatStatus(activeSeatState.number,status)} aria-pressed={activeSeatState.statuses.includes(status)}>{seatStatusMeta[status].short}<b>{seatStatusMeta[status].label}</b></button>)}</div></div>
          </div>
        </section>}

        {view === 'night' && <section className="night-workspace">
          <div className="view-heading"><div><span className="eyebrow">夜间流程</span><h3>夜间唤醒顺序</h3><p>只显示当前配板中需要唤醒的角色；已死亡或失去能力的会自动跳过。</p></div><Button variant="outline" onClick={() => setCompletedSteps(new Set())}><RotateCcw/>重置进度</Button></div>
          <div className="night-control-row"><div className="night-toggle"><button className={nightMode === 'first' ? 'is-active' : ''} onClick={() => setNightMode('first')}><Moon/>第1夜</button><button className={nightMode === 'other' ? 'is-active' : ''} onClick={() => setNightMode('other')}><Sunrise/>之后夜晚</button></div><div className="night-display-toggle"><button className={!nightFocusMode ? 'is-active' : ''} onClick={() => setNightFocusMode(false)}><List/>完整列表</button><button className={nightFocusMode ? 'is-active' : ''} onClick={() => setNightFocusMode(true)}><Maximize2/>专注模式</button></div></div>
          {nightFocusMode
            ? <NightFocus title={nightMode === 'first' ? '第1夜' : '之后夜晚'} steps={nightSteps} selected={selected} seats={seats} roles={script.roles} roleCopies={roleCopies} bluffs={demonBluffs} completed={completedSteps} targets={abilityTargets} onToggle={toggleNightStep} onTargetChange={changeNightTarget} onConfirmDeath={confirmNightDeath}/>
            : <NightList title={nightMode === 'first' ? '第1夜' : '之后夜晚'} steps={nightSteps} selected={selected} seats={seats} roles={script.roles} roleCopies={roleCopies} bluffs={demonBluffs} completed={completedSteps} targets={abilityTargets} onToggle={toggleNightStep} onTargetChange={changeNightTarget} onConfirmDeath={confirmNightDeath}/>}
        </section>}

        {view === 'history' && <section className="history-workspace">
          <div className="view-heading"><div><span className="eyebrow">本局复盘</span><h3>对局日志</h3><p>关键操作自动记录，也可以随时补充说书人备注。</p></div><div>{gameLog.length > 0 && <Button variant="outline" onClick={clearHistory}><Trash2/>清空日志</Button>}<Button className="reset-game-button" variant="outline" onClick={resetCurrentGame}><RotateCcw/>重置本局</Button></div></div>
          <form className="quick-note" onSubmit={(event) => { event.preventDefault(); submitManualNote(); }}><Input value={manualNote} onChange={(event) => setManualNote(event.target.value)} placeholder="记录提名、处决、能力结果或其他关键事件…" aria-label="对局备注"/><Button type="submit" disabled={!manualNote.trim()}><Plus/>添加记录</Button></form>
          <div className="history-timeline">{gameLog.length ? gameLog.map((entry,index) => {
            const previous = gameLog[index - 1];
            const showPhase = !previous || previous.phase !== entry.phase || previous.dayNumber !== entry.dayNumber;
            const votes = entry.kind === 'vote' ? nominations.find((item) => item.id === entry.id)?.votes : null;
            const detail = votes !== null && votes !== undefined ? `得票 ${votes}` : entry.detail;
            return <div key={entry.id} data-log-id={entry.id}>{showPhase && <h4><span/>{phaseName(entry.phase,entry.dayNumber)}</h4>}<article
              draggable
              className={`log-entry log-${entry.kind} ${draggedLogId === entry.id ? 'is-dragging' : ''} ${dragOverLogId === entry.id && draggedLogId !== entry.id ? 'is-drag-over' : ''}`}
              onDragStart={(event) => { draggedLogIdRef.current = entry.id; setDraggedLogId(entry.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain',entry.id); }}
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; dragOverLogIdRef.current = entry.id; setDragOverLogId(entry.id); }}
              onDrop={(event) => { event.preventDefault(); const sourceId = event.dataTransfer.getData('text/plain') || draggedLogIdRef.current; if (sourceId) moveLogEntry(sourceId,entry.id); draggedLogIdRef.current = null; dragOverLogIdRef.current = null; setDraggedLogId(null); setDragOverLogId(null); }}
              onDragEnd={() => { draggedLogIdRef.current = null; dragOverLogIdRef.current = null; setDraggedLogId(null); setDragOverLogId(null); }}
            ><button className="log-drag-handle" aria-label={`拖动调整记录：${entry.title}`} title="拖动调整顺序"
              onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); draggedLogIdRef.current = entry.id; dragOverLogIdRef.current = entry.id; setDraggedLogId(entry.id); setDragOverLogId(entry.id); }}
              onPointerMove={(event) => { if (draggedLogIdRef.current !== entry.id) return; const target = document.elementsFromPoint(event.clientX,event.clientY).map((element) => element.closest<HTMLElement>('[data-log-id]')?.dataset.logId).find(Boolean) ?? null; if (target) { dragOverLogIdRef.current = target; setDragOverLogId(target); } }}
              onPointerUp={(event) => { const target = document.elementsFromPoint(event.clientX,event.clientY).map((element) => element.closest<HTMLElement>('[data-log-id]')?.dataset.logId).find(Boolean) ?? dragOverLogIdRef.current; const source = draggedLogIdRef.current; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); if (source && target) moveLogEntry(source,target); draggedLogIdRef.current = null; dragOverLogIdRef.current = null; setDraggedLogId(null); setDragOverLogId(null); }}
              onPointerCancel={() => { draggedLogIdRef.current = null; dragOverLogIdRef.current = null; setDraggedLogId(null); setDragOverLogId(null); }}><GripVertical/></button><span className="log-mark"/><div><strong>{entry.title}</strong>{detail && <p>{detail}</p>}</div><time>{new Date(entry.createdAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</time><button className="log-delete" onClick={() => setGameLog((current) => current.filter((item) => item.id !== entry.id))} aria-label={`删除记录：${entry.title}`}><Trash2/></button></article></div>;
          }) : <div className="history-empty"><BookOpen/><h4>当前没有日志</h4><p>{gameStarted ? `仍处于${phaseName(gamePhase,dayNumber)}；之后的新记录会继续归入这个阶段。` : '点击上方“开始记录”，死亡、状态变化和夜间步骤会自动出现在这里。'}</p></div>}</div>
        </section>}
      </div>

    </section>
    {narrationScene && <div className="narration-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setNarrationScene(null); }}>
      <section className={`narration-card narration-${narrationScene}`} role="dialog" aria-modal="true" aria-labelledby="narration-title">
        <header><div><span>说书人台词</span><h2 id="narration-title">{narrationTitles[narrationScene]}</h2></div><button onClick={() => setNarrationScene(null)} aria-label="关闭旁白"><X/></button></header>
        {narrationScene === 'opening' && <div className="narration-options"><button className={openingStyle === 'long' ? 'is-active' : ''} onClick={() => setOpeningStyle('long')}>悬疑长篇</button><button className={openingStyle === 'short' ? 'is-active' : ''} onClick={() => setOpeningStyle('short')}>精简快节奏</button></div>}
        {narrationScene === 'execution' && <label className="narration-seat-picker"><span>被处决玩家</span><NativeSelect value={narrationSeat} onChange={(event) => setNarrationSeat(Number(event.target.value))} aria-label="被处决玩家座位">{seats.map((seat) => <NativeSelectOption key={seat.number} value={seat.number}>{seatTitle(seat)}{seat.roleId ? ` · ${script.roles.find((role) => role.id === seat.roleId)?.name ?? ''}` : ''}</NativeSelectOption>)}</NativeSelect></label>}
        <div className="narration-copy">{narrationBody.split('\n').map((line,index) => line ? <p key={index}>{line}</p> : <span key={index}/>)}</div>
        <p className="narration-rule">只照读座位号，不补充或推测死亡原因。</p>
        <footer>
          {narrationScene === 'execution' && (seats.find((seat) => seat.number === narrationSeat)?.alive
            ? <Button variant="destructive" onClick={() => markSeatDead(narrationSeat,`${narrationSeat}号被处决`)}><UserRound/>确认处决 {narrationSeat} 号</Button>
            : <Button variant="outline" disabled>{narrationSeat} 号已死亡</Button>)}
          {narrationScene === 'dawn' && <Button onClick={() => setNarrationScene('discussion')}>接着开启公聊<ChevronRight/></Button>}
          <Button onClick={() => setNarrationScene(null)}>读完，关闭</Button>
        </footer>
    </section>
    </div>}
    <ScriptLibraryDialog open={scriptLibraryOpen} customScripts={customScripts} currentScript={script} onClose={() => setScriptLibraryOpen(false)} onSave={saveCustomScript} onUpdate={updateCustomScript} onDelete={deleteCustomScript} onExportBackup={exportBackup} onImportBackup={importBackup}/>
  </main>;
}
