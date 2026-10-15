'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Archive, CheckCircle2, Download, FileJson, ImagePlus, Save, SlidersHorizontal, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { alignmentMeta, scripts as builtInScripts, standardCounts, type Alignment, type AutomationEffect, type NightStep, type Role, type RoleAutomation, type ScriptDefinition } from '@/app/data/scripts';

const alignments: Alignment[] = ['townsfolk','outsider','minion','demon'];
export const backupFileType = 'storyteller-board-backup';
const timingOptions: Role['timing'][] = ['首夜','每夜','每夜*','白天','被动','一次'];
const effectOptions:{ value:AutomationEffect; label:string }[] = [
  { value:'record',label:'只记录，不自动结算' }, { value:'poisoned',label:'标记中毒' }, { value:'drunk',label:'标记醉酒' },
  { value:'protected',label:'标记受保护' }, { value:'noAbility',label:'标记失去能力' }, { value:'death',label:'标记死亡' },
  { value:'revive',label:'恢复存活' }, { value:'turnedGood',label:'标记转为善良' }, { value:'turnedEvil',label:'标记转为邪恶' },
];
const defaultAutomation = ():RoleAutomation => ({ configured:false,targetCount:0,effect:'record',expires:'manual' });
const emptyText = ():Record<Alignment,string> => ({ townsfolk:'',outsider:'',minion:'',demon:'' });
type BotcMeta = { id:'_meta'; name?:string; author?:string; firstNight?:string[]; otherNight?:string[]; bootlegger?:string[] };
type BotcRole = { id?:string; name?:string; team?:string; ability?:string; image?:string; firstNight?:number; otherNight?:number; firstNightReminder?:string; otherNightReminder?:string; setup?:boolean };

const standardRoleFallbacks:Record<string,Role> = {
  slayer:{ id:'slayer',name:'猎手',alignment:'townsfolk',timing:'一次',glyph:'猎',ability:'每局游戏限一次，在白天时，你可以公开选择一名玩家：如果他是恶魔，他死亡。' },
  mayor:{ id:'mayor',name:'镇长',alignment:'townsfolk',timing:'被动',glyph:'镇',ability:'如果只剩三名玩家存活且白天无人被处决，你的阵营获胜。如果你在夜晚死亡，可能会有另一名玩家代替你死亡。' },
  hatter:{ id:'hatter',name:'帽匠',alignment:'outsider',timing:'被动',glyph:'帽',ability:'如果你死亡，爪牙和恶魔可以选择变成新的爪牙与恶魔角色。' },
  plaguedoctor:{ id:'plaguedoctor',name:'瘟疫医生',alignment:'outsider',timing:'被动',glyph:'疫',ability:'如果你死亡，说书人会获得一个不在场爪牙的能力。' },
  baron:{ id:'baron',name:'男爵',alignment:'minion',timing:'被动',glyph:'爵',ability:'会有额外的外来者在场。',setup:'+2 外来者',setupRules:{outsiderDelta:{options:[2],default:2}} },
  scarletwoman:{ id:'scarletwoman',name:'红唇女郎',alignment:'minion',timing:'被动',glyph:'红',ability:'如果有五名或更多玩家存活且恶魔死亡，你会变成该恶魔。' },
  exorcist:{ id:'exorcist',name:'驱魔人',alignment:'townsfolk',timing:'每夜*',glyph:'驱',ability:'每个夜晚*，你要选择一名玩家（与上个夜晚不同）：如果你选中了恶魔，他会得知你的角色，但他当晚不会因其自身能力而被唤醒。' },
};
const builtInRoleCatalog = new Map<string,Role>();
for (const script of builtInScripts) for (const role of script.roles) if (!builtInRoleCatalog.has(role.id)) builtInRoleCatalog.set(role.id,role);
for (const role of Object.values(standardRoleFallbacks)) builtInRoleCatalog.set(role.id,role);
const builtInRoleNameCatalog = new Map<string,Role>();
for (const role of builtInRoleCatalog.values()) if (!builtInRoleNameCatalog.has(role.name.trim())) builtInRoleNameCatalog.set(role.name.trim(),role);

function safeId(value:string) {
  const latin = value.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  return latin || `custom-${Date.now().toString(36)}`;
}

function parseRoleLines(text:string, alignment:Alignment, scriptId:string):Role[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line,index) => {
    const [nameRaw,abilityRaw,timingRaw,setupRaw] = line.split(/[｜|\t]/).map((part) => part?.trim());
    const name = nameRaw || `${alignmentMeta[alignment].short}${index + 1}`;
    const timing = timingOptions.includes(timingRaw as Role['timing']) ? timingRaw as Role['timing'] : '被动';
    return { id:`${scriptId}-${alignment}-${index + 1}`, name, alignment, ability:abilityRaw || '能力说明待补充。', timing, setup:setupRaw || undefined, automation:defaultAutomation(), glyph:alignment === 'demon' ? '魔' : alignment === 'minion' ? '爪' : alignment === 'outsider' ? '外' : '民' };
  });
}

function buildNightOrder(roles:Role[]):ScriptDefinition['nightOrder'] {
  const toStep = (role:Role,suffix:string):NightStep => ({ id:`${role.id}-${suffix}`, name:role.name, roleId:role.id, phase:role.timing === '首夜' ? '信息' : '行动', note:role.ability });
  return {
    first:roles.filter((role) => ['首夜','每夜','每夜*'].includes(role.timing ?? '')).map((role) => toStep(role,'first')),
    other:roles.filter((role) => ['每夜','每夜*'].includes(role.timing ?? '')).map((role) => toStep(role,'other')),
  };
}

function botcTiming(role:BotcRole):Role['timing'] {
  if ((role.firstNight ?? 0) > 0 && (role.otherNight ?? 0) > 0) return '每夜';
  if ((role.firstNight ?? 0) > 0) return '首夜';
  if ((role.otherNight ?? 0) > 0) return '每夜*';
  if (/每局游戏限一次/.test(role.ability ?? '')) return '一次';
  if (/白天|公开|提名/.test(role.ability ?? '')) return '白天';
  return '被动';
}

function convertBotcScript(value:unknown):ScriptDefinition|null {
  if (!Array.isArray(value)) return null;
  const meta = value.find((item):item is BotcMeta => Boolean(item && typeof item === 'object' && (item as BotcMeta).id === '_meta'));
  if (!meta) return null;
  const objectRoles = new Map<string,BotcRole>();
  value.forEach((item) => { if (item && typeof item === 'object' && (item as BotcRole).id && (item as BotcRole).id !== '_meta') objectRoles.set((item as BotcRole).id!,item as BotcRole); });
  const roles:Role[] = [];
  const roleAliases = new Map<string,Role>();
  const seen = new Set<string>();
  for (const item of value.slice(1)) {
    const source = typeof item === 'string' ? objectRoles.get(item) : item && typeof item === 'object' ? item as BotcRole : undefined;
    const id = typeof item === 'string' ? item : source?.id;
    if (!id || id === 'bootlegger') continue;
    const existing = builtInRoleCatalog.get(id) ?? (source?.name ? builtInRoleNameCatalog.get(source.name.trim()) : undefined);
    const roleId = existing?.id ?? id;
    if (seen.has(roleId)) continue;
    const team = source?.team ?? existing?.alignment;
    if (!alignments.includes(team as Alignment)) continue;
    const role:Role = source ? {
      id:roleId,name:source.name?.trim() || existing?.name || id,alignment:team as Alignment,
      ability:source.ability?.trim() || existing?.ability || '能力说明待补充。',timing:botcTiming(source),
      image:source.image || existing?.image,glyph:source.image ? undefined : existing?.glyph,
      setup:source.setup ? '该角色会改变初始配置' : existing?.setup,setupRules:existing?.setupRules,
      automation:existing ? existing.automation : defaultAutomation(),
    } : existing ? { ...existing } : { id,name:id,alignment:'townsfolk',ability:'未能在本机角色库中找到能力说明。',timing:'被动',glyph:'?' };
    roles.push(role); seen.add(roleId); roleAliases.set(id,role);
  }
  const roleMap = new Map([...roles.map((role) => [role.id,role] as const),...roleAliases]);
  const makeOrder = (ids:string[]|undefined,mode:'first'|'other'):NightStep[] => (ids ?? []).flatMap<NightStep>((id,index):NightStep[] => {
    if (id === 'dusk' || id === 'dawn') return [];
    if (id === 'minioninfo') return [{ id:`minion-info-${mode}`,name:'爪牙信息',note:'唤醒爪牙，让其互认并确认恶魔。',phase:'信息' as const,requiredAlignment:'minion' as const }];
    if (id === 'demoninfo') return [{ id:`demon-info-${mode}`,name:'恶魔信息',note:'确认爪牙与三项不在场的善良角色。',phase:'信息' as const,requiredAlignment:'demon' as const }];
    const role = roleMap.get(id); if (!role) return [];
    const raw = objectRoles.get(id);
    const note = (mode === 'first' ? raw?.firstNightReminder : raw?.otherNightReminder) || role.ability;
    return [{ id:`${id}-${mode}-${index}`,name:role.name,note,roleId:role.id,phase:(role.alignment === 'minion' || role.alignment === 'demon') ? '行动' as const : '信息' as const }];
  });
  const specialRules = [
    ...(meta.bootlegger ?? []).map((description,index) => ({ name:`私规 ${index + 1}`,description })),
    ...value.filter((item):item is BotcRole => Boolean(item && typeof item === 'object' && (item as BotcRole).team === 'fabled')).map((item) => ({ name:item.name || '传奇角色',description:item.ability || '此剧本包含传奇角色。' })),
  ];
  const name = meta.name?.trim() || '导入剧本';
  return { id:`custom-${safeId(name)}-${Date.now().toString(36)}`,name,author:meta.author?.trim() || '自定义',description:'由标准《血染钟楼》剧本 JSON 导入。',playerRange:[7,15],counts:{ ...standardCounts },roles,specialRules:specialRules.length ? specialRules : undefined,nightOrder:{ first:makeOrder(meta.firstNight,'first'),other:makeOrder(meta.otherNight,'other') },custom:true };
}

async function compressImage(file:File):Promise<string> {
  const source = await new Promise<string>((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
  const image = await new Promise<HTMLImageElement>((resolve,reject) => { const next = new Image(); next.onload = () => resolve(next); next.onerror = reject; next.src = source; });
  const scale = Math.min(1,1280 / Math.max(image.width,image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1,Math.round(image.width * scale)); canvas.height = Math.max(1,Math.round(image.height * scale));
  canvas.getContext('2d')?.drawImage(image,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/webp',.72);
}

function downloadScript(script:ScriptDefinition) {
  const blob = new Blob([JSON.stringify({ ...script,sourceImage:undefined },null,2)],{ type:'application/json' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `${script.name}.json`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url),1000);
}

function withUnknownRoleAutomation(script:ScriptDefinition):ScriptDefinition {
  return { ...script,roles:script.roles.map((role) => builtInRoleCatalog.has(role.id) || role.automation ? role : { ...role,automation:defaultAutomation() }) };
}

function RoleLogicEditor({ script, onChange }:{ script:ScriptDefinition; onChange:(script:ScriptDefinition)=>void }) {
  const configurable = script.roles.filter((role) => role.automation);
  const pending = configurable.filter((role) => !role.automation?.configured).length;
  const update = (roleId:string, automation:RoleAutomation) => onChange({ ...script,roles:script.roles.map((role) => role.id === roleId ? { ...role,automation } : role) });
  return <section className="role-logic-editor">
    <div className="role-logic-intro">
      <span className={pending ? 'is-pending' : 'is-ready'}>{pending ? <AlertTriangle/> : <CheckCircle2/>}</span>
      <div><h3>检查新角色逻辑</h3><p>{pending ? `${pending} 个角色尚未配置，当前会安全地只显示技能说明。` : '所有新角色都已确认处理方式。'}</p></div>
    </div>
    <div className="role-logic-list">{configurable.map((role) => {
      const automation = role.automation ?? defaultAutomation();
      const statusEffect = ['poisoned','drunk','protected','noAbility','turnedGood','turnedEvil'].includes(automation.effect);
      return <article key={role.id} className={automation.configured ? 'is-configured' : ''}>
        <header><div><span>{alignmentMeta[role.alignment].short}</span><strong>{role.name}</strong></div><b>{automation.configured ? '已配置' : '待配置'}</b></header>
        <p>{role.ability}</p>
        <div className="role-logic-fields">
          <div className="role-logic-field"><span>处理方式</span><NativeSelect value={automation.configured ? 'automatic' : 'manual'} onChange={(event) => update(role.id,{ ...automation,configured:event.target.value === 'automatic' })} aria-label={`${role.name}处理方式`}><NativeSelectOption value="manual">说书人手动处理</NativeSelectOption><NativeSelectOption value="automatic">按下方规则自动处理</NativeSelectOption></NativeSelect></div>
          {automation.configured && <>
            <div className="role-logic-field"><span>选择玩家</span><NativeSelect value={automation.targetCount} onChange={(event) => update(role.id,{ ...automation,targetCount:Number(event.target.value) })} aria-label={`${role.name}选择玩家数量`}>{[0,1,2,3].map((count) => <NativeSelectOption key={count} value={count}>{count ? `${count} 名` : '无需选择'}</NativeSelectOption>)}</NativeSelect></div>
            <div className="role-logic-field"><span>自动效果</span><NativeSelect value={automation.effect} onChange={(event) => update(role.id,{ ...automation,effect:event.target.value as AutomationEffect })} aria-label={`${role.name}自动效果`}>{effectOptions.map((option) => <NativeSelectOption key={option.value} value={option.value}>{option.label}</NativeSelectOption>)}</NativeSelect></div>
            {statusEffect && <div className="role-logic-field"><span>持续时间</span><NativeSelect value={automation.expires ?? 'manual'} onChange={(event) => update(role.id,{ ...automation,expires:event.target.value as RoleAutomation['expires'] })} aria-label={`${role.name}效果持续时间`}><NativeSelectOption value="manual">直到手动移除</NativeSelectOption><NativeSelectOption value="nextDawn">天亮时自动移除</NativeSelectOption><NativeSelectOption value="nextDusk">下个黄昏自动移除</NativeSelectOption></NativeSelect></div>}
          </>}
        </div>
      </article>;
    })}</div>
  </section>;
}

export function ScriptLibraryDialog({ open, customScripts, currentScript, onClose, onSave, onUpdate, onDelete, onExportBackup, onImportBackup }:{ open:boolean; customScripts:ScriptDefinition[]; currentScript:ScriptDefinition; onClose:()=>void; onSave:(script:ScriptDefinition)=>void; onUpdate:(script:ScriptDefinition)=>void; onDelete:(id:string)=>void; onExportBackup:()=>void; onImportBackup:(value:{ customScripts?:unknown; currentGame?:unknown })=>void }) {
  const [name,setName] = useState('');
  const [minPlayers,setMinPlayers] = useState(7);
  const [maxPlayers,setMaxPlayers] = useState(15);
  const [roleText,setRoleText] = useState<Record<Alignment,string>>(emptyText);
  const [sourceImage,setSourceImage] = useState('');
  const [error,setError] = useState('');
  const [logicDraft,setLogicDraft] = useState<ScriptDefinition|null>(null);
  const [activeAlignment,setActiveAlignment] = useState<Alignment>('townsfolk');
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!open) return; setError(''); },[open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event:KeyboardEvent) => { if (event.key === 'Escape') { setLogicDraft(null); onClose(); } };
    window.addEventListener('keydown',onKey);
    return () => window.removeEventListener('keydown',onKey);
  },[open,onClose]);
  const parsedRoles = useMemo(() => {
    const id = safeId(name);
    return alignments.flatMap((alignment) => parseRoleLines(roleText[alignment],alignment,id));
  },[name,roleText]);

  if (!open) return null;

  async function chooseImage(file?:File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('请选择 JPG、PNG 或 WebP 剧本图片。'); return; }
    try { setSourceImage(await compressImage(file)); setError(''); } catch { setError('图片读取失败，请换一张图片重试。'); }
  }

  async function chooseJson(file?:File) {
    if (!file) return;
    try {
      const value = JSON.parse(await file.text()) as unknown;
      if (value && typeof value === 'object' && !Array.isArray(value) && (value as { type?:string }).type === backupFileType) {
        setError(''); onClose(); onImportBackup(value as { customScripts?:unknown; currentGame?:unknown }); return;
      }
      const converted = convertBotcScript(value);
      const native = !Array.isArray(value) && value && typeof value === 'object' ? value as ScriptDefinition : null;
      if (!converted && (!native?.name || !Array.isArray(native.roles) || !native.counts)) throw new Error('invalid');
      const base = converted ?? native!;
      const script = withUnknownRoleAutomation({ ...base,id:`custom-${safeId(base.name)}-${Date.now().toString(36)}`,custom:true,sourceImage:undefined });
      onSave(script); setError('');
      if (script.roles.some((role) => role.automation && !role.automation.configured)) setLogicDraft(script);
      else onClose();
    } catch { setError('无法识别这个 JSON。支持标准《血染钟楼》剧本 JSON，以及本工具导出的 JSON。'); }
  }

  function saveDraft() {
    const title = name.trim();
    if (!title) { setError('先填写剧本名称。'); return; }
    if (!parsedRoles.length) { setError('至少录入一个角色。'); return; }
    if (!parsedRoles.some((role) => role.alignment === 'demon')) { setError('剧本需要至少一个恶魔角色。'); return; }
    const low = Math.min(minPlayers,maxPlayers); const high = Math.max(minPlayers,maxPlayers);
    const counts = Object.fromEntries(Object.entries(standardCounts).filter(([count]) => Number(count) >= low && Number(count) <= high));
    const script:ScriptDefinition = { id:`custom-${safeId(title)}-${Date.now().toString(36)}`,name:title,author:'自定义',description:'由用户在本机导入的剧本。',playerRange:[low,high],counts,roles:parsedRoles,nightOrder:buildNightOrder(parsedRoles),custom:true,sourceImage:sourceImage || undefined };
    onSave(script); onClose();
  }

  function saveLogic() {
    if (!logicDraft) return;
    onUpdate(logicDraft); setLogicDraft(null); onClose();
  }

  return <div className="script-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="script-dialog" role="dialog" aria-modal="true" aria-labelledby="script-dialog-title">
      <header><div><span>本机剧本库</span><h2 id="script-dialog-title">导入新剧本</h2></div><button onClick={onClose} aria-label="关闭"><X/></button></header>
      <div className="script-dialog-body">
        <aside className="script-library-list">
          <div><strong>已添加</strong><small>数据只保存在当前浏览器</small></div>
          {!customScripts.length && <p>还没有自定义剧本。</p>}
          {customScripts.map((script) => { const pending = script.roles.filter((role) => role.automation && !role.automation.configured).length; return <article key={script.id}><span><b>{script.name}</b><small>{script.roles.length} 个角色{pending ? ` · ${pending} 个待配置` : ''}</small></span><div><button onClick={() => setLogicDraft(withUnknownRoleAutomation(script))} aria-label={`配置${script.name}角色逻辑`}><SlidersHorizontal/></button><button onClick={() => downloadScript(script)} aria-label={`导出${script.name}`}><Download/></button><button className="danger" onClick={() => onDelete(script.id)} aria-label={`删除${script.name}`}><Trash2/></button></div></article>; })}
          <Button variant="outline" onClick={() => downloadScript(currentScript)}><FileJson/>导出当前剧本 JSON</Button>
          <Button variant="outline" onClick={onExportBackup}><Archive/>备份全部数据</Button>
          <small className="backup-hint">备份包含全部自定义剧本和当前对局；用右侧“导入 JSON”即可恢复。</small>
        </aside>
        <div className="script-import-form">
          {logicDraft ? <RoleLogicEditor script={logicDraft} onChange={setLogicDraft}/> : <>
          <section className="script-source-row">
            <button className={`image-dropzone ${sourceImage ? 'has-image' : ''}`} onClick={() => fileRef.current?.click()}>
              {sourceImage ? <img src={sourceImage} alt="已选择的剧本参考图"/> : <><ImagePlus/><strong>选择剧本图片</strong><small>图片仅在本机压缩保存，供录入时对照</small></>}
            </button>
            <input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void chooseImage(event.target.files?.[0])}/>
            <div className="script-json-import"><FileJson/><span><strong>已有结构化文件？</strong><small>支持标准《血染钟楼》剧本 JSON、本工具导出的 JSON 和完整备份。</small></span><Button variant="outline" onClick={() => jsonRef.current?.click()}><Upload/>导入 JSON</Button><input ref={jsonRef} hidden type="file" accept="application/json,.json" onChange={(event) => void chooseJson(event.target.files?.[0])}/></div>
          </section>
          <section className="script-basic-fields">
            <label><span>剧本名称</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：暗流涌动"/></label>
            <label><span>最少人数</span><NativeSelect value={minPlayers} onChange={(event) => setMinPlayers(Number(event.target.value))}>{Array.from({length:9},(_,i) => i + 7).map((value) => <NativeSelectOption key={value} value={value}>{value} 人</NativeSelectOption>)}</NativeSelect></label>
            <label><span>最多人数</span><NativeSelect value={maxPlayers} onChange={(event) => setMaxPlayers(Number(event.target.value))}>{Array.from({length:9},(_,i) => i + 7).map((value) => <NativeSelectOption key={value} value={value}>{value} 人</NativeSelectOption>)}</NativeSelect></label>
          </section>
          <section className="role-entry">
            <nav aria-label="选择录入阵营">{alignments.map((alignment) => <button key={alignment} className={activeAlignment === alignment ? 'is-active' : ''} onClick={() => setActiveAlignment(alignment)}>{alignmentMeta[alignment].short}<span>{parseRoleLines(roleText[alignment],alignment,'draft').length}</span></button>)}</nav>
            <label><span>{alignmentMeta[activeAlignment].label}角色</span><small>每行一个：名称｜能力｜时机｜配置调整（后两项可省略）</small><textarea value={roleText[activeAlignment]} onChange={(event) => setRoleText((current) => ({ ...current,[activeAlignment]:event.target.value }))} placeholder={'角色名｜角色能力｜每夜\n另一个角色｜角色能力｜首夜'}/></label>
          </section>
          <div className="script-import-summary"><span>已识别 <b>{parsedRoles.length}</b> 个角色</span><span>{alignments.map((alignment) => `${alignmentMeta[alignment].short} ${parsedRoles.filter((role) => role.alignment === alignment).length}`).join(' · ')}</span></div>
          {error && <p className="script-import-error" role="alert">{error}</p>}
          </>}
        </div>
      </div>
      <footer>{logicDraft ? <><p>未配置角色不会自动改变座位状态；技能说明和夜序仍可正常使用。</p><Button variant="outline" onClick={() => { setLogicDraft(null); onClose(); }}>稍后处理</Button><Button onClick={saveLogic}><Save/>保存角色逻辑</Button></> : <><p>图片识别暂不自动猜角色，避免把角色名或能力识别错；录入后夜序会按“首夜 / 每夜”自动生成。</p><Button variant="outline" onClick={onClose}>取消</Button><Button onClick={saveDraft}><Save/>保存并切换</Button></>}</footer>
    </section>
  </div>;
}
