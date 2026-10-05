'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { AlertTriangle, Bell, BookOpen, Check, ChevronDown, ChevronRight, ChevronUp, CircleHelp, Dice5, EyeOff, GripVertical, LayoutGrid, List, Lock, Maximize2, Moon, Play, Plus, RotateCcw, ShieldCheck, Shuffle, Sparkles, Sunrise, Trash2, UserRound, Users, Volume2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { alignmentMeta, scripts, type Alignment, type NightStep, type Role } from '@/app/data/scripts';

const alignments: Alignment[] = ['townsfolk', 'outsider', 'minion', 'demon'];
const publicAsset = (path:string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${path}`;
type ViewMode = 'roles' | 'seats' | 'night' | 'history';
type GamePhase = 'firstNight'|'day'|'night';
type LogKind = 'system'|'death'|'status'|'role'|'night'|'note';
type LogEntry = { id:string; dayNumber:number; phase:GamePhase; kind:LogKind; title:string; detail?:string; createdAt:number };
type SeatStatus = 'poisoned'|'drunk'|'protected'|'noAbility'|'abilityUsed'|'turnedGood'|'turnedEvil';
type Seat = { number: number; roleId: string | null; alive: boolean; statuses: SeatStatus[] };
type SavedGameState = {
  version:number; savedAt:number; scriptId:string; playerCount:number; selected:string[]; locked:string[]; view:ViewMode;
  seats:Seat[]; activeSeat:number; nightMode:'first'|'other'; nightFocusMode:boolean; completedSteps:string[];
  gameStarted:boolean; gamePhase:GamePhase; dayNumber:number; gameLog:LogEntry[]; demonBluffs:(string|null)[];
  abilityTargets?:Record<string,number[]>; automaticPoisonSeat?:number|null; ringRotation?:number; drunkFakeRoleId?:string|null;
  announcedDeadSeats?:number[]; lastDawnDeadSeats?:number[]; openingStyle?:'long'|'short'; roleCopies?:Record<string,number>; setupChoices?:Record<string,number>;
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
};
const seatStatuses = Object.keys(seatStatusMeta) as SeatStatus[];
const localGameKey = 'storyteller-board-current-game-v2';
const phaseName = (phase: GamePhase, dayNumber: number) => `第${phase === 'firstNight' ? 1 : dayNumber}${phase === 'day' ? '天' : '夜'}`;
const nightTargetCounts: Record<string,number> = {
  'snake-charmer':1, poisoner:1, widow:1, preacher:1, huntsman:1, professor:1, balloonist:1,
  dreamer:1, gambler:1, ravenkeeper:1, cerenovus:1, 'pit-hag':1, godfather:1, lunatic:1,
  noble:3, innkeeper:2, investigator:2, grandmother:1, 'fortune-teller':2, barber:2, farmer:1,
  'toy-maker':3, 'trolley-problem':3, 'black-sun':3, 'hadi-jiya':3,
  seamstress:2, witch:1, 'evil-twin':1, sage:2, 'no-dashii':1, vortox:1,
  'cat-army':1, puck:1, 'magic-cat':1, empath:2, monk:1, assassin:1,
  imp:1, vigormortis:1, 'fang-gu':1,
};

const makeSeats = (count: number): Seat[] => Array.from({ length: count }, (_, index) => ({ number: index + 1, roleId: null, alive: true, statuses: [] }));
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
  return <img className={`role-icon ${className}`} src={publicAsset(`/roles/${role.id}.webp`)} alt="" aria-hidden="true"/>;
}

function RoleCard({ role, selected, locked, copies, setupChoice, onSelect, onLock, onCopiesChange, onSetupChoiceChange }: { role: Role; selected: boolean; locked: boolean; copies:number; setupChoice?:number; onSelect: () => void; onLock: () => void; onCopiesChange:(count:number) => void; onSetupChoiceChange:(value:number) => void }) {
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
        aria-label={`${seat.number}号，${role?.name ?? '未分配'}，${seat.alive ? '存活' : '死亡'}`}
        aria-describedby={role ? `seat-ability-${seat.number}` : undefined}
      >
        <span><b>{seat.number}号</b><i>{seat.alive ? '存活' : '死亡'}</i></span>
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

function nightActorRole(step: NightStep, selected: Set<string>, roles: Role[]) {
  if (step.roleId) return roles.find((role) => role.id === step.roleId);
  if (step.requiredAlignment === 'demon' && step.phase === '行动') return roles.find((role) => role.alignment === 'demon' && selected.has(role.id));
  return undefined;
}

function nightActorSeat(step: NightStep, selected: Set<string>, seats: Seat[], roles: Role[]) {
  const role = nightActorRole(step,selected,roles);
  return role ? seats.find((seat) => seat.roleId === role.id) : undefined;
}

function nightTargetCount(step: NightStep, selected: Set<string>, roles: Role[]) {
  return nightTargetCounts[nightActorRole(step,selected,roles)?.id ?? ''] ?? 0;
}

function NightTargetPicker({ step, selected, seats, roles, targets, onChange }: { step:NightStep; selected:Set<string>; seats:Seat[]; roles:Role[]; targets:number[]; onChange:(index:number, seatNumber:number|null) => void }) {
  const count = nightTargetCount(step,selected,roles);
  if (!count) return null;
  return <div className="night-target-picker"><span>技能目标</span><div>{Array.from({ length:count }, (_, index) => <label key={index}>
    <small>{count > 1 ? `目标 ${index + 1}` : '选择玩家'}</small>
    <NativeSelect value={targets[index] ?? ''} onChange={(event) => onChange(index,event.target.value ? Number(event.target.value) : null)} aria-label={`${step.name}目标${index + 1}`}>
      <NativeSelectOption value="">请选择</NativeSelectOption>
      {seats.map((seat) => {
        const role = roles.find((item) => item.id === seat.roleId);
        const duplicate = targets.some((value,targetIndex) => targetIndex !== index && value === seat.number);
        return <NativeSelectOption key={seat.number} value={seat.number} disabled={duplicate}>{seat.number}号 · {role?.name ?? '未分配'}{seat.alive ? '' : ' · 已死亡'}</NativeSelectOption>;
      })}
    </NativeSelect>
  </label>)}</div></div>;
}

function visibleNightSteps(steps: NightStep[], selected: Set<string>, seats: Seat[], roles: Role[]) {
  return steps.filter((step) => {
    if (step.requiredAlignment && !roles.some((role) => role.alignment === step.requiredAlignment && selected.has(role.id))) return false;
    if (step.skipWhenRolePresent && selected.has(step.skipWhenRolePresent)) return false;
    if (!step.roleId) return true;
    if (!selected.has(step.roleId)) return false;
    const assignedSeats = seats.filter((seat) => seat.roleId === step.roleId);
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
  const alignment = step.roleId ? roles.find((role) => role.id === step.roleId)?.alignment : step.requiredAlignment;
  const expectedRoles = step.roleId
    ? roles.filter((role) => role.id === step.roleId && selected.has(role.id))
    : alignment ? roles.filter((role) => role.alignment === alignment && selected.has(role.id)) : [];
  if (!expectedRoles.length) return null;
  const roleIds = new Set(expectedRoles.map((role) => role.id));
  const assigned = seats.filter((seat) => seat.roleId && roleIds.has(seat.roleId));
  const expectedCount = step.roleId ? Math.max(1,roleCopies[step.roleId] ?? 1) : expectedRoles.reduce((total,role) => total + Math.max(1,roleCopies[role.id] ?? 1),0);
  const unassignedCount = Math.max(0,expectedCount - assigned.length);
  const assignedText = assigned.map((seat) => `${seat.number}号${seat.alive ? '' : '（死亡）'}`).join('、');
  const missingText = unassignedCount ? expectedCount === 1 ? '未入座' : `${unassignedCount}名未入座` : '';
  const text = [assignedText,missingText].filter(Boolean).join(' · ');
  return { text, alignment };
}

function NightList({ title, steps, selected, seats, roles, roleCopies, bluffs, completed, targets, onToggle, onTargetChange }: { title: string; steps: NightStep[]; selected: Set<string>; seats: Seat[]; roles: Role[]; roleCopies:Record<string,number>; bluffs: (string|null)[]; completed: Set<string>; targets:Record<string,number[]>; onToggle: (id: string) => void; onTargetChange:(step:NightStep,index:number,seatNumber:number|null) => void }) {
  const visible = visibleNightSteps(steps, selected, seats, roles);
  return <section className="night-list">
    <div className="night-list-heading"><div><span className="eyebrow">WAKE ORDER</span><h3>{title}</h3></div><b>{visible.filter((step) => completed.has(step.id)).length} / {visible.length}</b></div>
    <ol>{visible.map((step, index) => {
      const assignedRole = nightActorRole(step,selected,roles);
      const seatLabel = nightStepSeatLabel(step,selected,seats,roles,roleCopies);
      const actorSeat = nightActorSeat(step,selected,seats,roles);
      const impaired = actorSeat?.statuses.includes('poisoned') || actorSeat?.statuses.includes('drunk');
      const demonInfo = nightStepDetail(step, selected, roles, bluffs);
      return <li key={step.id} className={`${completed.has(step.id) ? 'is-complete' : ''} ${impaired ? 'is-impaired' : ''}`}>
        <span className="night-index">{String(index + 1).padStart(2, '0')}</span>
        <Checkbox checked={completed.has(step.id)} onCheckedChange={() => onToggle(step.id)} aria-label={`完成${step.name}`}/>
        {assignedRole ? <span className="night-role-trigger"><RoleIcon role={assignedRole} className="night-role-icon"/></span> : <span className="night-role-icon system-icon"><Moon/></span>}
        <button className="night-step-main" onClick={() => onToggle(step.id)} aria-describedby={assignedRole ? `night-ability-${step.id}` : undefined}><strong>{step.name}</strong><small>{demonInfo}</small></button>
        <span className={`phase phase-${step.phase}`}>{step.phase}</span>
        {seatLabel && <span className={`night-seat ${seatLabel.alignment ? `night-seat-${seatLabel.alignment}` : ''}`}><b>玩家</b>{seatLabel.text}</span>}
        {impaired && <div className="night-impairment"><AlertTriangle/> {actorSeat?.number}号已{actorSeat?.statuses.includes('poisoned') ? '中毒' : '醉酒'}：照常唤醒并记录选择，但能力无效</div>}
        <NightTargetPicker step={step} selected={selected} seats={seats} roles={roles} targets={targets[step.id] ?? []} onChange={(index,seatNumber) => onTargetChange(step,index,seatNumber)}/>
        {assignedRole && <span id={`night-ability-${step.id}`} role="tooltip" className="night-list-ability-card">
          <span className="seat-ability-heading"><RoleIcon role={assignedRole}/><span><b>{assignedRole.name}</b><small>{alignmentMeta[assignedRole.alignment].short} · {assignedRole.timing ?? '被动'}</small></span></span>
          <span className="seat-ability-text">{assignedRole.ability}</span>
          {assignedRole.setup && <span className="seat-ability-setup">配置：{assignedRole.setup}</span>}
        </span>}
      </li>;
    })}</ol>
  </section>;
}

function NightFocus({ title, steps, selected, seats, roles, roleCopies, bluffs, completed, targets, onToggle, onTargetChange }: { title:string; steps:NightStep[]; selected:Set<string>; seats:Seat[]; roles:Role[]; roleCopies:Record<string,number>; bluffs:(string|null)[]; completed:Set<string>; targets:Record<string,number[]>; onToggle:(id:string) => void; onTargetChange:(step:NightStep,index:number,seatNumber:number|null) => void }) {
  const visible = visibleNightSteps(steps, selected, seats, roles);
  const currentIndex = visible.findIndex((step) => !completed.has(step.id));
  const current = currentIndex >= 0 ? visible[currentIndex] : undefined;
  if (!current) return <section className="night-focus night-focus-complete"><Check/><span className="eyebrow">{title}</span><h3>本轮夜序已完成</h3><p>所有需要处理的角色都已标记完成。</p></section>;
  const assignedRole = nightActorRole(current,selected,roles);
  const seatLabel = nightStepSeatLabel(current,selected,seats,roles,roleCopies);
  const actorSeat = nightActorSeat(current,selected,seats,roles);
  const impaired = actorSeat?.statuses.includes('poisoned') || actorSeat?.statuses.includes('drunk');
  const detail = nightStepDetail(current, selected, roles, bluffs);
  return <section className="night-focus">
    <header><span>{String(currentIndex + 1).padStart(2,'0')} / {String(visible.length).padStart(2,'0')}</span><b>{title}</b></header>
    <div className="night-focus-role">{assignedRole ? <RoleIcon role={assignedRole}/> : <span className="night-focus-system"><Moon/></span>}<div><small>{current.phase}</small><h3>{current.name}</h3>{assignedRole && <span>{alignmentMeta[assignedRole.alignment].short}</span>}</div>{seatLabel && <div className={`night-focus-seat ${seatLabel.alignment ? `night-focus-seat-${seatLabel.alignment}` : ''}`}><small>对应玩家</small><strong>{seatLabel.text}</strong></div>}</div>
    {assignedRole && <div className="night-focus-block"><small>角色能力</small><p>{assignedRole.ability}</p></div>}
    {impaired && <div className="night-focus-impaired"><AlertTriangle/><div><strong>{actorSeat?.number}号已{actorSeat?.statuses.includes('poisoned') ? '中毒' : '醉酒'}</strong><span>照常唤醒并让玩家操作，但本次能力不会产生效果。</span></div></div>}
    <div className="night-focus-block is-action"><small>本步提示</small><p>{detail}</p></div>
    <NightTargetPicker step={current} selected={selected} seats={seats} roles={roles} targets={targets[current.id] ?? []} onChange={(index,seatNumber) => onTargetChange(current,index,seatNumber)}/>
    <Button className="night-focus-next" onClick={() => onToggle(current.id)}><Check/>完成并进入下一位<ChevronRight/></Button>
    <p className="night-focus-hint">如需返回修改已完成步骤，可切换至“完整列表”。</p>
  </section>;
}

export default function BoardBuilder() {
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
  const [automaticPoisonSeat, setAutomaticPoisonSeat] = useState<number|null>(null);
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
  const [draggedLogId, setDraggedLogId] = useState<string|null>(null);
  const [dragOverLogId, setDragOverLogId] = useState<string|null>(null);
  const draggedLogIdRef = useRef<string|null>(null);
  const dragOverLogIdRef = useRef<string|null>(null);
  const script = scripts.find((item) => item.id === scriptId) ?? scripts[0];
  const baseQuota = script.counts[playerCount];
  const activeSetupModifiers = useMemo(() => setupModifiers(script.roles,selected,setupChoices), [script.roles,selected,setupChoices]);
  const quota = useMemo(() => withSetupAdjustments(baseQuota,script.roles, selected,setupChoices), [baseQuota,script.roles,selected,setupChoices]);
  const selectedRoles = script.roles.filter((role) => selected.has(role.id));
  const selectedRoleInstances = useMemo(() => selectedRoles.flatMap((role) => Array.from({ length:Math.max(1,roleCopies[role.id] ?? 1) }, () => role)),[roleCopies,selectedRoles]);
  const drunkRole = script.roles.find((role) => role.id === 'drunk');
  const drunkFakeOptions = script.roles.filter((role) => role.alignment === 'townsfolk' && !selected.has(role.id) && !demonBluffs.includes(role.id));
  const availableBluffs = script.roles.filter((role) => (role.alignment === 'townsfolk' || (quota.outsider > 0 && role.alignment === 'outsider')) && !selected.has(role.id) && role.id !== drunkFakeRoleId);
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
      setAbilityTargets(restoredTargets); setAutomaticPoisonSeat(Number.isInteger(saved.automaticPoisonSeat) && saved.automaticPoisonSeat! >= 1 && saved.automaticPoisonSeat! <= savedCount ? saved.automaticPoisonSeat! : null);
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
      return true;
    };
    const load = () => {
      let localState: Partial<SavedGameState>|null = null;
      try {
        const raw = window.localStorage?.getItem(localGameKey);
        if (raw) localState = JSON.parse(raw) as Partial<SavedGameState>;
      } catch { window.localStorage?.removeItem(localGameKey); }
      if (localState) restore(localState);
      if (!cancelled) setHistoryReady(true);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!historyReady) return;
    const timer = window.setTimeout(() => {
      const state: SavedGameState = { version:8, savedAt:Date.now(), scriptId, playerCount, selected:[...selected], locked:[...locked], roleCopies, setupChoices, view, seats, activeSeat, nightMode, nightFocusMode, completedSteps:[...completedSteps], abilityTargets, automaticPoisonSeat, gameStarted, gamePhase, dayNumber, gameLog, demonBluffs, ringRotation, drunkFakeRoleId, announcedDeadSeats:[...announcedDeadSeats], lastDawnDeadSeats:narrationSeats, openingStyle };
      try { window.localStorage?.setItem(localGameKey,JSON.stringify(state)); } catch { /* Storage may be unavailable in private browsing. */ }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [abilityTargets, activeSeat, announcedDeadSeats, automaticPoisonSeat, completedSteps, dayNumber, demonBluffs, drunkFakeRoleId, gameLog, gamePhase, gameStarted, historyReady, locked, narrationSeats, nightFocusMode, nightMode, openingStyle, playerCount, ringRotation, roleCopies, scriptId, seats, selected, setupChoices, view]);

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
    activeSetupModifiers.forEach((modifier) => result.push({ type:'ok', text:`已应用${modifier.label.replace('：','配置：')}。` }));
    if (selected.has('marionette')) result.push({ type:'info', text:'提线木偶需要与恶魔邻座，安排座位时请检查。' });
    if (selected.has('vortox')) result.push({ type:'warn', text:'涡流在场：所有镇民信息必须错误，而且每天必须有人被处决。' });
    if (selected.has('no-dashii')) result.push({ type:'info', text:'诺-达鲺在场：安排或换位后，重新检查其两侧最近的镇民并标记中毒。' });
    const assignedCount = seats.filter((seat) => seat.roleId).length;
    if (assignedCount && assignedCount < playerCount) result.push({ type:'info', text:`座位身份已分配 ${assignedCount}/${playerCount}。` });
    return result;
  }, [activeSetupModifiers, drunkFakeRoleId, playerCount, quota, script.roles, seats, selected, selectedRoles, totals]);

  function addLog(kind: LogKind, title: string, detail?: string, phase = gamePhase, day = dayNumber) {
    const createdAt = Date.now();
    setGameLog((current) => [...current, { id:`${createdAt}-${Math.random().toString(36).slice(2,8)}`, dayNumber:day, phase, kind, title, detail, createdAt }]);
  }
  function resetRoundState() { setSeats(makeSeats(playerCount)); setActiveSeat(1); setCompletedSteps(new Set()); setAbilityTargets({}); setAutomaticPoisonSeat(null); setGameStarted(false); setGamePhase('firstNight'); setDayNumber(1); setGameLog([]); setAnnouncedDeadSeats(new Set()); setNarrationSeats([]); }
  function toggleRole(role: Role) {
    if (locked.has(role.id)) return;
    const removing = selected.has(role.id);
    setSelected((current) => { const next = new Set(current); next.has(role.id) ? next.delete(role.id) : next.add(role.id); return next; });
    setRoleCopies((current) => { const next = { ...current }; if (removing) delete next[role.id]; else next[role.id] = 1; return next; });
    if (!removing && role.setupRules?.outsiderDelta) setSetupChoices((current) => ({ ...current, [role.id]:role.setupRules!.outsiderDelta!.default }));
    setSeats((current) => current.map((seat) => seat.roleId === role.id ? { ...seat, roleId:null } : seat));
    setCompletedSteps(new Set());
  }
  function toggleLock(role: Role) {
    setLocked((current) => { const next = new Set(current); next.has(role.id) ? next.delete(role.id) : next.add(role.id); return next; });
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
    const addToAlignment = (alignment: Alignment, target: number) => {
      const candidates = script.roles.filter((role) => role.alignment === alignment && !next.has(role.id));
      const pool = random ? shuffled(candidates) : candidates;
      pool.slice(0, Math.max(0, target - alignmentCount(alignment))).forEach((role) => { next.add(role.id); nextCopies[role.id] = 1; });
    };

    alignments.forEach((alignment) => addToAlignment(alignment,baseQuota[alignment]));
    const targetQuota = withSetupAdjustments(baseQuota,script.roles,next,setupChoices);
    alignments.forEach((alignment) => {
      const removable = (random ? shuffled(script.roles) : [...script.roles]).filter((role) => role.alignment === alignment && next.has(role.id) && !locked.has(role.id) && !role.setupRules?.outsiderDelta);
      while (alignmentCount(alignment) > targetQuota[alignment] && removable.length) { const role = removable.pop()!; next.delete(role.id); delete nextCopies[role.id]; }
      addToAlignment(alignment,targetQuota[alignment]);
    });
    const bluffPool = script.roles.filter((role) => (role.alignment === 'townsfolk' || (targetQuota.outsider > 0 && role.alignment === 'outsider')) && !next.has(role.id));
    setDrunkFakeRoleId(null); setSelected(next); setRoleCopies(nextCopies); setDemonBluffs(shuffled(bluffPool).slice(0,3).map((role) => role.id)); setSeats(makeSeats(playerCount)); setCompletedSteps(new Set()); setAbilityTargets({}); setAutomaticPoisonSeat(null);
  }
  function changePlayerCount(count: number) {
    setPlayerCount(count);
    setSeats((current) => Array.from({ length:count }, (_, index) => current[index] ? { ...current[index], number:index + 1 } : { number:index + 1, roleId:null, alive:true, statuses:[] }));
    setActiveSeat((current) => Math.min(current, count));
    setAnnouncedDeadSeats((current) => new Set([...current].filter((seat) => seat <= count)));
    setCompletedSteps(new Set()); setAbilityTargets((current) => Object.fromEntries(Object.entries(current).map(([key,values]) => [key,values.filter((value) => value <= count)]))); setAutomaticPoisonSeat((current) => current && current <= count ? current : null);
  }
  function changeScript(id: string) {
    setScriptId(id); setSelected(new Set()); setLocked(new Set()); setRoleCopies({}); setSetupChoices({}); setDemonBluffs([null,null,null]); setDrunkFakeRoleId(null); setSeats(makeSeats(playerCount)); setActiveSeat(1); setCompletedSteps(new Set()); setAbilityTargets({}); setAutomaticPoisonSeat(null); setGameStarted(false); setGamePhase('firstNight'); setDayNumber(1); setGameLog([]); setAnnouncedDeadSeats(new Set()); setNarrationSeats([]); setRingRotation(0); setView('roles');
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
    setAbilityTargets({}); setAutomaticPoisonSeat(null);
  }
  function swapSeats(from: number, to: number) {
    if (from === to) return;
    const fromSeat = seats.find((seat) => seat.number === from);
    const toSeat = seats.find((seat) => seat.number === to);
    if (!fromSeat || !toSeat) return;
    setSeats((current) => current.map((seat) => seat.number === from ? { ...toSeat, number:from } : seat.number === to ? { ...fromSeat, number:to } : seat));
    setActiveSeat(to);
    if (gameStarted) {
      const fromRole = script.roles.find((role) => role.id === fromSeat.roleId)?.name ?? '未分配';
      const toRole = script.roles.find((role) => role.id === toSeat.roleId)?.name ?? '未分配';
      addLog('role',`${from}号与${to}号交换座位`,`${fromRole} ↔ ${toRole}`);
    }
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
    setCompletedSteps((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
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
    const actorRole = nightActorRole(step,selected,script.roles);
    const actorSeat = actorRole ? seats.find((seat) => seat.roleId === actorRole.id) : undefined;
    const actorImpaired = actorSeat?.statuses.includes('poisoned') || actorSeat?.statuses.includes('drunk');
    const targetSeat = seatNumber ? seats.find((seat) => seat.number === seatNumber) : undefined;
    const targetRole = script.roles.find((role) => role.id === targetSeat?.roleId);
    const phase: GamePhase = nightMode === 'first' ? 'firstNight' : 'night';
    if (!gameStarted) {
      setGameStarted(true); setGamePhase(phase); setDayNumber(1);
      addLog('system','游戏开始',`进入${phaseName(phase,1)}`,phase,1);
    }
    if (seatNumber) addLog('night',`${actorRole?.name ?? step.name}发动技能`,`选择 ${seatNumber} 号玩家 · ${targetRole?.name ?? '身份未分配'}`,phase,gameStarted ? dayNumber : 1);
    else if (previous) addLog('night',`${actorRole?.name ?? step.name}清除技能目标`,`${previous}号玩家`,phase,gameStarted ? dayNumber : 1);
    if (seatNumber && actorImpaired) addLog('status',`${actorSeat?.number}号能力未生效`,`因${actorSeat?.statuses.includes('poisoned') ? '中毒' : '醉酒'}，${actorRole?.name ?? step.name}的本次选择只记录、不结算`,phase,gameStarted ? dayNumber : 1);

    if (actorRole?.id === 'poisoner' && !actorImpaired) {
      setSeats((current) => current.map((seat) => {
        const statuses = new Set(seat.statuses);
        if (seat.number === automaticPoisonSeat && seat.number !== seatNumber) statuses.delete('poisoned');
        if (seat.number === seatNumber) statuses.add('poisoned');
        return { ...seat, statuses:[...statuses] };
      }));
      setAutomaticPoisonSeat(seatNumber);
      if (seatNumber) addLog('status',`${seatNumber}号被投毒`,`${targetRole?.name ?? '身份未分配'}：本夜及明天白天能力无效`,phase,gameStarted ? dayNumber : 1);
    }

    if (actorRole?.id === 'snake-charmer' && !actorImpaired && actorSeat && targetSeat && targetRole?.alignment === 'demon' && actorSeat.number !== targetSeat.number) {
      setSeats((current) => current.map((seat) => {
        if (seat.number === actorSeat.number) return { ...seat, roleId:targetSeat.roleId };
        if (seat.number === targetSeat.number) return { ...seat, roleId:actorSeat.roleId, statuses:[...new Set([...seat.statuses,'poisoned' as SeatStatus])] };
        return seat;
      }));
      addLog('role',`舞蛇人命中恶魔，${actorSeat.number}号与${targetSeat.number}号交换身份`,`${actorSeat.number}号成为${targetRole.name}；${targetSeat.number}号成为舞蛇人并中毒`,phase,gameStarted ? dayNumber : 1);
    }
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
    setGamePhase(nextPhase); setDayNumber(nextDay); setNightMode(nextPhase === 'firstNight' ? 'first' : 'other'); setCompletedSteps(new Set()); setAbilityTargets({}); setQuickLinesOpen(false);
    if (nextPhase === 'day') {
      const deadSeats = seats.filter((seat) => !seat.alive).map((seat) => seat.number);
      setNarrationSeats(deadSeats.filter((seat) => !announcedDeadSeats.has(seat)));
      setAnnouncedDeadSeats(new Set(deadSeats));
      setNarrationScene('dawn');
    } else {
      setAnnouncedDeadSeats(new Set(seats.filter((seat) => !seat.alive).map((seat) => seat.number)));
      setNarrationScene('nightfall');
    }
    if (gamePhase === 'day' && automaticPoisonSeat) {
      setSeats((current) => current.map((seat) => seat.number === automaticPoisonSeat ? { ...seat, statuses:seat.statuses.filter((status) => status !== 'poisoned') } : seat));
      setAutomaticPoisonSeat(null);
    }
    addLog('system',`进入${phaseName(nextPhase,nextDay)}`,undefined,nextPhase,nextDay);
  }
  function clearHistory() {
    if (!gameLog.length || window.confirm(`清空${phaseName(gamePhase,dayNumber)}及之前的全部日志？当前阶段不会改变。`)) setGameLog([]);
  }
  function resetCurrentGame() {
    if (!window.confirm('重置本局？将清空日志、死亡状态、状态标记和夜间进度，但保留当前配板及座位身份。')) return;
    setSeats((current) => current.map((seat) => ({ ...seat, alive:true, statuses:[] })));
    setCompletedSteps(new Set());
    setAbilityTargets({});
    setAutomaticPoisonSeat(null);
    setGameStarted(false);
    setGamePhase('firstNight');
    setDayNumber(1);
    setNightMode('first');
    setGameLog([]);
    setManualNote('');
    setAnnouncedDeadSeats(new Set());
    setNarrationSeats([]);
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

  function playBell() {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?:typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const now = context.currentTime;
    [220,440,660,880].forEach((frequency,index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(index ? .09 / index : .2,now);
      gain.gain.exponentialRampToValueAtTime(.001,now + 2.8);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + index * .015); oscillator.stop(now + 2.9);
    });
    window.setTimeout(() => void context.close(),3100);
  }
  function playRooster() {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?:typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const now = context.currentTime;
    [[0,.34,650,940],[.38,.32,600,880],[.78,.72,720,430]].forEach(([delay,duration,start,end]) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(start,now + delay);
      oscillator.frequency.exponentialRampToValueAtTime(end,now + delay + duration);
      gain.gain.setValueAtTime(.001,now + delay);
      gain.gain.exponentialRampToValueAtTime(.12,now + delay + .04);
      gain.gain.exponentialRampToValueAtTime(.001,now + delay + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + delay); oscillator.stop(now + delay + duration);
    });
    window.setTimeout(() => void context.close(),1800);
  }

  const narrationTitles: Record<NarrationScene,string> = {
    opening:'游戏开场', nightfall:'暮色入夜', dawn:'天亮破晓', discussion:'开启自由公聊', nomination:'玩家提名', silence:'无人提名', execution:'宣判处决', tie:'平票无人处决', lastWords:'遗言结束', demonReveal:'恶魔自爆', goodWin:'善良阵营胜利', evilWin:'邪恶阵营胜利',
  };
  const narrationBody = narrationScene === 'opening'
    ? (openingStyle === 'long' ? narrationText.opening : shortOpening)
    : narrationScene === 'dawn'
      ? narrationSeats.length
        ? `五更天晓，雄鸡啼鸣，漫漫长夜尽数落幕！诸位，睁眼细看！怎料昨夜灾祸降临，${narrationSeats.map((seat) => `${seat} 号`).join('、')}乡民不幸殒命。`
        : '天光破晓，钟声驱散迷雾。诸位睁眼！可喜昨夜小镇安然无恙，不曾有人殒命。可诸位万万不可松懈，邪魔依旧藏在人群之内。'
      : narrationScene === 'execution'
        ? `一番唇枪舌战辩驳完毕，投票尘埃落定！且看票堆高悬，${narrationSeat} 号玩家被全镇乡民判以极刑！\n\n唉，世事难料，此人就此身死。虽已殒命，仍可留下遗言陈述。`
        : narrationScene ? narrationText[narrationScene] : '';
  const dawnText = narrationSeats.length
    ? `五更天晓，雄鸡啼鸣，漫漫长夜尽数落幕！诸位，睁眼细看！怎料昨夜灾祸降临，${narrationSeats.map((seat) => `${seat} 号`).join('、')}乡民不幸殒命。`
    : '天光破晓，钟声驱散迷雾。诸位睁眼！可喜昨夜小镇安然无恙，不曾有人殒命。可诸位万万不可松懈，邪魔依旧藏在人群之内。';
  const currentStageNarration = !gameStarted || gamePhase === 'firstNight'
    ? (openingStyle === 'long' ? narrationText.opening : shortOpening)
    : gamePhase === 'day' ? dawnText : narrationText.nightfall;
  const currentStageCueTitle = !gameStarted ? '游戏开场' : gamePhase === 'firstNight' ? '第1夜 · 游戏开场' : gamePhase === 'day' ? `${phaseName(gamePhase,dayNumber)} · 天亮破晓` : `${phaseName(gamePhase,dayNumber)} · 暮色入夜`;

  if (!historyReady) return <main className="game-restoring"><span className="brand-mark"><img src={publicAsset('/brand-mark.svg')} alt=""/></span><p>正在恢复本局…</p></main>;

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand-mark"><img src={publicAsset('/brand-mark.svg')} alt="说书人配板台徽标"/></div><div className="brand-copy"><p>STORYTELLER DESK</p><h1>说书人配板台</h1></div>
      <div className="header-controls">
        <label><span>板子 / 剧本</span><NativeSelect value={scriptId} onChange={(event) => changeScript(event.target.value)} aria-label="选择剧本">{scripts.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect></label>
        <label><span>玩家人数</span><NativeSelect value={playerCount} onChange={(event) => changePlayerCount(Number(event.target.value))} aria-label="玩家人数">{Object.keys(script.counts).map((count) => <NativeSelectOption key={count} value={count}>{count} 人</NativeSelectOption>)}</NativeSelect></label>
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
        {view !== 'roles' && <section className={`phase-bar ${gameStarted ? 'is-running' : ''}`}><div><span className="phase-dot"/><p><small>当前阶段</small><strong>{gameStarted ? phaseName(gamePhase,dayNumber) : '尚未开始记录'}</strong></p></div>{gameStarted ? <Button onClick={advancePhase}>进入下一阶段<ChevronRight/></Button> : <Button onClick={startGame}><Play/>开始记录</Button>}{gameStarted && view !== 'seats' && <Button className="narration-shortcut" variant="outline" onClick={() => setQuickLinesOpen((open) => !open)}><Volume2/>台词提示</Button>}<button className="log-shortcut" onClick={() => setView('history')}><BookOpen/><span>{gameLog.length} 条记录</span></button><Button className="reset-game-button" variant="outline" onClick={resetCurrentGame}><RotateCcw/>重置本局</Button></section>}
        {view !== 'roles' && view !== 'seats' && quickLinesOpen && <section className="quick-lines" aria-label="临场旁白">
          <div><span><b>台词提示</b><small>夜晚也可查看；选择一条后本面板保持展开</small></span><button onClick={() => setQuickLinesOpen(false)} aria-label="关闭台词提示"><X/></button></div>
          <nav>{([
            [gamePhase === 'day' ? 'dawn' : gamePhase === 'firstNight' ? 'opening' : 'nightfall','当前阶段'],['discussion','开启公聊'],['nomination','玩家提名'],['silence','无人提名'],['execution','宣判处决'],['tie','平票无人处决'],['lastWords','遗言结束'],['demonReveal','恶魔自爆'],['goodWin','好人胜利'],['evilWin','邪恶胜利'],
          ] as [NarrationScene,string][]).map(([scene,label]) => <button key={`${scene}-${label}`} onClick={() => { if (scene === 'execution') setNarrationSeat(activeSeat); setNarrationScene(scene); }}>{label}</button>)}</nav>
        </section>}

        {view === 'roles' && <>
          <div className="quota-strip"><span className="quota-title"><Users size={16}/>{playerCount} 人{activeSetupModifiers.length ? '调整后' : '标准'}名额</span>{alignments.map((alignment) => <span key={alignment} className={`quota quota-${alignment}`}>{alignmentMeta[alignment].short}<b>{quota[alignment]}</b></span>)}{activeSetupModifiers.map((modifier) => <span key={modifier.id} className="quota-modifier">{modifier.label}</span>)}</div>
          {!!script.specialRules?.length && <div className="special-rule-strip">{script.specialRules.map((rule) => <span key={rule.name}><CircleHelp/><b>{rule.name}</b>{rule.description}</span>)}</div>}
          <div className="role-builder-layout">
            <Tabs defaultValue="townsfolk" className="role-tabs">
              <TabsList className="alignment-tabs" aria-label="按阵营浏览角色">{alignments.map((alignment) => <TabsTrigger key={alignment} value={alignment}>{alignmentMeta[alignment].short}<span>{script.roles.filter((role) => role.alignment === alignment).length}</span></TabsTrigger>)}</TabsList>
              {alignments.map((alignment) => <TabsContent key={alignment} value={alignment}><div className="section-title"><h3>{alignmentMeta[alignment].label}</h3><p>勾选加入当前配板，锁定后随机配板会保留该角色。</p></div><div className="role-grid">{script.roles.filter((role) => role.alignment === alignment).map((role) => <RoleCard key={role.id} role={role} selected={selected.has(role.id)} locked={locked.has(role.id)} copies={Math.max(1,roleCopies[role.id] ?? 1)} setupChoice={setupChoices[role.id]} onSelect={() => toggleRole(role)} onLock={() => toggleLock(role)} onCopiesChange={(count) => changeRoleCopies(role,count)} onSetupChoiceChange={(value) => changeSetupChoice(role,value)}/>)}</div></TabsContent>)}
            </Tabs>
            <aside className="board-panel">
              <div className="board-heading"><div><span className="eyebrow">LIVE BOARD</span><h2>当前配板</h2></div><span className="total-count">{selectedRoleInstances.length}<small>/{playerCount}</small></span></div>
              <div className="board-actions"><Button className="random-board" onClick={() => buildBoard(true)}><Dice5/>随机配板</Button><Button variant="outline" onClick={() => buildBoard(false)}><Sparkles/>按名额补齐</Button><Button variant="outline" onClick={() => { setSelected(new Set(locked)); setRoleCopies(Object.fromEntries([...locked].map((id) => [id,Math.max(1,roleCopies[id] ?? 1)]))); resetRoundState(); }}><RotateCcw/>清空未锁定</Button></div>
              {selected.has('drunk') && drunkRole && <section className="drunk-fake-role"><div className="drunk-fake-heading"><RoleIcon role={drunkRole}/><span><b>酒鬼的假身份</b><small>自动从不在场镇民中选择，并避开恶魔伪装</small></span><button onClick={randomizeDrunkFakeRole} disabled={!drunkFakeOptions.length}><Shuffle/>换一个</button></div><NativeSelect value={drunkFakeRoleId ?? ''} onChange={(event) => setDrunkFakeRoleId(event.target.value || null)} aria-label="酒鬼的假身份"><NativeSelectOption value="">暂无可用镇民</NativeSelectOption>{drunkFakeOptions.map((role) => <NativeSelectOption key={role.id} value={role.id}>{role.name}</NativeSelectOption>)}</NativeSelect></section>}
              <section className="demon-bluffs"><div className="bluff-heading"><div><EyeOff/><span><b>给恶魔的三个伪装</b><small>按当前阵营名额筛选不在场身份；外来者名额为 0 时只提供镇民</small></span></div><button onClick={randomizeBluffs} disabled={!selectedRoles.some((role) => role.alignment === 'demon') || availableBluffs.length < 3}><Shuffle/>随机准备</button></div>
                {selectedRoles.some((role) => role.alignment === 'demon') ? <div className="bluff-slots">{demonBluffs.map((roleId,index) => {
                  const role = script.roles.find((item) => item.id === roleId);
                  const options = availableBluffs.filter((item) => !demonBluffs.includes(item.id) || item.id === roleId);
                  return <label className="bluff-slot" key={index}><span>{role ? <RoleIcon role={role}/> : <b>{index + 1}</b>}</span><NativeSelect value={roleId ?? ''} onChange={(event) => setBluff(index,event.target.value || null)} aria-label={`说书人准备的第${index + 1}个伪装`}><NativeSelectOption value="">说书人选择</NativeSelectOption>{options.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name} · {alignmentMeta[item.alignment].short}</NativeSelectOption>)}</NativeSelect></label>;
                })}</div> : <p className="bluff-empty">选入恶魔后，由说书人在这里准备身份；随机配板会自动准备三个不在场的善良角色。</p>}
              </section>
              <div className="selected-groups">{alignments.map((alignment) => <section key={alignment} className={`selected-group group-${alignment}`}><div><span>{alignmentMeta[alignment].short}</span><b>{totals[alignment]} / {quota[alignment]}</b></div><ul>{selectedRoles.filter((role) => role.alignment === alignment).map((role) => <li key={role.id}><RoleIcon role={role} className="mini-role-icon"/>{role.name}{(roleCopies[role.id] ?? 1) > 1 && <b>×{roleCopies[role.id]}</b>}{locked.has(role.id) && <Lock size={11}/>}</li>)}</ul>{!totals[alignment] && <p>尚未选择</p>}</section>)}</div>
              <section className="validation"><h3><ShieldCheck size={17}/>基础校验</h3><div className="message-list">{messages.map((message,index) => <div key={`${message.text}-${index}`} className={`message message-${message.type}`}>{message.type === 'warn' ? <AlertTriangle size={15}/> : message.type === 'ok' ? <Check size={15}/> : <CircleHelp size={15}/>}<span>{message.text}</span></div>)}</div></section>
            </aside>
          </div>
        </>}

        {view === 'seats' && <section className="seat-workspace">
          <section className={`stage-cue-panel cue-${gamePhase}`} aria-label="当前阶段台词">
            <header><div><span>当前阶段台词</span><h3>{currentStageCueTitle}</h3></div><div className="stage-cue-sound">{gamePhase === 'day' ? <Button variant="outline" onClick={playRooster}><Volume2/>鸡鸣</Button> : <Button variant="outline" onClick={playBell}><Bell/>钟声</Button>}</div></header>
            {(!gameStarted || gamePhase === 'firstNight') && <div className="stage-cue-options"><button className={openingStyle === 'long' ? 'is-active' : ''} onClick={() => setOpeningStyle('long')}>悬疑长篇</button><button className={openingStyle === 'short' ? 'is-active' : ''} onClick={() => setOpeningStyle('short')}>精简版</button></div>}
            <p>{currentStageNarration}</p>
            <footer><span>临场台词</span><div>{([
              ['discussion','开启公聊'],['nomination','玩家提名'],['silence','无人提名'],['execution','宣判处决'],['tie','平票'],['lastWords','遗言结束'],['demonReveal','恶魔自爆'],['goodWin','好人胜利'],['evilWin','邪恶胜利'],
            ] as [NarrationScene,string][]).map(([scene,label]) => <button key={scene} onClick={() => { if (scene === 'execution') setNarrationSeat(activeSeat); setNarrationScene(scene); }}>{label}</button>)}</div></footer>
          </section>
          <div className="view-heading"><div><span className="eyebrow">GRIMOIRE SEATS</span><h3>环形座位魔典</h3><p>拖动圆桌空白处旋转视角；拖动座位卡到另一张卡可交换双方状态。</p></div><div><Button onClick={randomizeSeats} disabled={!selectedRoleInstances.length}><Shuffle/>随机入座</Button><Button variant="outline" onClick={() => setRingRotation(0)} disabled={Math.abs(ringRotation) < 0.5}><RotateCcw/>方向归零</Button><Button variant="outline" onClick={() => setSeats(makeSeats(playerCount))}><Trash2/>清空座位</Button></div></div>
          <SeatMap seats={seats} roles={script.roles} activeSeat={activeSeat} targetMarks={targetMarks} rotation={ringRotation} drunkFakeRoleId={drunkFakeRoleId} onRotationChange={setRingRotation} onSelect={setActiveSeat} onSwap={swapSeats}/>
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
            ? <NightFocus title={nightMode === 'first' ? '首个夜晚' : '其他夜晚'} steps={script.nightOrder[nightMode]} selected={selected} seats={seats} roles={script.roles} roleCopies={roleCopies} bluffs={demonBluffs} completed={completedSteps} targets={abilityTargets} onToggle={toggleNightStep} onTargetChange={changeNightTarget}/>
            : <NightList title={nightMode === 'first' ? '首个夜晚' : '其他夜晚'} steps={script.nightOrder[nightMode]} selected={selected} seats={seats} roles={script.roles} roleCopies={roleCopies} bluffs={demonBluffs} completed={completedSteps} targets={abilityTargets} onToggle={toggleNightStep} onTargetChange={changeNightTarget}/>}
          <p className="night-footnote">提示：中毒、醉酒、角色变化及自定义能力可能改变实际处理方式，说书人应结合当前场况判断。</p>
        </section>}

        {view === 'history' && <section className="history-workspace">
          <div className="view-heading"><div><span className="eyebrow">GAME REVIEW</span><h3>对局日志与复盘</h3><p>关键操作自动记录，也可以随时补充说书人备注。</p></div>{gameLog.length > 0 && <Button variant="outline" onClick={clearHistory}><Trash2/>清空日志</Button>}</div>
          <form className="quick-note" onSubmit={(event) => { event.preventDefault(); submitManualNote(); }}><Input value={manualNote} onChange={(event) => setManualNote(event.target.value)} placeholder="记录提名、处决、能力结果或其他关键事件…" aria-label="对局备注"/><Button type="submit" disabled={!manualNote.trim()}><Plus/>添加记录</Button></form>
          <div className="history-timeline">{gameLog.length ? gameLog.map((entry,index) => {
            const previous = gameLog[index - 1];
            const showPhase = !previous || previous.phase !== entry.phase || previous.dayNumber !== entry.dayNumber;
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
              onPointerCancel={() => { draggedLogIdRef.current = null; dragOverLogIdRef.current = null; setDraggedLogId(null); setDragOverLogId(null); }}><GripVertical/></button><span className="log-mark"/><div><strong>{entry.title}</strong>{entry.detail && <p>{entry.detail}</p>}</div><time>{new Date(entry.createdAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</time><button className="log-delete" onClick={() => setGameLog((current) => current.filter((item) => item.id !== entry.id))} aria-label={`删除记录：${entry.title}`}><Trash2/></button></article></div>;
          }) : <div className="history-empty"><BookOpen/><h4>当前没有日志</h4><p>{gameStarted ? `仍处于${phaseName(gamePhase,dayNumber)}；之后的新记录会继续归入这个阶段。` : '点击上方“开始记录”，死亡、状态变化和夜间步骤会自动出现在这里。'}</p></div>}</div>
        </section>}
      </div>

    </section>
    {narrationScene && <div className="narration-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setNarrationScene(null); }}>
      <section className={`narration-card narration-${narrationScene}`} role="dialog" aria-modal="true" aria-labelledby="narration-title">
        <header><div><span>STORYTELLER CUE</span><h2 id="narration-title">{narrationTitles[narrationScene]}</h2></div><button onClick={() => setNarrationScene(null)} aria-label="关闭旁白"><X/></button></header>
        {narrationScene === 'opening' && <div className="narration-options"><button className={openingStyle === 'long' ? 'is-active' : ''} onClick={() => setOpeningStyle('long')}>悬疑长篇</button><button className={openingStyle === 'short' ? 'is-active' : ''} onClick={() => setOpeningStyle('short')}>精简快节奏</button></div>}
        {narrationScene === 'execution' && <label className="narration-seat-picker"><span>被处决玩家</span><NativeSelect value={narrationSeat} onChange={(event) => setNarrationSeat(Number(event.target.value))} aria-label="被处决玩家座位">{seats.map((seat) => <NativeSelectOption key={seat.number} value={seat.number}>{seat.number} 号{seat.roleId ? ` · ${script.roles.find((role) => role.id === seat.roleId)?.name ?? ''}` : ''}</NativeSelectOption>)}</NativeSelect></label>}
        <div className="narration-copy">{narrationBody.split('\n').map((line,index) => line ? <p key={index}>{line}</p> : <span key={index}/>)}</div>
        <p className="narration-rule">只照读座位号，不补充或推测死亡原因。</p>
        <footer>
          {(narrationScene === 'opening' || narrationScene === 'nightfall' || narrationScene === 'lastWords' || narrationScene === 'demonReveal') && <Button variant="outline" onClick={playBell}><Bell/>播放钟声</Button>}
          {narrationScene === 'dawn' && <Button variant="outline" onClick={playRooster}><Volume2/>播放鸡鸣</Button>}
          {narrationScene === 'dawn' && <Button onClick={() => setNarrationScene('discussion')}>接着开启公聊<ChevronRight/></Button>}
          <Button onClick={() => setNarrationScene(null)}>读完，关闭</Button>
        </footer>
      </section>
    </div>}
  </main>;
}
