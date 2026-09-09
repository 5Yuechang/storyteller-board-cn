export type Alignment = 'townsfolk' | 'outsider' | 'minion' | 'demon';
export type Role = { id: string; name: string; alignment: Alignment; ability: string; timing?: '首夜' | '每夜' | '每夜*' | '白天' | '被动' | '一次'; setup?: string; note?: string; misinformation?: string[] };
export type PlayerCount = Record<Alignment, number>;
export type NightStep = { id: string; name: string; note: string; roleId?: string; phase?: '信息'|'行动'|'结算'; deadMode?: 'show'|'only'; requiredAlignment?: Alignment; skipWhenRolePresent?: string };
export type ScriptDefinition = { id: string; name: string; author: string; playerRange: [number, number]; description: string; counts: Record<number, PlayerCount>; roles: Role[]; specialRules?: { name:string; description:string }[]; nightOrder: { first: NightStep[]; other: NightStep[] } };

const standardCounts: Record<number, PlayerCount> = {
  7:{townsfolk:5,outsider:0,minion:1,demon:1}, 8:{townsfolk:5,outsider:1,minion:1,demon:1}, 9:{townsfolk:5,outsider:2,minion:1,demon:1},
  10:{townsfolk:7,outsider:0,minion:2,demon:1}, 11:{townsfolk:7,outsider:1,minion:2,demon:1}, 12:{townsfolk:7,outsider:2,minion:2,demon:1},
  13:{townsfolk:9,outsider:0,minion:3,demon:1}, 14:{townsfolk:9,outsider:1,minion:3,demon:1}, 15:{townsfolk:9,outsider:2,minion:3,demon:1},
};

export const scripts: ScriptDefinition[] = [{
  id:'human-nature-is-evil', name:'人性本恶', author:'芝士薯条', playerRange:[7,15],
  description:'围绕隐藏阵营、能力错位与公开博弈展开的进阶剧本。', counts:standardCounts,
  roles:[
    {id:'noble',name:'贵族',alignment:'townsfolk',timing:'首夜',ability:'在你的首个夜晚，你会得知三名玩家：其中有且只有一名玩家是邪恶的。',misinformation:['展示三名善良玩家，让其中一名行为可疑的玩家成为焦点。','展示两名邪恶玩家与一名善良玩家，制造互斥的邪恶世界。','把一名外来者放进三人组，让其角色诉求自然放大怀疑。']},
    {id:'innkeeper',name:'店小二',alignment:'townsfolk',timing:'首夜',ability:'在你的首个夜晚，你会得知两名善良玩家。他们之中会有一人醉酒，即使你已死亡。',misinformation:['展示一善一恶两名玩家，让邪恶玩家获得被认证空间。','展示两名善良玩家，但把玩家对醉酒落点的判断引向错误对象。','选择身份尚未公开的玩家，延后错误信息被立即验证。']},
    {id:'fortune-teller',name:'占卜师',alignment:'townsfolk',timing:'每夜',ability:'每个夜晚，你要选择两名玩家：你会得知他们之中是否有恶魔。会有一名善良玩家始终被你的能力当作“恶魔”。',misinformation:['在不含恶魔、也不含红鲱鱼的组合上给出“是”。','在包含恶魔的组合上给出“否”，为恶魔制造一次可信认证。','让连续两晚的答案形成一致但错误的世界，而不是随机翻转。']},
    {id:'snake-charmer',name:'舞蛇人',alignment:'townsfolk',timing:'每夜',ability:'每个夜晚，你要选择一名存活的玩家：如果你选中了恶魔，你和他交换角色和阵营，随后他中毒。'},
    {id:'preacher',name:'传教士',alignment:'townsfolk',timing:'每夜',ability:'每个夜晚，你要选择一名玩家：如果你选中了爪牙，他会得知被传教士选中。所有被你选中的爪牙失去能力。'},
    {id:'balloonist',name:'气球驾驶员',alignment:'townsfolk',timing:'每夜',ability:'每个夜晚，你会得知一名与上个夜晚得知的玩家角色类型不同的玩家。',setup:'+0～1 外来者',misinformation:['连续展示相同角色类型的玩家，让类型链在复盘时出现缺口。','跳过一种角色类型，诱导玩家错误排除某个阵营。','先给可信玩家，再把邪恶玩家接入看似合法的类型链。']},
    {id:'huntsman',name:'巡山人',alignment:'townsfolk',timing:'一次',ability:'每局游戏限一次，在夜晚时，你可以选择一名存活的玩家：如果你选中了落难少女，她会变成一个不在场的镇民角色。',setup:'+ 落难少女'},
    {id:'professor',name:'教授',alignment:'townsfolk',timing:'一次',ability:'每局游戏限一次，在夜晚时，你可以选择一名死亡的玩家：如果他是镇民，他会被复活。'},
    {id:'savant',name:'博学者',alignment:'townsfolk',timing:'白天',ability:'每个白天，你可以私下询问说书人以得知两条信息：一个是正确的，一个是错误的。',misinformation:['给出两条都为真但看似互相冲突的信息，制造能力异常感。','给出两条都为假、却共同支持一个错误世界的信息。','把一条信息绑定到已死亡玩家或过去事件，降低即时可验证性。']},
    {id:'amnesiac',name:'失忆者',alignment:'townsfolk',timing:'白天',ability:'你不知道你的能力是什么。每个白天你可以找说书人猜测一次，并得知猜测有多准确。',misinformation:['对接近答案的猜测给出偏低反馈，引导玩家多探索一个分支。','对错误但有趣的猜测给出偏高反馈，制造可持续验证的假方向。','保持反馈尺度一致，避免单次异常直接暴露醉酒或中毒。']},
    {id:'poppy-grower',name:'罂粟种植者',alignment:'townsfolk',timing:'被动',ability:'爪牙和恶魔互不认识。如果你死亡，当晚他们会互相认识。'},
    {id:'banshee',name:'秉笔',alignment:'townsfolk',timing:'被动',ability:'如果你在白天死亡，当晚你会得知一名善良玩家；如果你在夜晚死亡，当晚你会得知一名邪恶玩家。',note:'名称与能力按上传剧本图录入',misinformation:['白天死亡时展示一名邪恶玩家，反转其善良认证。','夜晚死亡时展示一名善良玩家，把怀疑推向错误目标。','优先选择尚未公开身份的玩家，让错误信息保留讨论空间。']},
    {id:'redirector',name:'半仙',alignment:'townsfolk',timing:'被动',ability:'每个在夜晚使用自身能力选择你的其他玩家，会改为选中另一名邪恶玩家作为替代。',note:'自制角色'},
    {id:'atheist',name:'无神论者',alignment:'townsfolk',timing:'被动',ability:'说书人可以打破游戏规则。如果说书人被处决，善良阵营获胜，即使你已死亡。',setup:'无邪恶角色在场'},

    {id:'lunatic',name:'疯子',alignment:'outsider',timing:'被动',ability:'你以为你是一个恶魔，但其实你不是。恶魔知道你是疯子以及你在每个夜晚选择了哪些玩家。'},
    {id:'damsel',name:'落难少女',alignment:'outsider',timing:'被动',ability:'所有爪牙都知道落难少女在场。每局游戏限一次，任意爪牙可以公开猜测你是落难少女；如果猜对，你的阵营落败。'},
    {id:'drunk',name:'酒鬼',alignment:'outsider',timing:'被动',ability:'你不知道你是酒鬼。你以为你是一个镇民角色，但其实你不是。'},
    {id:'golem',name:'魔像',alignment:'outsider',timing:'一次',ability:'每局游戏你只能发起提名一次。当你发起提名时，如果被你提名的玩家不是恶魔，他死亡。'},

    {id:'psychopath',name:'精神病患者',alignment:'minion',timing:'白天',ability:'每个白天，在提名开始前，你可以公开选择一名玩家：他死亡。如果你被处决，提名你的玩家需要和你猜拳，只有你输了你才会死亡。'},
    {id:'boomdandy',name:'炸弹人',alignment:'minion',timing:'被动',ability:'如果你被处决，除三名玩家以外的其他所有玩家均会死亡。倒数十声后，被最多玩家手指指着的玩家死亡。'},
    {id:'pit-hag',name:'麻脸巫婆',alignment:'minion',timing:'每夜*',ability:'每个夜晚*，你要选择一名玩家和一个角色：如果该角色不在场，他变成该角色。如果因此创造了一个恶魔，当晚的死亡由说书人决定。'},
    {id:'spirit-whisperer',name:'灵言师',alignment:'minion',timing:'首夜',ability:'在你的首个夜晚，你会得知一个关键词。首个说出该关键词的善良玩家会在当晚转变为邪恶阵营。'},
    {id:'organ-grinder',name:'街头风琴手',alignment:'minion',timing:'每夜',ability:'所有玩家在投票时闭眼，且票数会秘密统计。每个夜晚，你要选择自己是否醉酒直到下个黄昏。'},
    {id:'marionette',name:'提线木偶',alignment:'minion',timing:'被动',ability:'你以为你是一个善良角色，但其实你不是。恶魔会知道你是提线木偶。',setup:'与恶魔邻座'},

    {id:'toy-maker',name:'童趣玩偶',alignment:'demon',timing:'每夜*',ability:'每个夜晚*，你可以选择三名玩家（所有玩家都会得知你选了谁）：他们分别在三名玩家中秘密选择一名玩家，被选择最多的玩家死亡。如果只有一名玩家被选择，改为其他两名玩家死亡。'},
    {id:'trolley-problem',name:'电车难题',alignment:'demon',timing:'每夜*',ability:'每个夜晚*，你可以选择三名玩家（所有玩家都会得知前两名玩家是谁）：所有善良玩家分别秘密表决他们的生死，然后如果他们存活则第三名玩家死亡。'},
    {id:'black-sun',name:'太阳黑子',alignment:'demon',timing:'每夜*',ability:'每个夜晚*，你可以选择三名存活玩家（所有玩家都会得知前两名玩家是谁）：第三名玩家秘密决定他们中谁会被你杀死，然后如果他们都死亡，则所有玩家都会在下个黎明得知第三名玩家是谁。'},
    {id:'hadi-jiya',name:'哈迪寂亚',alignment:'demon',timing:'每夜*',ability:'每个夜晚*，你可以选择三名玩家（所有玩家都会得知你选了谁）：他们分别秘密决定自己的生死，然后如果他们都存活则都死亡。'},
  ],
  nightOrder:{
    first:[
      {id:'minion-info',name:'爪牙信息',note:'唤醒爪牙，让其互认并确认恶魔。',phase:'信息',requiredAlignment:'minion',skipWhenRolePresent:'poppy-grower'},
      {id:'demon-info',name:'恶魔信息',note:'确认爪牙与三项不在场的善良角色。',phase:'信息',requiredAlignment:'demon'},
      {id:'poppy-block',name:'罂粟种植者',note:'确认邪恶阵营本夜不互相认识。',roleId:'poppy-grower',phase:'结算'},
      {id:'spirit-whisperer-first',name:'灵言师',note:'告知一个关键词。',roleId:'spirit-whisperer',phase:'信息'},
      {id:'marionette-first',name:'提线木偶',note:'让恶魔确认提线木偶；不要唤醒提线木偶本人。',roleId:'marionette',phase:'信息'},
      {id:'organ-grinder-first',name:'街头风琴手',note:'选择自己是否醉酒，持续到下个黄昏。',roleId:'organ-grinder',phase:'行动'},
      {id:'lunatic-first',name:'疯子',note:'按恶魔流程唤醒并让其选择目标，记录选择。',roleId:'lunatic',phase:'行动'},
      {id:'preacher-first',name:'传教士',note:'选择一名玩家；若为爪牙，处理失去能力。',roleId:'preacher',phase:'行动'},
      {id:'snake-charmer-first',name:'舞蛇人',note:'选择一名存活玩家，检查是否与恶魔交换。',roleId:'snake-charmer',phase:'行动'},
      {id:'huntsman-first',name:'巡山人',note:'可选择一名存活玩家并检查落难少女。',roleId:'huntsman',phase:'行动'},
      {id:'fortune-teller-first',name:'占卜师',note:'选择两名玩家，给出是否包含恶魔的信息。',roleId:'fortune-teller',phase:'信息'},
      {id:'noble-first',name:'贵族',note:'展示三名玩家，其中恰有一名邪恶。',roleId:'noble',phase:'信息'},
      {id:'innkeeper-first',name:'店小二',note:'展示两名善良玩家，并处理其中一人醉酒；死亡后仍会获得信息。',roleId:'innkeeper',phase:'信息',deadMode:'show'},
      {id:'balloonist-first',name:'气球驾驶员',note:'展示第一名玩家，记录其角色类型。',roleId:'balloonist',phase:'信息'},
    ],
    other:[
      {id:'poppy-death',name:'罂粟种植者',note:'其死亡后，安排邪恶阵营在本夜互相认识。',roleId:'poppy-grower',phase:'结算',deadMode:'only'},
      {id:'preacher-other',name:'传教士',note:'选择一名玩家；若为爪牙，处理失去能力。',roleId:'preacher',phase:'行动'},
      {id:'snake-charmer-other',name:'舞蛇人',note:'选择一名存活玩家，检查是否与恶魔交换。',roleId:'snake-charmer',phase:'行动'},
      {id:'huntsman-other',name:'巡山人',note:'若尚未发动，可选择一名存活玩家并检查落难少女。',roleId:'huntsman',phase:'行动'},
      {id:'professor-other',name:'教授',note:'若发动能力，选择一名死亡玩家并检查是否复活。',roleId:'professor',phase:'行动'},
      {id:'pit-hag-other',name:'麻脸巫婆',note:'选择玩家与角色，处理角色变化及恶魔被创造的死亡。',roleId:'pit-hag',phase:'行动'},
      {id:'organ-grinder-other',name:'街头风琴手',note:'选择自己是否醉酒直到下个黄昏。',roleId:'organ-grinder',phase:'行动'},
      {id:'lunatic-other',name:'疯子',note:'让疯子选择夜间目标，并把选择告知真实恶魔。',roleId:'lunatic',phase:'行动'},
      {id:'toy-maker-other',name:'童趣玩偶',note:'选择三名玩家并完成秘密选择与死亡结算。',roleId:'toy-maker',phase:'行动'},
      {id:'trolley-problem-other',name:'电车难题',note:'选择三名玩家，完成善良玩家的秘密生死表决。',roleId:'trolley-problem',phase:'行动'},
      {id:'black-sun-other',name:'太阳黑子',note:'选择三名存活玩家，由第三名秘密决定死亡目标。',roleId:'black-sun',phase:'行动'},
      {id:'hadi-jiya-other',name:'哈迪寂亚',note:'选择三名玩家，让他们分别秘密决定自己的生死。',roleId:'hadi-jiya',phase:'行动'},
      {id:'fortune-teller-other',name:'占卜师',note:'选择两名玩家，给出是否包含恶魔的信息。',roleId:'fortune-teller',phase:'信息'},
      {id:'balloonist-other',name:'气球驾驶员',note:'展示一名与上次角色类型不同的玩家。',roleId:'balloonist',phase:'信息'},
      {id:'banshee-other',name:'秉笔',note:'本日或本夜死亡后，按死亡时段展示对应阵营玩家。',roleId:'banshee',phase:'信息',deadMode:'only'},
    ]
  }
}, {
  id:'catfishing', name:'瓦釜雷鸣', author:'Emily', playerRange:[7,15],
  description:'经典进阶剧本 Catfishing：真假身份交错，死亡信息与角色变化彼此牵制。', counts:standardCounts,
  roles:[
    {id:'investigator',name:'调查员',alignment:'townsfolk',timing:'首夜',ability:'在你的首个夜晚，你会得知两名玩家和一个爪牙角色：这两名玩家之一是该角色（或者你会得知没有爪牙在场）。',misinformation:['展示两名善良玩家并配上一个不在场爪牙。','把真实爪牙与另一名邪恶玩家同时展示，制造互斥世界。']},
    {id:'chef',name:'厨师',alignment:'townsfolk',timing:'首夜',ability:'在你的首个夜晚，你会得知场上邻座的邪恶玩家有多少对。',misinformation:['把数字上下偏移一，使座位链仍保留可推理空间。','给出零，诱导玩家错误拆散真实邪恶邻座。']},
    {id:'grandmother',name:'祖母',alignment:'townsfolk',timing:'首夜',ability:'在你的首个夜晚，你会得知一名善良玩家和他的角色。如果恶魔杀死了他，你也会死亡。',misinformation:['把一名邪恶玩家展示为某个不在场的善良角色。','展示真实善良玩家，但给出错误角色。']},
    {id:'fortune-teller',name:'占卜师',alignment:'townsfolk',timing:'每夜',ability:'每个夜晚，你要选择两名玩家：你会得知他们之中是否有恶魔。会有一名善良玩家始终被你的能力当作“恶魔”。',misinformation:['在不含恶魔的组合上给出“是”。','在包含恶魔的组合上给出“否”。']},
    {id:'balloonist',name:'气球驾驶员',alignment:'townsfolk',timing:'每夜',ability:'每个夜晚，你会得知一名不同角色类型的玩家，直到场上所有角色类型你都得知过一次。',setup:'+1 外来者',misinformation:['连续展示相同角色类型，制造错误类型链。','跳过一种类型，诱导玩家错误排除阵营。']},
    {id:'dreamer',name:'筑梦师',alignment:'townsfolk',timing:'每夜',ability:'每个夜晚，你要选择除你及旅行者以外的一名玩家：你会得知一个善良角色和一个邪恶角色，该玩家是其中一个角色。',misinformation:['给出两个都不是目标的角色。','用目标的真实阵营搭配一个错误角色，保留可信度。']},
    {id:'snake-charmer',name:'舞蛇人',alignment:'townsfolk',timing:'每夜',ability:'每个夜晚，你要选择一名存活的玩家：如果你选中了恶魔，你和他交换角色和阵营，随后他中毒。'},
    {id:'gambler',name:'赌徒',alignment:'townsfolk',timing:'每夜*',ability:'每个夜晚*，你要选择一名玩家并猜测他的角色：如果你猜错了，你会死亡。'},
    {id:'savant',name:'博学者',alignment:'townsfolk',timing:'白天',ability:'每个白天，你可以私下询问说书人以得知两条信息：一个是正确的，一个是错误的。',misinformation:['给出两条都为真但看似冲突的信息。','给出两条都为假、却共同支持一个错误世界的信息。']},
    {id:'philosopher',name:'哲学家',alignment:'townsfolk',timing:'一次',ability:'每局游戏限一次，在夜晚时，你可以选择一个善良角色：你获得该角色的能力。如果这个角色在场，他醉酒。'},
    {id:'ravenkeeper',name:'守鸦人',alignment:'townsfolk',timing:'被动',ability:'如果你在夜晚死亡，你会被唤醒，然后你要选择一名玩家：你会得知他的角色。',misinformation:['展示目标的另一个善良角色。','把邪恶目标展示成一个符合其发言的善良角色。']},
    {id:'amnesiac',name:'失忆者',alignment:'townsfolk',timing:'白天',ability:'你不知道你的能力是什么。每个白天你可以找说书人猜测一次，并得知猜测有多准确。',misinformation:['对接近答案的猜测给出偏低反馈。','对有趣但错误的猜测给出偏高反馈。']},
    {id:'cannibal',name:'食人族',alignment:'townsfolk',timing:'被动',ability:'你拥有上个死于处决的玩家的能力。如果该玩家属于邪恶阵营，你中毒直到下个善良玩家死于处决。'},

    {id:'drunk',name:'酒鬼',alignment:'outsider',timing:'被动',ability:'你不知道你是酒鬼。你以为你是一个镇民角色，但其实你不是。'},
    {id:'mutant',name:'畸形秀演员',alignment:'outsider',timing:'被动',ability:'如果你“疯狂”地证明自己是外来者，你可能被处决。'},
    {id:'lunatic',name:'疯子',alignment:'outsider',timing:'被动',ability:'你以为你是一个恶魔，但其实你不是。恶魔知道你是疯子以及你在每个夜晚选择了哪些玩家。'},
    {id:'recluse',name:'陌客',alignment:'outsider',timing:'被动',ability:'你可能会被当作邪恶阵营、爪牙角色或恶魔角色，即使你已死亡。'},
    {id:'sweetheart',name:'心上人',alignment:'outsider',timing:'被动',ability:'当你死亡时，会有一名玩家开始醉酒。'},

    {id:'godfather',name:'教父',alignment:'minion',timing:'每夜*',ability:'在你的首个夜晚，你会得知有哪些外来者角色在场。如果有外来者在白天死亡，你会在当晚被唤醒并选择一名玩家：他死亡。',setup:'-1 或 +1 外来者'},
    {id:'cerenovus',name:'洗脑师',alignment:'minion',timing:'每夜',ability:'每个夜晚，你要选择一名玩家和一个善良角色。他明天白天和夜晚需要“疯狂”地证明自己是这个角色，否则他可能被处决。'},
    {id:'pit-hag',name:'麻脸巫婆',alignment:'minion',timing:'每夜*',ability:'每个夜晚*，你要选择一名玩家和一个角色：如果该角色不在场，他变成该角色。如果因此创造了一个恶魔，当晚的死亡由说书人决定。'},
    {id:'widow',name:'寡妇',alignment:'minion',timing:'首夜',ability:'在你的首个夜晚，你能查看魔典并选择一名玩家：他中毒。随后，始终会有一名善良玩家知道寡妇在场。'},

    {id:'imp',name:'小恶魔',alignment:'demon',timing:'每夜*',ability:'每个夜晚*，你要选择一名玩家：他死亡。如果你以这种方式自杀，一名爪牙会变成小恶魔。'},
    {id:'vigormortis',name:'亡骨魔',alignment:'demon',timing:'每夜*',ability:'每个夜晚*，你要选择一名玩家：他死亡。被该能力杀死的爪牙保留他的能力，且与他邻近的两名镇民之一中毒。',setup:'-1 外来者'},
    {id:'fang-gu',name:'方古',alignment:'demon',timing:'每夜*',ability:'每个夜晚*，你要选择一名玩家：他死亡。被该能力杀死的外来者改为变成邪恶的方古且你代替他死亡，但每局游戏仅能成功转化一次。',setup:'+1 外来者'},
  ],
  nightOrder:{
    first:[
      {id:'cf-minion-info',name:'爪牙信息',note:'唤醒爪牙，让其互认并确认恶魔。',phase:'信息',requiredAlignment:'minion'},
      {id:'cf-demon-info',name:'恶魔信息',note:'确认爪牙并展示三项不在场的善良角色。',phase:'信息',requiredAlignment:'demon'},
      {id:'widow-first',name:'寡妇',note:'展示魔典，选择一名玩家中毒，并让一名善良玩家得知寡妇在场。',roleId:'widow',phase:'行动'},
      {id:'philosopher-first',name:'哲学家',note:'可发动一次性能力，选择一个善良角色并处理醉酒。',roleId:'philosopher',phase:'行动'},
      {id:'cerenovus-first',name:'洗脑师',note:'选择一名玩家和一个善良角色，标记疯狂要求。',roleId:'cerenovus',phase:'行动'},
      {id:'snake-charmer-cf-first',name:'舞蛇人',note:'选择一名存活玩家，检查是否与恶魔交换。',roleId:'snake-charmer',phase:'行动'},
      {id:'grandmother-first',name:'祖母',note:'展示一名善良玩家及其角色，标记孙辈。',roleId:'grandmother',phase:'信息'},
      {id:'dreamer-first',name:'筑梦师',note:'选择一名玩家，展示一个善良角色和一个邪恶角色。',roleId:'dreamer',phase:'信息'},
      {id:'investigator-first',name:'调查员',note:'展示两名玩家及一个爪牙角色。',roleId:'investigator',phase:'信息'},
      {id:'chef-first',name:'厨师',note:'告知邻座邪恶玩家对数。',roleId:'chef',phase:'信息'},
      {id:'fortune-teller-cf-first',name:'占卜师',note:'选择两名玩家，给出是否包含恶魔的信息。',roleId:'fortune-teller',phase:'信息'},
      {id:'balloonist-cf-first',name:'气球驾驶员',note:'展示第一名玩家，记录其角色类型。',roleId:'balloonist',phase:'信息'},
      {id:'godfather-first',name:'教父',note:'告知本局在场的外来者角色。',roleId:'godfather',phase:'信息'},
    ],
    other:[
      {id:'philosopher-other',name:'哲学家',note:'若尚未发动，可选择一个善良角色获得其能力。',roleId:'philosopher',phase:'行动'},
      {id:'cerenovus-other',name:'洗脑师',note:'选择玩家与善良角色，更新疯狂要求。',roleId:'cerenovus',phase:'行动'},
      {id:'pit-hag-cf-other',name:'麻脸巫婆',note:'选择玩家与角色，处理角色变化和可能的任意死亡。',roleId:'pit-hag',phase:'行动'},
      {id:'snake-charmer-cf-other',name:'舞蛇人',note:'选择一名存活玩家，检查是否与恶魔交换。',roleId:'snake-charmer',phase:'行动'},
      {id:'gambler-other',name:'赌徒',note:'选择玩家并猜测角色；猜错则死亡。',roleId:'gambler',phase:'行动'},
      {id:'demon-cf-other',name:'恶魔行动',note:'按当前恶魔能力选择目标并完成死亡与角色变化。',phase:'行动',requiredAlignment:'demon'},
      {id:'godfather-other',name:'教父',note:'若今天有外来者死亡，选择一名玩家使其死亡。',roleId:'godfather',phase:'行动'},
      {id:'ravenkeeper-other',name:'守鸦人',note:'若今夜死亡，选择一名玩家并得知其角色。',roleId:'ravenkeeper',phase:'信息',deadMode:'only'},
      {id:'grandmother-other',name:'祖母',note:'若孙辈被恶魔杀死，处理祖母同时死亡。',roleId:'grandmother',phase:'结算'},
      {id:'dreamer-other',name:'筑梦师',note:'选择玩家并展示一善一恶两个角色。',roleId:'dreamer',phase:'信息'},
      {id:'fortune-teller-cf-other',name:'占卜师',note:'选择两名玩家，给出是否包含恶魔的信息。',roleId:'fortune-teller',phase:'信息'},
      {id:'balloonist-cf-other',name:'气球驾驶员',note:'展示一名尚未展示过角色类型的玩家。',roleId:'balloonist',phase:'信息'},
    ]
  }
}, {
  id:'midnight-oasis', name:'夜半狂欢', author:'Zets', playerRange:[7,15],
  description:'“旋转木马”快速上手剧本：角色变化、阵营转换与说书人裁定集中出现。', counts:standardCounts,
  specialRules:[
    {name:'哨兵',description:'在初始设置时，可能会额外增加或减少一个外来者。'},
    {name:'圣洁之魂',description:'游戏过程中，邪恶玩家的总数最多能比初始设置多一名。'},
  ],
  roles:[
    {id:'noble',name:'贵族',alignment:'townsfolk',timing:'首夜',ability:'在你的首个夜晚，你会得知三名玩家：其中有且只有一名玩家是邪恶的。',misinformation:['展示三名善良玩家。','展示两名邪恶玩家与一名善良玩家。']},
    {id:'snake-charmer',name:'舞蛇人',alignment:'townsfolk',timing:'每夜',ability:'每个夜晚，你要选择一名存活的玩家：如果你选中了恶魔，你和他交换角色和阵营，随后他中毒。'},
    {id:'balloonist',name:'气球驾驶员',alignment:'townsfolk',timing:'每夜',ability:'每个夜晚，你会得知一名与上个夜晚得知的玩家角色类型不同的玩家。',setup:'+0～1 外来者',misinformation:['连续展示相同角色类型。','跳过一种类型，制造错误类型链。']},
    {id:'huntsman',name:'巡山人',alignment:'townsfolk',timing:'一次',ability:'每局游戏限一次，在夜晚时，你可以选择一名存活的玩家：如果你选中了落难少女，她会变成一个不在场的镇民角色。',setup:'+ 落难少女'},
    {id:'engineer',name:'工程师',alignment:'townsfolk',timing:'一次',ability:'每局游戏限一次，在夜晚时，你可以选择让恶魔变成你选择的恶魔角色，或让所有爪牙变成你选择的爪牙角色。'},
    {id:'fisherman',name:'渔夫',alignment:'townsfolk',timing:'白天',ability:'每局游戏限一次，在白天时，你可以让说书人给你一些能帮助你的阵营获胜的建议。'},
    {id:'professor',name:'教授',alignment:'townsfolk',timing:'一次',ability:'每局游戏限一次，在夜晚时*，你可以选择一名死亡的玩家：如果他是镇民，你会将他起死回生（复活）。'},
    {id:'savant',name:'博学者',alignment:'townsfolk',timing:'白天',ability:'每个白天，你可以私下询问说书人以得知两条信息：一个是正确的，一个是错误的。',misinformation:['给出两条都为真但看似冲突的信息。','给出两条都为假且支持同一错误世界的信息。']},
    {id:'amnesiac',name:'失忆者',alignment:'townsfolk',timing:'白天',ability:'你不知道你的能力是什么。每个白天你可以找说书人猜测一次，并得知猜测有多准确。',misinformation:['对接近答案的猜测给出偏低反馈。','对有趣但错误的猜测给出偏高反馈。']},
    {id:'farmer',name:'农夫',alignment:'townsfolk',timing:'被动',ability:'当你在夜晚死亡时，一名存活的善良玩家会变成农夫。'},
    {id:'cannibal',name:'食人族',alignment:'townsfolk',timing:'被动',ability:'你拥有上个死于处决的玩家的能力。如果该玩家属于邪恶阵营，你中毒直到下个善良玩家死于处决。'},
    {id:'poppy-grower',name:'罂粟种植者',alignment:'townsfolk',timing:'被动',ability:'爪牙和恶魔互不认识。如果你死亡，当晚他们会互相认识。'},
    {id:'atheist',name:'无神论者',alignment:'townsfolk',timing:'被动',ability:'说书人可以打破游戏规则。如果说书人被处决，善良阵营获胜，即使你已死亡。',setup:'无邪恶角色在场'},

    {id:'drunk',name:'酒鬼',alignment:'outsider',timing:'被动',ability:'你不知道你是酒鬼。你以为你是一个镇民角色，但其实你不是。'},
    {id:'barber',name:'理发师',alignment:'outsider',timing:'被动',ability:'如果你死亡，在当晚恶魔可以选择两名玩家（不能选择其他恶魔）交换角色。'},
    {id:'golem',name:'魔像',alignment:'outsider',timing:'一次',ability:'每局游戏你只能发起提名一次。当你发起提名时，如果被你提名的玩家不是恶魔，他死亡。'},
    {id:'damsel',name:'落难少女',alignment:'outsider',timing:'被动',ability:'所有爪牙都知道落难少女在场。每局游戏限一次，任意爪牙可以公开猜测你是落难少女；如果猜对，你的阵营落败。'},

    {id:'poisoner',name:'投毒者',alignment:'minion',timing:'每夜',ability:'每个夜晚，你要选择一名玩家：他在当晚和明天白天中毒。'},
    {id:'psychopath',name:'精神病患者',alignment:'minion',timing:'白天',ability:'每个白天，在提名开始前，你可以公开选择一名玩家：他死亡。如果你被处决，提名你的玩家需要和你猜拳，只有你输了你才会死亡。'},
    {id:'spirit-whisperer',name:'灵言师',alignment:'minion',timing:'首夜',ability:'在你的首个夜晚，你会得知一个关键词。首个说出该关键词的善良玩家会在当晚转变为邪恶阵营。'},
    {id:'pit-hag',name:'麻脸巫婆',alignment:'minion',timing:'每夜*',ability:'每个夜晚*，你要选择一名玩家和一个角色：如果该角色不在场，他变成该角色。如果因此创造了一个恶魔，当晚的死亡由说书人决定。'},

    {id:'hadi-jiya',name:'哈迪寂亚',alignment:'demon',timing:'每夜*',ability:'每个夜晚*，你可以选择三名玩家（所有玩家都会得知你选了谁）：他们分别秘密决定自己的生死，然后如果他们都存活则都死亡。'},
    {id:'vigormortis',name:'亡骨魔',alignment:'demon',timing:'每夜*',ability:'每个夜晚*，你要选择一名玩家：他死亡。被该能力杀死的爪牙保留他的能力，且与他邻近的两名镇民之一中毒。',setup:'-1 外来者'},
  ],
  nightOrder:{
    first:[
      {id:'mo-minion-info',name:'爪牙信息',note:'唤醒爪牙，让其互认并确认恶魔。',phase:'信息',requiredAlignment:'minion',skipWhenRolePresent:'poppy-grower'},
      {id:'mo-demon-info',name:'恶魔信息',note:'确认爪牙并展示三项不在场的善良角色。',phase:'信息',requiredAlignment:'demon'},
      {id:'mo-poppy-block',name:'罂粟种植者',note:'确认邪恶阵营本夜不互相认识。',roleId:'poppy-grower',phase:'结算'},
      {id:'mo-spirit-first',name:'灵言师',note:'告知一个关键词。',roleId:'spirit-whisperer',phase:'信息'},
      {id:'poisoner-first',name:'投毒者',note:'选择一名玩家，使其中毒至明天黄昏。',roleId:'poisoner',phase:'行动'},
      {id:'snake-charmer-mo-first',name:'舞蛇人',note:'选择一名存活玩家，检查是否与恶魔交换。',roleId:'snake-charmer',phase:'行动'},
      {id:'engineer-first',name:'工程师',note:'若发动能力，处理全部恶魔或全部爪牙的角色变化。',roleId:'engineer',phase:'行动'},
      {id:'huntsman-mo-first',name:'巡山人',note:'若发动能力，选择一名存活玩家并检查落难少女。',roleId:'huntsman',phase:'行动'},
      {id:'noble-mo-first',name:'贵族',note:'展示三名玩家，其中恰有一名邪恶。',roleId:'noble',phase:'信息'},
      {id:'balloonist-mo-first',name:'气球驾驶员',note:'展示第一名玩家，记录其角色类型。',roleId:'balloonist',phase:'信息'},
    ],
    other:[
      {id:'mo-poppy-death',name:'罂粟种植者',note:'其死亡后，安排邪恶阵营在本夜互相认识。',roleId:'poppy-grower',phase:'结算',deadMode:'only'},
      {id:'poisoner-other',name:'投毒者',note:'选择一名玩家，使其中毒至明天黄昏。',roleId:'poisoner',phase:'行动'},
      {id:'snake-charmer-mo-other',name:'舞蛇人',note:'选择一名存活玩家，检查是否与恶魔交换。',roleId:'snake-charmer',phase:'行动'},
      {id:'engineer-other',name:'工程师',note:'若尚未发动，可改变全部恶魔或全部爪牙角色。',roleId:'engineer',phase:'行动'},
      {id:'huntsman-mo-other',name:'巡山人',note:'若尚未发动，可选择一名玩家检查落难少女。',roleId:'huntsman',phase:'行动'},
      {id:'professor-mo-other',name:'教授',note:'若尚未发动，可选择一名死亡镇民并使其复活。',roleId:'professor',phase:'行动'},
      {id:'pit-hag-mo-other',name:'麻脸巫婆',note:'选择玩家与角色，处理角色变化及可能的任意死亡。',roleId:'pit-hag',phase:'行动'},
      {id:'demon-mo-other',name:'恶魔行动',note:'按哈迪寂亚或亡骨魔能力完成选择与死亡。',phase:'行动',requiredAlignment:'demon'},
      {id:'barber-other',name:'理发师',note:'若理发师死亡，恶魔可选择两名非其他恶魔玩家交换角色。',roleId:'barber',phase:'行动',deadMode:'only'},
      {id:'farmer-other',name:'农夫',note:'若今夜死亡，使一名存活善良玩家变成农夫。',roleId:'farmer',phase:'结算',deadMode:'only'},
      {id:'balloonist-mo-other',name:'气球驾驶员',note:'展示一名与上次角色类型不同的玩家。',roleId:'balloonist',phase:'信息'},
    ]
  }
}];

export const alignmentMeta: Record<Alignment,{label:string;short:string}> = {
  townsfolk:{label:'善良阵营 · 镇民',short:'镇民'}, outsider:{label:'善良阵营 · 外来者',short:'外来者'}, minion:{label:'邪恶阵营 · 爪牙',short:'爪牙'}, demon:{label:'邪恶阵营 · 恶魔',short:'恶魔'},
};
