'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, CircleHelp, Lock, RotateCcw, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { alignmentMeta, scripts, type Alignment, type Role } from '@/app/data/scripts';

const alignments: Alignment[] = ['townsfolk', 'outsider', 'minion', 'demon'];

function RoleCard({ role, selected, locked, onSelect, onLock }: { role: Role; selected: boolean; locked: boolean; onSelect: () => void; onLock: () => void }) {
  return <article className={`role-card role-${role.alignment} ${selected ? 'is-selected' : ''}`}>
    <div className="role-topline">
      <Checkbox checked={selected} onCheckedChange={onSelect} aria-label={`选择${role.name}`} />
      <button className="role-name" onClick={onSelect}>{role.name}</button>
      <span className="timing">{role.timing}</span>
      <button className={`lock-button ${locked ? 'is-locked' : ''}`} onClick={onLock} aria-label={`${locked ? '取消锁定' : '锁定'}${role.name}`} title={locked ? '取消锁定' : '锁定角色'}><Lock size={14}/></button>
    </div>
    <p>{role.ability}</p>
    <div className="role-foot">
      {role.setup && <span className="setup">配置：{role.setup}</span>}
      {role.note && <span className="data-note"><CircleHelp size={12}/>{role.note}</span>}
    </div>
  </article>;
}

export default function BoardBuilder() {
  const [scriptId, setScriptId] = useState(scripts[0].id);
  const [playerCount, setPlayerCount] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const script = scripts.find((item) => item.id === scriptId) ?? scripts[0];
  const quota = script.counts[playerCount];
  const selectedRoles = script.roles.filter((role) => selected.has(role.id));
  const totals = useMemo(() => Object.fromEntries(alignments.map((a) => [a, selectedRoles.filter((r) => r.alignment === a).length])) as Record<Alignment, number>, [selectedRoles]);

  const messages = useMemo(() => {
    const result: { type: 'ok'|'warn'|'info'; text: string }[] = [];
    const mismatches = alignments.filter((a) => totals[a] !== quota[a]);
    result.push(!mismatches.length ? {type:'ok',text:'阵营名额已配齐，可以进入座位安排。'} : {type:'info',text:`还需调整：${mismatches.map((a) => `${alignmentMeta[a].short} ${totals[a]}/${quota[a]}`).join('、')}`});
    if (selected.has('damsel') && !selected.has('huntsman')) result.push({type:'warn',text:'落难少女在场但没有巡山人；确认这是你想要的配置。'});
    if (selected.has('atheist') && selectedRoles.some((r) => r.alignment === 'minion' || r.alignment === 'demon')) result.push({type:'warn',text:'无神论者要求没有邪恶角色在场，与当前选择冲突。'});
    if (selected.has('balloonist')) result.push({type:'info',text:'气球驾驶员可能增加 0～1 名外来者；当前名额按标准人数表计算。'});
    if (selected.has('marionette')) result.push({type:'info',text:'提线木偶需要与恶魔邻座，安排座位时请检查。'});
    return result;
  }, [quota, selected, selectedRoles, totals]);

  function toggleRole(role: Role) {
    if (locked.has(role.id)) return;
    setSelected((current) => { const next = new Set(current); next.has(role.id) ? next.delete(role.id) : next.add(role.id); return next; });
  }
  function toggleLock(role: Role) {
    setLocked((current) => { const next = new Set(current); next.has(role.id) ? next.delete(role.id) : next.add(role.id); return next; });
    setSelected((current) => new Set(current).add(role.id));
  }
  function fillByQuota() {
    const next = new Set(locked);
    for (const a of alignments) {
      const candidates = script.roles.filter((r) => r.alignment === a);
      const already = candidates.filter((r) => next.has(r.id)).length;
      candidates.filter((r) => !next.has(r.id)).slice(0, Math.max(0, quota[a] - already)).forEach((r) => next.add(r.id));
    }
    setSelected(next);
  }
  function changeScript(id: string) { setScriptId(id); setSelected(new Set()); setLocked(new Set()); }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand-mark"><span>血</span></div>
      <div className="brand-copy"><p>STORYTELLER DESK</p><h1>说书人配板台</h1></div>
      <div className="header-controls">
        <label><span>板子 / 剧本</span><NativeSelect value={scriptId} onChange={(e) => changeScript(e.target.value)} aria-label="选择剧本">{scripts.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect></label>
        <label><span>玩家人数</span><NativeSelect value={playerCount} onChange={(e) => setPlayerCount(Number(e.target.value))} aria-label="玩家人数">{Object.keys(script.counts).map((count) => <NativeSelectOption key={count} value={count}>{count} 人</NativeSelectOption>)}</NativeSelect></label>
      </div>
    </header>
    <section className="workspace">
      <div className="catalog-panel">
        <div className="script-heading"><div><span className="eyebrow">当前剧本</span><h2>{script.name}</h2><p>{script.description}</p></div><span className="author">作者 · {script.author}</span></div>
        <div className="quota-strip"><span className="quota-title"><Users size={16}/>{playerCount} 人标准名额</span>{alignments.map((a) => <span key={a} className={`quota quota-${a}`}>{alignmentMeta[a].short}<b>{quota[a]}</b></span>)}</div>
        <Tabs defaultValue="townsfolk" className="role-tabs">
          <TabsList className="alignment-tabs" aria-label="按阵营浏览角色">{alignments.map((a) => <TabsTrigger key={a} value={a}>{alignmentMeta[a].short}<span>{script.roles.filter((r) => r.alignment === a).length}</span></TabsTrigger>)}</TabsList>
          {alignments.map((a) => <TabsContent key={a} value={a}>
            <div className="section-title"><h3>{alignmentMeta[a].label}</h3><p>勾选加入当前配板，锁定后“清空未锁定”会保留该角色。</p></div>
            <div className="role-grid">{script.roles.filter((r) => r.alignment === a).map((role) => <RoleCard key={role.id} role={role} selected={selected.has(role.id)} locked={locked.has(role.id)} onSelect={() => toggleRole(role)} onLock={() => toggleLock(role)}/>)}</div>
          </TabsContent>)}
        </Tabs>
      </div>
      <aside className="board-panel">
        <div className="board-heading"><div><span className="eyebrow">LIVE BOARD</span><h2>当前配板</h2></div><span className="total-count">{selectedRoles.length}<small>/{playerCount}</small></span></div>
        <div className="board-actions"><Button onClick={fillByQuota}><Sparkles/>按名额补齐</Button><Button variant="outline" onClick={() => setSelected(new Set(locked))}><RotateCcw/>清空未锁定</Button></div>
        <div className="selected-groups">{alignments.map((a) => <section key={a} className={`selected-group group-${a}`}><div><span>{alignmentMeta[a].short}</span><b>{totals[a]} / {quota[a]}</b></div><ul>{selectedRoles.filter((r) => r.alignment === a).map((role) => <li key={role.id}>{role.name}{locked.has(role.id) && <Lock size={11}/>}</li>)}</ul>{!totals[a] && <p>尚未选择</p>}</section>)}</div>
        <section className="validation"><h3><ShieldCheck size={17}/>基础校验</h3><div className="message-list">{messages.map((message,index) => <div key={`${message.text}-${index}`} className={`message message-${message.type}`}>{message.type === 'warn' ? <AlertTriangle size={15}/> : message.type === 'ok' ? <Check size={15}/> : <CircleHelp size={15}/>}<span>{message.text}</span></div>)}</div></section>
      </aside>
    </section>
  </main>;
}
