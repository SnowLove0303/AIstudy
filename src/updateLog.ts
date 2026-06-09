export type UpdateLogEntry = {
  version: string;
  date: string;
  title: string;
  featureUpdates: string[];
  fixes: string[];
  optimizations: string[];
};

export const updateLog: UpdateLogEntry[] = [
  {
    version: "1.0.15",
    date: "2026-06-09",
    title: "快捷键删除分支",
    featureUpdates: ["思维导图支持 Delete/Backspace 快捷键删除选中分支"],
    fixes: ["输入文本时不会误触发分支删除"],
    optimizations: ["删除分支操作更便捷，无需点击工具栏按钮"]
  },
  {
    version: "1.0.14",
    date: "2026-06-09",
    title: "交接同步",
    featureUpdates: ["补充系统交接说明并同步仓库版本"],
    fixes: ["统一源码版本与交接记录"],
    optimizations: ["交接信息覆盖功能、架构、位置和发布路径"]
  },
  {
    version: "1.0.13",
    date: "2026-06-08",
    title: "功能区规整",
    featureUpdates: ["思维导图功能区改为统一标题与按钮排列"],
    fixes: ["减少功能区视觉错位"],
    optimizations: ["工具组高度和按钮宽度更一致"]
  },
  {
    version: "1.0.12",
    date: "2026-06-08",
    title: "控件固定",
    featureUpdates: ["思维导图滑动控件固定在可视编辑区"],
    fixes: ["修复导图内容过高时底部滑动栏不可见"],
    optimizations: ["放大编辑状态下控件位置独立适配"]
  },
  {
    version: "1.0.11",
    date: "2026-06-08",
    title: "放大编辑",
    featureUpdates: ["思维导图新增放大编辑按钮"],
    fixes: ["恢复画布底部左右滑动栏显示"],
    optimizations: ["放大编辑时画布可视空间更大"]
  },
  {
    version: "1.0.10",
    date: "2026-06-08",
    title: "目录滑动",
    featureUpdates: ["课程目录新增上下滑动栏"],
    fixes: ["目录较长时可直接拖动定位"],
    optimizations: ["目录滚动控制更清晰"]
  },
  {
    version: "1.0.9",
    date: "2026-06-08",
    title: "功能区排版",
    featureUpdates: ["思维导图功能区改为规整分组布局"],
    fixes: ["减少功能区分组错位和拥挤"],
    optimizations: ["工具按钮间距和分组边界更统一"]
  },
  {
    version: "1.0.8",
    date: "2026-06-08",
    title: "详情标题",
    featureUpdates: ["课程详情操作栏移除重复课程标题"],
    fixes: ["减少页面顶部重复信息"],
    optimizations: ["课程详情头部空间更紧凑"]
  },
  {
    version: "1.0.7",
    date: "2026-06-08",
    title: "工具栏布局",
    featureUpdates: ["思维导图工具栏改为上下分组展示"],
    fixes: ["减少工具栏横向拖动操作"],
    optimizations: ["工具分组在窄屏下自动换行"]
  },
  {
    version: "1.0.6",
    date: "2026-06-08",
    title: "导图编辑分页",
    featureUpdates: ["思维导图编辑节点不再自动切换目录页"],
    fixes: ["修复章节内新增分支后跳入子分支页"],
    optimizations: ["目录分页和节点编辑选中状态分离"]
  },
  {
    version: "1.0.5",
    date: "2026-06-08",
    title: "目录分页",
    featureUpdates: ["知识笔记按目录切换叶子分支页", "思维导图按目录进入对应分支"],
    fixes: ["修复目录点击后章节切换不生效"],
    optimizations: ["知识笔记页展示当前分支路径"]
  },
  {
    version: "1.0.4",
    date: "2026-06-08",
    title: "知识笔记",
    featureUpdates: ["课程工作区新增知识笔记功能", "知识笔记按思维导图分支生成固定格式"],
    fixes: ["导图分支内容可用于快速复习整理"],
    optimizations: ["笔记标题按分支层级阶梯式排列"]
  },
  {
    version: "1.0.3",
    date: "2026-06-08",
    title: "目录拖拽排序",
    featureUpdates: ["目录支持同级章节拖拽调整顺序"],
    fixes: ["章节顺序调整后同步刷新思维导图"],
    optimizations: ["目录拖拽状态更清晰"]
  },
  {
    version: "1.0.2",
    date: "2026-06-08",
    title: "目录回到主图",
    featureUpdates: ["目录新增主思维导图入口"],
    fixes: ["进入章节后可一键回到课程主导图"],
    optimizations: ["目录选中状态更清晰"]
  },
  {
    version: "1.0.1",
    date: "2026-06-08",
    title: "导图空间优化",
    featureUpdates: ["课程思维导图显示区域扩大"],
    fixes: ["压缩课程详情和工作区顶部功能区高度"],
    optimizations: ["导图工具栏改为更紧凑排版"]
  },
  {
    version: "1.0.0",
    date: "2026-06-08",
    title: "首个交接版本",
    featureUpdates: ["完成课程中心、知识点、课程思维导图、设置和更新管理基础功能"],
    fixes: ["统一当前功能版本为 V1.0.0"],
    optimizations: ["项目源码准备提交到远端仓库"]
  },
  {
    version: "0.22.0",
    date: "2026-06-08",
    title: "快捷键设置",
    featureUpdates: ["设置新增快捷键设置模块", "方向键可控制导图上下左右滑动"],
    fixes: ["方向键在输入内容时不触发画布移动"],
    optimizations: ["快捷键配置本地保存"]
  },
  {
    version: "0.21.0",
    date: "2026-06-08",
    title: "画布滑动控件",
    featureUpdates: ["导图画布新增上下左右滑动控件"],
    fixes: ["滑动控件固定在画布内可视位置"],
    optimizations: ["滑动条与拖动画布保持同一套平移逻辑"]
  },
  {
    version: "0.20.0",
    date: "2026-06-08",
    title: "无限画布",
    featureUpdates: ["思维导图区改为完整无限画布", "拖动模式覆盖整个画布区域"],
    fixes: ["拖动开启后任意位置都可平移导图"],
    optimizations: ["画布背景统一为整块底纹"]
  },
  {
    version: "0.19.0",
    date: "2026-06-08",
    title: "画布平移修正",
    featureUpdates: ["拖动按钮改为平移导图内容"],
    fixes: ["移除滚动式大画布造成的下半区空白"],
    optimizations: ["导图画布不再依赖隐藏滑动块"]
  },
  {
    version: "0.18.0",
    date: "2026-06-08",
    title: "拖动开关",
    featureUpdates: ["功能区新增拖动画布开关"],
    fixes: ["去除导图框下半部分多余画布"],
    optimizations: ["拖动与节点编辑不再互相干扰"]
  },
  {
    version: "0.17.0",
    date: "2026-06-08",
    title: "导图拖动交互",
    featureUpdates: ["导图画布改为直接拖动平移", "隐藏原生横向和纵向滑动块"],
    fixes: ["关系线和概要按钮增加多选提示"],
    optimizations: ["导图交互更接近 Xmind 画布"]
  },
  {
    version: "0.16.0",
    date: "2026-06-08",
    title: "导图工具分层",
    featureUpdates: ["导图工具栏改为上下两行", "新增关系线、概要、标签、备注入口", "支持拖动画布内容"],
    fixes: ["导图画布背景合并为一整块"],
    optimizations: ["工具分区更接近 Xmind 使用方式"]
  },
  {
    version: "0.15.0",
    date: "2026-06-08",
    title: "导图滚动固定",
    featureUpdates: ["导图横向滑动条固定在可视区域底部", "导图区域支持内部上下滚动"],
    fixes: ["无需下滑页面才能看到横向滑动条"],
    optimizations: ["鼠标滚轮优先滚动导图画布"]
  },
  {
    version: "0.14.0",
    date: "2026-06-08",
    title: "流畅性优化",
    featureUpdates: ["优化课程详情切换流畅度", "知识点输入与导图保存改为延迟落盘"],
    fixes: ["减少频繁保存造成的界面卡顿"],
    optimizations: ["导图编辑器按需加载", "窗口内容准备后再显示"]
  },
  {
    version: "0.13.0",
    date: "2026-06-08",
    title: "知识点切换",
    featureUpdates: ["课程详情新增知识点与思维导图切换", "目录固定并共用课程分支"],
    fixes: ["知识点内容按目录节点保存"],
    optimizations: ["课程内容与导图思路分层展示"]
  },
  {
    version: "0.12.0",
    date: "2026-06-08",
    title: "文本标注",
    featureUpdates: ["导图节点新增文本标注工具", "支持选中文字标注和节点标注"],
    fixes: ["标注内容可随导图保存"],
    optimizations: ["标注数据预留后续标注库入口"]
  },
  {
    version: "0.11.0",
    date: "2026-06-08",
    title: "导图文本格式",
    featureUpdates: ["导图节点新增文本格式工具", "支持加粗、文字颜色、背景色和字号"],
    fixes: ["双击编辑时可处理选中文字"],
    optimizations: ["节点格式可随课程导图保存"]
  },
  {
    version: "0.10.0",
    date: "2026-06-08",
    title: "导图排版工具",
    featureUpdates: ["课程导图新增排版工具栏", "支持布局、节点、视图和操作工具"],
    fixes: ["导图常用操作集中到顶部"],
    optimizations: ["导图编辑入口更直观"]
  },
  {
    version: "0.9.0",
    date: "2026-06-08",
    title: "导图横向滑动",
    featureUpdates: ["课程导图新增底部横向滑动条"],
    fixes: ["导图右侧内容可通过滑动查看"],
    optimizations: ["导图画布横向操作更顺手"]
  },
  {
    version: "0.8.0",
    date: "2026-06-08",
    title: "更新管理",
    featureUpdates: ["新增更新管理板块", "版本记录支持折叠查看", "最新版本自动置顶"],
    fixes: ["统一更新记录入口"],
    optimizations: ["更新说明按功能、修复、优化归类"]
  },
  {
    version: "0.7.0",
    date: "2026-06-08",
    title: "课程导图目录",
    featureUpdates: ["课程导图新增分支目录", "点击目录可定位导图节点"],
    fixes: ["目录随导图编辑同步"],
    optimizations: ["导图编辑区向下扩展"]
  },
  {
    version: "0.6.0",
    date: "2026-06-08",
    title: "课程思维导图",
    featureUpdates: ["课程可创建并保存", "课程详情可直接编辑思维导图"],
    fixes: ["课程数据本机持久保存"],
    optimizations: ["课程中心减少说明文案"]
  },
  {
    version: "0.5.0",
    date: "2026-06-08",
    title: "课程中心",
    featureUpdates: ["新增课程中心页面", "新增课程卡片和继续学习入口"],
    fixes: ["虚拟展示数据归零"],
    optimizations: ["课程列表布局更紧凑"]
  },
  {
    version: "0.4.0",
    date: "2026-06-08",
    title: "学习工作台",
    featureUpdates: ["新增学习工作台", "新增指标卡和空状态"],
    fixes: ["修复打包后白屏"],
    optimizations: ["隐藏默认菜单栏"]
  }
];
