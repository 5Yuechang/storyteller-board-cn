import type { Alignment, Role } from '@/app/data/scripts';

type RoleAdjustment = { value: number; reason: string };
export type BalanceFactor = { role: Role; value: number; reason: string };
export type BoardBalance = {
  blue: number;
  red: number;
  tendency: 'blue' | 'balanced' | 'red';
  label: string;
  factors: BalanceFactor[];
};

// Positive values add pressure for the good team; negative values add pressure for evil.
// Every new script gets a useful estimate from alignmentBase, while exceptional roles can
// be calibrated here without coupling the calculation to the UI.
const alignmentBase: Record<Alignment, number> = {
  townsfolk: 0.5,
  outsider: -0.6,
  minion: -1,
  demon: -1.5,
};

const roleAdjustments: Record<string, RoleAdjustment> = {
  'fortune-teller': { value: 0.45, reason: '持续恶魔定位信息' },
  balloonist: { value: 0.35, reason: '持续角色类型信息' },
  dreamer: { value: 0.35, reason: '持续身份二选一信息' },
  clockmaker: { value: 0.25, reason: '首夜提供邪恶座位距离' },
  mathematician: { value: 0.2, reason: '追踪能力异常次数' },
  flowergirl: { value: 0.25, reason: '持续追踪恶魔投票' },
  'town-crier': { value: 0.25, reason: '持续追踪爪牙提名' },
  oracle: { value: 0.2, reason: '持续统计死亡邪恶' },
  juggler: { value: 0.2, reason: '首日可获取多项角色验证' },
  seamstress: { value: 0.25, reason: '一次验证两人阵营关系' },
  artist: { value: 0.25, reason: '一次自由是非信息' },
  professor: { value: 0.45, reason: '可复活镇民' },
  philosopher: { value: 0.35, reason: '可复制关键善良能力' },
  engineer: { value: 0.35, reason: '可控制邪恶角色构成' },
  'poppy-grower': { value: 0.35, reason: '阻断邪恶方互认' },
  fisherman: { value: 0.2, reason: '一次定向建议' },
  damsel: { value: -0.55, reason: '被爪牙猜中会直接落败' },
  drunk: { value: -0.35, reason: '占用善良名额且持续误导' },
  sweetheart: { value: -0.3, reason: '死亡后制造醉酒' },
  barber: { value: -0.25, reason: '死亡后给予恶魔换位能力' },
  lunatic: { value: -0.2, reason: '向真实恶魔泄露夜间选择' },
  poisoner: { value: -0.35, reason: '持续中毒干扰信息' },
  widow: { value: -0.45, reason: '查看魔典并持续下毒' },
  'pit-hag': { value: -0.4, reason: '可持续改变身份' },
  marionette: { value: -0.35, reason: '隐藏邪恶身份' },
  'spirit-whisperer': { value: -0.35, reason: '可转化善良玩家' },
  cerenovus: { value: -0.25, reason: '持续施加疯狂压力' },
  godfather: { value: -0.25, reason: '外来者死亡可额外击杀' },
  vigormortis: { value: -0.35, reason: '保留爪牙能力并使镇民中毒' },
  'fang-gu': { value: -0.3, reason: '可转化外来者并转移恶魔' },
  witch: { value: -0.3, reason: '诅咒提名并压制白天行动' },
  'evil-twin': { value: -0.4, reason: '限制善良胜利并制造处决风险' },
  'no-dashii': { value: -0.45, reason: '持续使相邻镇民中毒' },
  vortox: { value: -0.5, reason: '强制镇民错误信息与每日处决' },
  'hadi-jiya': { value: -0.25, reason: '多人抉择带来群体死亡压力' },
  'black-sun': { value: -0.25, reason: '多人死亡与隐藏决策压力' },
};

export function evaluateBoardBalance(roles: Role[]): BoardBalance {
  if (!roles.length) return { blue: 50, red: 50, tendency: 'balanced', label: '等待配板', factors: [] };

  const factors = roles.map((role) => {
    const adjustment = roleAdjustments[role.id];
    return {
      role,
      value: alignmentBase[role.alignment] + (adjustment?.value ?? 0),
      reason: adjustment?.reason ?? (role.alignment === 'townsfolk' ? '提供善良方能力' : role.alignment === 'outsider' ? '增加善良方负担' : role.alignment === 'minion' ? '提供邪恶方干扰' : '提供恶魔方击杀压力'),
    };
  });
  const score = factors.reduce((total, factor) => total + factor.value, 0);
  const blue = Math.max(15, Math.min(85, Math.round(50 + score * 6)));
  const red = 100 - blue;
  const tendency = blue >= 57 ? 'blue' : red >= 57 ? 'red' : 'balanced';
  const label = tendency === 'blue' ? '偏蓝' : tendency === 'red' ? '偏红' : '相对均衡';

  return { blue, red, tendency, label, factors };
}
