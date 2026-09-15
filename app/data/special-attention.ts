export type AttentionItem = {
  when: '配置时' | '首夜' | '夜晚' | '白天' | '提名时' | '死亡时';
  text: string;
};

// Storyteller-facing reminders shared by every script that contains the role.
// Adding a new role here automatically enables its reminder in the board UI.
export const specialAttention: Record<string, AttentionItem[]> = {
  golem: [
    { when:'提名时', text:'魔像整局只能发起一次提名；在他提名后立即标记“能力已使用”。' },
    { when:'提名时', text:'若被提名者不是恶魔，被提名者立即死亡；这是能力死亡，不等于当天处决。' },
  ],
  damsel: [{ when:'配置时', text:'所有爪牙知道落难少女在场；记录爪牙是否已经使用过公开猜测。' }],
  huntsman: [{ when:'配置时', text:'巡山人在场时必须加入落难少女；发动成功后把她变成一个不在场镇民。' }],
  balloonist: [{ when:'配置时', text:'按本工具规则应用镇民 -1、外来者 +1，并记录每晚已展示的角色类型。' }],
  'snake-charmer': [{ when:'夜晚', text:'选中恶魔时立即交换角色与阵营；原恶魔随后中毒，座位身份和夜序都要更新。' }],
  professor: [{ when:'夜晚', text:'只能复活死亡的镇民；发动后标记“能力已使用”，之后夜序自动跳过。' }],
  'poppy-grower': [{ when:'死亡时', text:'其死亡当晚才让爪牙与恶魔互认；首夜不要进行通常的邪恶方互认。' }],
  atheist: [{ when:'配置时', text:'通常应无邪恶角色在场；说书人可打破规则，但仍应保证游戏可解且有趣。' }],
  lunatic: [{ when:'夜晚', text:'按恶魔流程让疯子选择目标，并把他的选择告知真实恶魔。' }],
  drunk: [{ when:'配置时', text:'给酒鬼一个不在场镇民身份；其能力无效，但应像该镇民一样得到可信或错误反馈。' }],
  sweetheart: [{ when:'死亡时', text:'心上人死亡后选择一名玩家醉酒，并在魔典中持续标记。' }],
  barber: [{ when:'死亡时', text:'理发师死亡当晚，恶魔可交换两名非其他恶魔玩家的角色；随后更新身份与夜序。' }],
  boomdandy: [{ when:'死亡时', text:'炸弹人被处决时触发倒计时与群体死亡；提前准备好保留三名玩家的流程。' }],
  'pit-hag': [{ when:'夜晚', text:'若创造新恶魔，当晚死亡由说书人决定；角色变化后重新检查阵营、座位和夜序。' }],
  marionette: [{ when:'配置时', text:'提线木偶必须与恶魔邻座；本人以为自己是善良角色，只向恶魔确认其身份。' }],
  'spirit-whisperer': [{ when:'白天', text:'记录关键词首次由哪名善良玩家说出；该玩家在当晚转为邪恶。' }],
  'organ-grinder': [{ when:'白天', text:'投票时所有玩家闭眼且票数秘密统计；记得记录其夜间自选醉酒状态。' }],
  widow: [{ when:'首夜', text:'让寡妇查看魔典并选择中毒目标；随后让一名善良玩家知道寡妇在场。' }],
  godfather: [{ when:'死亡时', text:'白天有外来者死亡时，教父当晚可额外杀人；同时检查其外来者数量修正。' }],
  vigormortis: [{ when:'死亡时', text:'被亡骨魔杀死的爪牙保留能力，并使其相邻镇民之一中毒；更新对应标记。' }],
  'fang-gu': [{ when:'死亡时', text:'首次杀死外来者时，该外来者转为邪恶方古，原方古代替死亡；整局仅一次。' }],
  'evil-twin': [{ when:'配置时', text:'明确双子双方并处理公开信息；任一善良双子存活时，邪恶双子被处决可能令邪恶获胜。' }],
};

