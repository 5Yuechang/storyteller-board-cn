export type Alignment = 'townsfolk' | 'outsider' | 'minion' | 'demon';
export type Role = { id: string; name: string; alignment: Alignment; ability: string; timing?: '首夜' | '每夜' | '白天' | '被动' | '一次'; setup?: string; note?: string };
export type PlayerCount = Record<Alignment, number>;
export type ScriptDefinition = { id: string; name: string; author: string; playerRange: [number, number]; description: string; counts: Record<number, PlayerCount>; roles: Role[] };

const standardCounts: Record<number, PlayerCount> = {
  7:{townsfolk:5,outsider:0,minion:1,demon:1}, 8:{townsfolk:5,outsider:1,minion:1,demon:1}, 9:{townsfolk:5,outsider:2,minion:1,demon:1},
  10:{townsfolk:7,outsider:0,minion:2,demon:1}, 11:{townsfolk:7,outsider:1,minion:2,demon:1}, 12:{townsfolk:7,outsider:2,minion:2,demon:1},
  13:{townsfolk:9,outsider:0,minion:3,demon:1}, 14:{townsfolk:9,outsider:1,minion:3,demon:1}, 15:{townsfolk:9,outsider:2,minion:3,demon:1},
};

export const scripts: ScriptDefinition[] = [{
  id:'human-nature-is-evil', name:'人性本恶', author:'芝士薯条', playerRange:[7,15],
  description:'围绕隐藏阵营、能力错位与公开博弈展开的进阶剧本。', counts:standardCounts,
  roles:[
    {id:'noble',name:'贵族',alignment:'townsfolk',timing:'首夜',ability:'在你的首个夜晚，你会得知三名玩家：其中有且只有一名玩家是邪恶的。'},
    {id:'innkeeper',name:'店小二',alignment:'townsfolk',timing:'首夜',ability:'在你的首个夜晚，你会得知两名善良玩家。他们之中会有一人醉酒，即使你已死亡。'},
    {id:'fortune-teller',name:'占卜师',alignment:'townsfolk',timing:'每夜',ability:'每个夜晚，你要选择两名玩家：你会得知他们之中是否有恶魔。会有一名善良玩家始终被你的能力当作“恶魔”。'},
    {id:'snake-charmer',name:'舞蛇人',alignment:'townsfolk',timing:'每夜',ability:'每个夜晚，你要选择一名存活的玩家：如果你选中了恶魔，你和他交换角色和阵营，随后他中毒。'},
    {id:'preacher',name:'传教士',alignment:'townsfolk',timing:'每夜',ability:'每个夜晚，你要选择一名玩家：如果你选中了爪牙，他会得知被传教士选中。所有被你选中的爪牙失去能力。'},
    {id:'balloonist',name:'气球驾驶员',alignment:'townsfolk',timing:'每夜',ability:'每个夜晚，你会得知一名与上个夜晚得知的玩家角色类型不同的玩家。',setup:'+0～1 外来者'},
    {id:'huntsman',name:'巡山人',alignment:'townsfolk',timing:'一次',ability:'每局游戏限一次，在夜晚时，你可以选择一名存活的玩家：如果你选中了落难少女，她会变成一个不在场的镇民角色。',setup:'+ 落难少女'},
    {id:'professor',name:'教授',alignment:'townsfolk',timing:'一次',ability:'每局游戏限一次，在夜晚时，你可以选择一名死亡的玩家：如果他是镇民，他会被复活。'},
    {id:'savant',name:'博学者',alignment:'townsfolk',timing:'白天',ability:'每个白天，你可以私下询问说书人以得知两条信息：一个是正确的，一个是错误的。'},
    {id:'amnesiac',name:'失忆者',alignment:'townsfolk',timing:'白天',ability:'你不知道你的能力是什么。每个白天你可以找说书人猜测一次，并得知猜测有多准确。'},
    {id:'poppy-grower',name:'罂粟种植者',alignment:'townsfolk',timing:'被动',ability:'爪牙和恶魔互不认识。如果你死亡，当晚他们会互相认识。'},
    {id:'banshee',name:'秉笔',alignment:'townsfolk',timing:'被动',ability:'如果你在白天死亡，当晚你会得知一名善良玩家；如果你在夜晚死亡，当晚你会得知一名邪恶玩家。',note:'名称与能力按上传剧本图录入'},
    {id:'redirector',name:'半仙',alignment:'townsfolk',timing:'被动',ability:'每个在夜晚使用自身能力选择你的其他玩家，会改为选中另一名邪恶玩家作为替代。',note:'自制角色'},
    {id:'atheist',name:'无神论者',alignment:'townsfolk',timing:'被动',ability:'说书人可以打破游戏规则。如果说书人被处决，善良阵营获胜，即使你已死亡。',setup:'无邪恶角色在场'},

    {id:'lunatic',name:'疯子',alignment:'outsider',timing:'被动',ability:'你以为你是一个恶魔，但其实你不是。恶魔知道你是疯子以及你在每个夜晚选择了哪些玩家。'},
    {id:'damsel',name:'落难少女',alignment:'outsider',timing:'被动',ability:'所有爪牙都知道落难少女在场。每局游戏限一次，任意爪牙可以公开猜测你是落难少女；如果猜对，你的阵营落败。'},
    {id:'drunk',name:'酒鬼',alignment:'outsider',timing:'被动',ability:'你不知道你是酒鬼。你以为你是一个镇民角色，但其实你不是。'},
    {id:'golem',name:'魔像',alignment:'outsider',timing:'一次',ability:'每局游戏你只能发起提名一次。当你发起提名时，如果被你提名的玩家不是恶魔，他死亡。'},

    {id:'psychopath',name:'精神病患者',alignment:'minion',timing:'白天',ability:'每个白天，在提名开始前，你可以公开选择一名玩家：他死亡。如果你被处决，提名你的玩家需要和你猜拳，只有你输了你才会死亡。'},
    {id:'boomdandy',name:'炸弹人',alignment:'minion',timing:'被动',ability:'如果你被处决，除三名玩家以外的其他所有玩家均会死亡。倒数十声后，被最多玩家手指指着的玩家死亡。'},
    {id:'pit-hag',name:'麻脸巫婆',alignment:'minion',timing:'每夜',ability:'每个夜晚，你要选择一名玩家和一个角色：如果该角色不在场，他变成该角色。如果因此创造了一个恶魔，当晚的死亡由说书人决定。'},
    {id:'spirit-whisperer',name:'灵言师',alignment:'minion',timing:'首夜',ability:'在你的首个夜晚，你会得知一个关键词。首个说出该关键词的善良玩家会在当晚转变为邪恶阵营。'},
    {id:'organ-grinder',name:'街头风琴手',alignment:'minion',timing:'被动',ability:'所有玩家在投票时闭眼，且票数会秘密统计。每个夜晚，你要选择自己是否醉酒直到下个黄昏。'},
    {id:'marionette',name:'提线木偶',alignment:'minion',timing:'被动',ability:'你以为你是一个善良角色，但其实你不是。恶魔会知道你是提线木偶。',setup:'与恶魔邻座'},

    {id:'toy-maker',name:'童趣玩偶',alignment:'demon',timing:'每夜',ability:'每个夜晚*，你可以选择三名玩家（所有玩家都会得知你选了谁）：他们分别在三名玩家中秘密选择一名玩家，被选择最多的玩家死亡。如果只有一名玩家被选择，改为其他两名玩家死亡。'},
    {id:'trolley-problem',name:'电车难题',alignment:'demon',timing:'每夜',ability:'每个夜晚*，你可以选择三名玩家（所有玩家都会得知前两名玩家是谁）：所有善良玩家分别秘密表决他们的生死，然后如果他们存活则第三名玩家死亡。'},
    {id:'black-sun',name:'太阳黑子',alignment:'demon',timing:'每夜',ability:'每个夜晚*，你可以选择三名存活玩家（所有玩家都会得知前两名玩家是谁）：第三名玩家秘密决定他们中谁会被你杀死，然后如果他们都死亡，则所有玩家都会在下个黎明得知第三名玩家是谁。'},
    {id:'hadi-jiya',name:'哈迪寂亚',alignment:'demon',timing:'每夜',ability:'每个夜晚*，你可以选择三名玩家（所有玩家都会得知你选了谁）：他们分别秘密决定自己的生死，然后如果他们都存活则都死亡。'},
  ]
}];

export const alignmentMeta: Record<Alignment,{label:string;short:string}> = {
  townsfolk:{label:'善良阵营 · 镇民',short:'镇民'}, outsider:{label:'善良阵营 · 外来者',short:'外来者'}, minion:{label:'邪恶阵营 · 爪牙',short:'爪牙'}, demon:{label:'邪恶阵营 · 恶魔',short:'恶魔'},
};
