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
    version: "1.2.171",
    date: "2026-06-15",
    title: "分支同步逻辑拆分",
    featureUpdates: ["分支思维导图继续按当前 nodeId 保存并与主思维导图保持可控同步"],
    fixes: ["降低分支缓存、父级回写和子分支同步互相影响导致目录关系异常的风险"],
    optimizations: ["分支保存、缓存新鲜度和同步边界统一收口到课程领域逻辑"]
  },
  {
    version: "1.2.170",
    date: "2026-06-15",
    title: "目录面板组件拆分",
    featureUpdates: ["目录、知识点和思维导图继续按同一 nodeId 保持联动"],
    fixes: ["降低目录展示代码和课程底层关联逻辑混在一起导致改动互相影响的风险"],
    optimizations: ["左侧目录面板拆为独立组件，底层关联判断继续由领域逻辑统一提供"]
  },
  {
    version: "1.2.169",
    date: "2026-06-15",
    title: "课程关联逻辑拆分",
    featureUpdates: ["目录、知识点和思维导图继续通过同一 nodeId 保持联动"],
    fixes: ["减少目录导航、父级知识点显示和折叠定位逻辑散落在界面层导致的连锁风险"],
    optimizations: ["将知识点可选性、上下页导航、父子级查找和内容判断抽到独立领域逻辑"]
  },
  {
    version: "1.2.168",
    date: "2026-06-15",
    title: "课程状态写入收口",
    featureUpdates: ["课程库的目录、分支、知识点和笔记保存入口统一经过状态规则层"],
    fixes: ["降低单个功能改动绕过底层规则导致目录、缓存或知识内容互相覆盖的风险"],
    optimizations: ["课程加载、保存和界面更新共享同一套目录快照、折叠和分支缓存校验逻辑"]
  },
  {
    version: "1.2.167",
    date: "2026-06-14",
    title: "分支缓存回流保护",
    featureUpdates: ["目录继续按主思维导图实时同步删除和新增的子级"],
    fixes: ["修复旧分支缓存可能在切换或保存后把已删除子级重新写回的问题"],
    optimizations: ["课程保存和启动加载会清理与主图结构不一致的分支缓存"]
  },
  {
    version: "1.2.166",
    date: "2026-06-14",
    title: "父子级折叠结构恢复",
    featureUpdates: ["恢复股票分配相关目录的真实父子级子节点结构"],
    fixes: ["修复分支折叠标题残留覆盖主目录节点，导致条件、原则、顺序等子级关系丢失的问题"],
    optimizations: ["课程库检查新增关键股票子级节点守卫，防止分支缓存再次吞掉真实目录节点"]
  },
  {
    version: "1.2.165",
    date: "2026-06-14",
    title: "分支目录标题同步",
    featureUpdates: ["分支思维导图中编辑已有子级标题后，左侧目录会同步显示新名称"],
    fixes: ["修复目录冻结编号时误把节点标题也冻结，导致父子级子目录名称与导图不一致的问题"],
    optimizations: ["课程库检查新增目录快照标题同步守卫，防止后续改动再次冻结节点名称"]
  },
  {
    version: "1.2.164",
    date: "2026-06-14",
    title: "更新发布流程标准化",
    featureUpdates: ["更新管理新增发布草稿检查和确认发布入口"],
    fixes: ["修正更新管理把每个修补点都展开成独立版本卡片的问题"],
    optimizations: ["发布前会校验 Git、版本记录、安装包、blockmap、latest.yml 和远端 Release 状态，降低无法回滚风险"]
  },
  {
    version: "1.2.163",
    date: "2026-06-14",
    title: "更新源不可访问提示",
    featureUpdates: ["更新检测会先确认 GitHub Releases 是否可访问"],
    fixes: ["修复私有仓库或未发布 Release 时直接显示 GitHub 404 原始报错的问题"],
    optimizations: ["更新管理会提示公开发布源和 latest.yml 要求，便于排查 B 设备无法更新的问题"]
  },
  {
    version: "1.2.162",
    date: "2026-06-14",
    title: "应用自动更新检测",
    featureUpdates: ["更新管理新增 GitHub Releases 版本检测、下载更新和重启安装入口"],
    fixes: ["补齐主进程、预加载和页面之间的更新状态同步"],
    optimizations: ["新增无服务器发版流程，推送版本标签后可自动生成更新安装包"]
  },
  {
    version: "1.2.161",
    date: "2026-06-14",
    title: "课程库底层规则固化",
    featureUpdates: ["课程库核心逻辑检查升级为硬规则验收，逐条校验测试知识库与说明文档一致"],
    fixes: ["补强目录父子级、父级知识点、分支写回、折叠优先和自动提纲标记的源码检查"],
    optimizations: ["后续修改课程库时可直接运行检查命令确认底层逻辑没有偏离"]
  },
  {
    version: "1.2.160",
    date: "2026-06-14",
    title: "课程库核心逻辑检查",
    featureUpdates: ["新增课程库核心逻辑检查命令，覆盖目录、知识点、分支和持久化一致性"],
    fixes: ["将分支错位、目录快照改父级、自动提纲串页等问题纳入系统检查"],
    optimizations: ["系统检查会同步校验课程 JSON 与 MySQL 摘要，减少截图排查成本"]
  },
  {
    version: "1.2.159",
    date: "2026-06-14",
    title: "目录折叠回弹修复",
    featureUpdates: ["折叠包含当前知识点的父级目录时，自动切到该父级提纲页"],
    fixes: ["修复手动折叠目录后被知识点定位逻辑立即展开的问题"],
    optimizations: ["用户手动折叠优先于自动定位，减少目录状态互相抢占"]
  },
  {
    version: "1.2.158",
    date: "2026-06-14",
    title: "分支保存错位修复",
    featureUpdates: ["非末级目录无正文时自动显示当前分支的下级提纲"],
    fixes: ["修复分支画布切换后可能写回到错误父级，导致目录父子级错位的问题"],
    optimizations: ["自动生成的父级提纲在未编辑前不落成正文，避免旧缓存跨节点串页"]
  },
  {
    version: "1.2.157",
    date: "2026-06-14",
    title: "目录父子级格式恢复",
    featureUpdates: ["恢复课程目录的冻结编号、父子级层级和默认折叠状态"],
    fixes: ["修复旧本地缓存导致目录数量和层级格式异常回流的问题"],
    optimizations: ["课程目录格式状态同步写入本地文件和 MySQL，重启后保持一致"]
  },
  {
    version: "1.2.156",
    date: "2026-06-14",
    title: "课程主目录恢复",
    featureUpdates: ["恢复金融市场基础知识完整主目录，股票回到第四章股票下的原层级"],
    fixes: ["修复分支导图切换或关闭时可能覆盖课程主思维导图的问题"],
    optimizations: ["保存导图时按画布根节点识别主图与分支，降低目录和内容错位风险"]
  },
  {
    version: "1.2.155",
    date: "2026-06-14",
    title: "知识点目录联动修复",
    featureUpdates: ["从思维导图切回知识点时，空目录项会回到最近的已有正文上级页"],
    fixes: ["修复父级页已有内容却因子目录选中而显示空白的问题"],
    optimizations: ["有正文的父级页不再被父级页开关隐藏，保留空叶子页的新建编辑能力"]
  },
  {
    version: "1.2.154",
    date: "2026-06-14",
    title: "知识点切换显示修复",
    featureUpdates: ["从思维导图或目录切回知识点时，空父级页会自动进入下方已有正文的知识点"],
    fixes: ["修复点击父级目录后切换到知识点，右侧正文区域误显示为空的问题"],
    optimizations: ["保留空叶子知识点的新建编辑能力，只对空父级目录做内容定位"]
  },
  {
    version: "1.2.153",
    date: "2026-06-14",
    title: "知识点内容定位修复",
    featureUpdates: ["进入知识点模式时自动定位到已有正文的知识点，并展开所在目录"],
    fixes: ["修复停留在主思维导图根节点导致目录有数据但正文区域空白的问题"],
    optimizations: ["父级目录关闭时自动避开不可编辑父级页，减少知识点内容被误认为丢失的情况"]
  },
  {
    version: "1.2.152",
    date: "2026-06-14",
    title: "知识点底层逻辑整理",
    featureUpdates: ["知识点工作区的课程类型、导图目录、分支导图和笔记派生逻辑拆分为独立底层模块"],
    fixes: ["减少知识点功能和排版调整时误改主界面大文件导致的联动风险"],
    optimizations: ["课程规范化、HTML 转义和导图工具函数集中维护，后续排版改动更容易定位影响范围"]
  },
  {
    version: "1.2.151",
    date: "2026-06-14",
    title: "系统功能关系梳理",
    featureUpdates: ["新增系统功能关系文档，梳理导航、课程库、开发平台、工作区、AI 问答、端口和数据流关系"],
    fixes: ["补充系统边界检查命令，提前发现旁路发布目录、旧沙箱脚本、版本记录和 IPC 边界不一致问题"],
    optimizations: ["项目索引和 README 增加共享工作区变更守则，后续改功能先按影响面验证"]
  },
  {
    version: "1.2.150",
    date: "2026-06-14",
    title: "系统入口与沙箱清理",
    featureUpdates: ["系统固定为唯一默认发布入口，所有本机运行统一使用 release\\win-unpacked\\AIstudy.exe"],
    fixes: ["清理旧 Claude 内容沙箱和历史旁路发布目录，避免运行到旧版本或重复系统"],
    optimizations: ["项目说明和索引改为单一数据边界与统一打包流程，后续功能修改优先走共享底层逻辑"]
  },
  {
    version: "1.2.149",
    date: "2026-06-14",
    title: "思维导图分支打开增强",
    featureUpdates: ["父级目录进入分支导图时优先使用当前主导图实时内容"],
    fixes: ["修复第四章股票等分支受旧缓存、父级页关闭或折叠状态影响无法打开的问题"],
    optimizations: ["分支、主图和跨分支定位统一使用可读默认缩放"]
  },
  {
    version: "1.2.148",
    date: "2026-06-14",
    title: "思维导图分支与默认视图修复",
    featureUpdates: ["思维导图目录中的父级分支可直接打开独立分支画布"],
    fixes: ["修复第四章股票等有下级分支点击后仍停留在主导图的问题"],
    optimizations: ["主思维导图默认使用可读缩放，不再把整张大图压缩到过小比例"]
  },
  {
    version: "1.2.147",
    date: "2026-06-14",
    title: "ChatGPT 回复提取修复",
    featureUpdates: ["ChatGPT 问答继续复用已登录 Chrome 页面"],
    fixes: ["修复 ChatGPT 已回答但聊天窗只显示空标签的问题"],
    optimizations: ["按最后一条用户消息后的回答块读取内容，减少推荐问题和输入提示干扰"]
  },
  {
    version: "1.2.146",
    date: "2026-06-14",
    title: "ChatGPT 直连清理",
    featureUpdates: ["ChatGPT 选项统一使用已登录 Chrome 端口直连"],
    fixes: ["移除界面和主进程中旧的本机桥接提示，避免继续要求启动脚本"],
    optimizations: ["端口管理仅显示 Chrome 登录窗口状态，和 Doubao 的使用方式保持一致"]
  },
  {
    version: "1.2.145",
    date: "2026-06-14",
    title: "ChatGPT 旧桥接兜底",
    featureUpdates: ["ChatGPT 问答残留入口统一改为已登录 Chrome 端口直连"],
    fixes: ["修复旧入口仍提示需要启动 8000 本机桥接的问题"],
    optimizations: ["ChatGPT 所有问答路径都复用 9230 CDP 会话，减少端口混用"]
  },
  {
    version: "1.2.144",
    date: "2026-06-14",
    title: "ChatGPT 已登录端口直连",
    featureUpdates: ["AI 聊天的 ChatGPT 选项改为复用当前已登录 Chrome 9230 端口"],
    fixes: ["修复 ChatGPT 误走 8000 本机桥接或临时浏览器导致登录态、端口和回复不一致的问题"],
    optimizations: ["ChatGPT 问答改用与 Doubao 一致的 CDP 后台发送和回复读取流程"]
  },
  {
    version: "1.2.143",
    date: "2026-06-14",
    title: "ChatGPT 桥接连续问答修复",
    featureUpdates: ["ChatGPT 网页桥接继续按 Notion 方案使用本机 8000 接口"],
    fixes: ["修复连续第二次请求时 ChatGPT 输入框被浮层遮挡导致桥接返回失败的问题"],
    optimizations: ["输入框聚焦增加强制点击和页面焦点兜底，提升网页桥接稳定性"]
  },
  {
    version: "1.2.142",
    date: "2026-06-14",
    title: "ChatGPT 默认 Chrome 登录",
    featureUpdates: ["ChatGPT 登录窗口默认改为复用系统 Chrome 登录态"],
    fixes: ["修复登录入口误用豆包端口或临时 Chrome 窗口的问题"],
    optimizations: ["仅在显式配置 ChatGPT 登录端口时才走 CDP 端口，否则直接使用当前默认 Chrome"]
  },
  {
    version: "1.2.141",
    date: "2026-06-14",
    title: "ChatGPT 本机 Chrome 端口复用",
    featureUpdates: ["ChatGPT 登录窗口优先复用本机 Chrome 端口打开，支持通过环境变量切换端口"],
    fixes: ["修复 ChatGPT 登录入口反复拉起临时浏览器并卡在 Google 验证窗口的问题"],
    optimizations: ["打开登录页时不再暂停本机桥接服务，减少端口状态和登录窗口互相干扰"]
  },
  {
    version: "1.2.140",
    date: "2026-06-14",
    title: "ChatGPT 登录直启",
    featureUpdates: ["ChatGPT 端口管理登录按钮改为直接打开网页登录浏览器"],
    fixes: ["修复通过 PowerShell 间接启动时网页登录窗口可能没有出现的问题"],
    optimizations: ["登录窗口直接复用 CatGPT 本机 Python 环境和浏览器登录态目录"]
  },
  {
    version: "1.2.139",
    date: "2026-06-14",
    title: "ChatGPT 登录窗口修复",
    featureUpdates: ["ChatGPT 端口管理登录窗口改为可见并保持打开"],
    fixes: ["修复从 AIstudy 点击 ChatGPT 打开登录窗口后无反应的问题"],
    optimizations: ["打开登录窗口前自动暂停 ChatGPT 桥接，避免登录态目录被占用"]
  },
  {
    version: "1.2.138",
    date: "2026-06-14",
    title: "ChatGPT 端口管理",
    featureUpdates: ["信息搜集端口管理新增 ChatGPT 桥接卡片"],
    fixes: ["ChatGPT 登录态目录和 8000 本机接口状态可在端口管理中查看"],
    optimizations: ["ChatGPT 支持在端口管理中启动桥接服务和打开登录窗口"]
  },
  {
    version: "1.2.137",
    date: "2026-06-14",
    title: "Doubao 回复对齐修复",
    featureUpdates: ["Doubao 问答按本次新增助手回复回填到聊天窗口"],
    fixes: ["修复短回复或用户问题回声被误判为上一轮结果的问题"],
    optimizations: ["等待新增助手回复稳定后再返回，减少回复内容错位"]
  },
  {
    version: "1.2.136",
    date: "2026-06-14",
    title: "ChatGPT 聊天选项",
    featureUpdates: ["知识点 AI 聊天新增 ChatGPT 选项，可切换到本机 ChatGPT 浏览器桥接回答"],
    fixes: ["补齐 AI 聊天模型选择中的 ChatGPT 通道提示与错误反馈"],
    optimizations: ["ChatGPT 回答复用现有问答与编辑解析流程，保持聊天窗口展示一致"]
  },
  {
    version: "1.2.135",
    date: "2026-06-14",
    title: "Doubao 功能区边界",
    featureUpdates: ["Doubao 问答按页面功能区结构区分回复和推荐问题"],
    fixes: ["修复个性化推荐问题被当作正式回复返回的问题"],
    optimizations: ["优先读取助手消息功能区之前的正文，功能区之后内容不再参与回复提取"]
  },
  {
    version: "1.2.134",
    date: "2026-06-14",
    title: "Doubao 新增回复提取",
    featureUpdates: ["Doubao 问答改为只解析本次发送后新增的回复内容"],
    fixes: ["修复历史消息、重复短文本和推荐追问混入当前回复的问题"],
    optimizations: ["发送前记录页面文本边界，发送后按新增尾部内容提取助手回答"]
  },
  {
    version: "1.2.133",
    date: "2026-06-14",
    title: "Doubao 重复问答边界",
    featureUpdates: ["Doubao 问答在问题和回答文字相同时仍能提取正确回复"],
    fixes: ["修复用户输入与豆包回答相同导致回复边界落到答案后方的问题"],
    optimizations: ["完整提示词边界优先于用户文本边界，减少推荐追问误入回复"]
  },
  {
    version: "1.2.132",
    date: "2026-06-14",
    title: "ChatGPT 浏览器桥接方案",
    featureUpdates: ["新增 ChatGPT 浏览器桥接的本机启动脚本和嵌入说明"],
    fixes: ["明确无 Docker 运行时改用源码可运行的浏览器桥接方案"],
    optimizations: ["记录本地接口、模型名、登录态目录和 AI 聊天接入位置"]
  },
  {
    version: "1.2.131",
    date: "2026-06-14",
    title: "Doubao 后台问答",
    featureUpdates: ["Doubao 问答发起后尽量保持 Chrome 在后台运行"],
    fixes: ["移除发起问答时强制把豆包 Chrome 拉到桌面前台的逻辑"],
    optimizations: ["继续通过 CDP 后台发送问题和读取回复，减少对当前操作窗口的打断"]
  },
  {
    version: "1.2.130",
    date: "2026-06-14",
    title: "Doubao 问题定位修复",
    featureUpdates: ["Doubao 问答按用户原文定位本次回复"],
    fixes: ["修复从提示词解析问题失败导致仍误取推荐追问的问题"],
    optimizations: ["用户问题单独传入抓取脚本，减少中文分隔符和页面文本差异影响"]
  },
  {
    version: "1.2.129",
    date: "2026-06-14",
    title: "Doubao 短回复提取",
    featureUpdates: ["Doubao 问答支持正确显示重复出现的短回复"],
    fixes: ["修复相同短回复被旧消息去重吞掉后误显示推荐追问的问题"],
    optimizations: ["回复提取改为截取本次提问后的正文，遇到免责声明和推荐追问自动停止"]
  },
  {
    version: "1.2.128",
    date: "2026-06-14",
    title: "Doubao 推荐追问过滤",
    featureUpdates: ["Doubao 问答优先展示正式回答内容"],
    fixes: ["修复豆包推荐追问覆盖实际回复的问题"],
    optimizations: ["按回答特征对页面候选内容排序，短问句追问不再作为最终回复"]
  },
  {
    version: "1.2.127",
    date: "2026-06-13",
    title: "Doubao 回复净化",
    featureUpdates: ["知识点 AI 聊天的 Doubao 回复只展示豆包实际回答"],
    fixes: ["修复程序侧回复夹带提示词、课程信息和推荐追问的问题"],
    optimizations: ["缩短 Doubao 回复稳定等待时间，优先读取最新助手消息"]
  },
  {
    version: "1.2.126",
    date: "2026-06-13",
    title: "Doubao 问答接入",
    featureUpdates: ["知识点 AI 聊天新增 Doubao 选项，可复用端口管理中的豆包登录态进行问答"],
    fixes: ["豆包仅作为问答工具返回结果，不触发知识点自动写回"],
    optimizations: ["端口管理新增 Doubao 9224 登录窗口，AI 聊天通过本地 CDP 会话发送问题并等待完整回复"]
  },
  {
    version: "1.2.125",
    date: "2026-06-13",
    title: "Claude 内容沙箱",
    featureUpdates: ["Claude Code 改为使用独立内容沙箱，内容草稿统一写入沙箱 outbox"],
    fixes: ["移除项目代码锁的密码依赖，避免内容编写流程被密码状态阻断"],
    optimizations: ["Claude 项目权限限制源码、构建产物和发布包写入，filesystem MCP 仅暴露内容沙箱目录"]
  },
  {
    version: "1.2.124",
    date: "2026-06-13",
    title: "项目代码锁",
    featureUpdates: ["项目新增本地代码锁，可用密码保护源码和程序配置文件"],
    fixes: ["降低外部 AI 会话误改项目程序文件的风险"],
    optimizations: ["课程内容数据和运行产物保持可写，便于继续让 AI 辅助编写知识内容"]
  },
  {
    version: "1.2.123",
    date: "2026-06-13",
    title: "导图底部留白修复",
    featureUpdates: ["思维导图初始画布继续保持根节点居中显示"],
    fixes: ["修复新建小导图底部出现额外空白、横向拖动条落在画布外的问题"],
    optimizations: ["画布拖动控制条改为贴合导图区域内部定位，目录和画布高度跟随页面剩余空间"]
  },
  {
    version: "1.2.122",
    date: "2026-06-13",
    title: "AI日报任务管理",
    featureUpdates: ["AI日报生成设置新增知乎文章来源，可输入指定知乎链接生成日报", "AI日报页新增自动任务管理，可按渠道和执行时间管理转录任务"],
    fixes: ["压缩最近日报信息卡高度，减少结果区域首屏占用"],
    optimizations: ["自动任务支持启停和删除，日报信息根据 Bilibili 或知乎来源展示对应字段"]
  },
  {
    version: "1.2.121",
    date: "2026-06-13",
    title: "初始导图高度",
    featureUpdates: ["新建课程和需求的初始导图会按完整工作区高度展示"],
    fixes: ["修复小导图首次打开时节点停在顶部、目录和画布视觉高度不一致的问题"],
    optimizations: ["进入导图根视图时自动适配并居中，保持目录区域与画布区域等高"]
  },
  {
    version: "1.2.120",
    date: "2026-06-13",
    title: "新建导图修复",
    featureUpdates: ["新建课程和需求文档会自动生成首个目录分支"],
    fixes: ["修复新建后知识笔记、需求笔记和导图页面显示暂无分支的问题"],
    optimizations: ["旧的空导图数据打开时会自动补齐默认分支，目录和导图使用同一份节点数据"]
  },
  {
    version: "1.2.119",
    date: "2026-06-13",
    title: "创建入口修复",
    featureUpdates: ["课程库和开发平台的创建入口恢复创建后直接进入编辑页"],
    fixes: ["修复数据库异步加载可能覆盖刚创建课程或需求的问题"],
    optimizations: ["补充创建回归验证，覆盖课程库和开发平台两套独立存储"]
  },
  {
    version: "1.2.118",
    date: "2026-06-13",
    title: "平台底层索引",
    featureUpdates: ["课程库和开发平台改为通过同一套平台索引驱动"],
    fixes: ["收拢两套重复的数据加载、保存和页面状态逻辑，仅保留数据库来源差异"],
    optimizations: ["后续修改导图、目录、正文编辑等共用功能时，可在同一套底层代码中维护"]
  },
  {
    version: "1.2.117",
    date: "2026-06-13",
    title: "开发平台入口",
    featureUpdates: ["侧边导航新增开发平台，用于创建和编写需求文档"],
    fixes: ["开发平台数据接入独立存储，不与课程库数据混用"],
    optimizations: ["复用课程库的导图、目录和正文编辑能力，并切换为需求文档文案"]
  },
  {
    version: "1.2.116",
    date: "2026-06-13",
    title: "AI日报信息折叠",
    featureUpdates: ["AI日报结果改为单个信息卡展示基本信息和内容摘要"],
    fixes: ["移除默认展示的内容分段和整理状态框，减少页面纵向占用"],
    optimizations: ["重点内容收进详情折叠区，日报结果首屏更紧凑"]
  },
  {
    version: "1.2.115",
    date: "2026-06-13",
    title: "知识点滚动保持",
    featureUpdates: ["知识点 Word 工具栏排版操作会保持当前阅读位置"],
    fixes: ["修复修改前文格式后视图自动跳到后文段落的问题"],
    optimizations: ["格式命令、字距和格式刷操作统一保护编辑区滚动位置"]
  },
  {
    version: "1.2.114",
    date: "2026-06-13",
    title: "AI日报折叠呈现",
    featureUpdates: ["AI日报结果改为基本信息、中文摘要、重点整理、内容分段的折叠式展示"],
    fixes: ["修正日报内容硬截断、半角标点、繁体字和常见转录误识别导致的阅读问题"],
    optimizations: ["日报产物新增结构化摘要、清洗后转录和整理状态，长文本排版更适合阅读"]
  },
  {
    version: "1.2.113",
    date: "2026-06-13",
    title: "复用式格式刷",
    featureUpdates: ["知识点 Word 工具栏新增独立复用式格式刷按钮"],
    fixes: ["普通格式刷保持单次应用，复用式格式刷可连续应用到多个选区"],
    optimizations: ["复用式按钮使用独立角标，Esc 或关闭按钮可退出连续刷格式状态"]
  },
  {
    version: "1.2.112",
    date: "2026-06-13",
    title: "AI日报生成面板",
    featureUpdates: ["AI日报页面新增视频日报生成面板，可填写 BV 号并启动生成"],
    fixes: ["打包资源新增脚本外置副本，确保桌面版也能调用 AI日报工作流"],
    optimizations: ["最近日报会显示标题、重点、分段数，并可直接打开 Markdown 或 HTML 产物"]
  },
  {
    version: "1.2.111",
    date: "2026-06-13",
    title: "知识点格式刷",
    featureUpdates: ["知识点 Word 工具栏新增格式刷按钮，支持复制并应用选区格式"],
    fixes: ["补齐 Canvas 知识点编辑器缺少格式刷入口的问题"],
    optimizations: ["格式刷支持单次应用、双击连续应用和 Esc 退出"]
  },
  {
    version: "1.2.110",
    date: "2026-06-13",
    title: "系统说明同步",
    featureUpdates: ["README 同步到当前信息搜集、端口管理、AI日报和知识点 Word 内核状态"],
    fixes: ["补齐新增脚本、调试工具、Electron IPC 和本机存储路径说明"],
    optimizations: ["系统说明按功能模块、数据存储、验证流程和排障入口重新整理"]
  },
  {
    version: "1.2.109",
    date: "2026-06-13",
    title: "AI日报自动化工作流",
    featureUpdates: ["新增 Bilibili 视频到 AI日报的自动化脚本入口"],
    fixes: ["工作流产物按运行目录保存，避免下载、转录和日报文件混在一起"],
    optimizations: ["日报生成同时输出 Markdown、HTML 和 manifest，便于后续页面接入"]
  },
  {
    version: "1.2.108",
    date: "2026-06-13",
    title: "AI日报入口",
    featureUpdates: ["信息搜集顶部导航新增 AI日报 板块入口"],
    fixes: ["AI日报切换后保持独立空白页面，不影响端口管理内容"],
    optimizations: ["信息搜集顶部导航支持多板块切换，便于后续接入日报功能"]
  },
  {
    version: "1.2.107",
    date: "2026-06-13",
    title: "端口管理登录窗口",
    featureUpdates: ["信息搜集的端口管理新增 Bilibili 与知乎登录窗口入口"],
    fixes: ["端口状态由 Electron 后端检测，避免页面误判登录端口是否可用"],
    optimizations: ["两个平台使用独立 Chrome profile 和固定 CDP 端口，减少登录态互相影响"]
  },
  {
    version: "1.2.106",
    date: "2026-06-13",
    title: "信息搜集顶部导航",
    featureUpdates: ["信息搜集页面新增顶部导航栏，并加入端口管理板块"],
    fixes: ["端口管理内容区保持空白，避免提前展示未接入功能"],
    optimizations: ["顶部导航使用独立横向样式，便于后续扩展更多信息搜集板块"]
  },
  {
    version: "1.2.105",
    date: "2026-06-13",
    title: "信息搜集入口",
    featureUpdates: ["侧边导航新增信息搜集入口"],
    fixes: ["新增页面保持空白状态，便于后续接入信息搜集功能"],
    optimizations: ["信息搜集入口放置在更新管理下方，保持导航分组清晰"]
  },
  {
    version: "1.2.104",
    date: "2026-06-13",
    title: "知识点间距字号细化",
    featureUpdates: ["知识点字间距、段间距和字号下拉项增加更细档位"],
    fixes: ["补充紧凑字距、小字号和大字号选项，减少正文调节跨度过大的问题"],
    optimizations: ["字距与段距选项显示具体数值，便于连续微调排版"]
  },
  {
    version: "1.2.103",
    date: "2026-06-13",
    title: "知识点排版选区修复",
    featureUpdates: ["知识点排版工具会复用编辑器最后一次有效选区"],
    fixes: ["修复点击工具栏后加粗、颜色、字号、对齐等命令因选区丢失而失效的问题"],
    optimizations: ["工具按钮点击不再抢走正文焦点，下拉类排版命令执行前会恢复选区"]
  },
  {
    version: "1.2.102",
    date: "2026-06-13",
    title: "知识点间距调节",
    featureUpdates: ["知识点工具栏新增字间距和段间距调节"],
    fixes: ["恢复横向文档默认段距，减少正文被拉得过散的问题"],
    optimizations: ["旧版知识点文档首次打开时自动归正过大的间距和拉伸对齐"]
  },
  {
    version: "1.2.101",
    date: "2026-06-13",
    title: "知识点横向连续页",
    featureUpdates: ["知识点文档改为横向连续编辑视图"],
    fixes: ["取消纵向分页造成的单页幻灯片观感，正文可持续向下延展"],
    optimizations: ["旧知识点内容迁移到横向宽版时使用更宽的换行宽度"]
  },
  {
    version: "1.2.100",
    date: "2026-06-13",
    title: "知识点 Word 内核嵌入",
    featureUpdates: ["知识点库嵌入类 Word 文档编辑器，支持分页、字体、字号、颜色、列表、表格、分页和打印"],
    fixes: ["替换旧正文编辑内核，降低加粗、字号和颜色等排版命令互相污染的概率"],
    optimizations: ["知识点同时保存文档结构和兼容 HTML，并可从工具栏插入当前思维导图分支"]
  },
  {
    version: "1.2.99",
    date: "2026-06-13",
    title: "知识点文字样式开关",
    featureUpdates: ["知识点字体颜色新增常用色按钮组，点击即可应用到选中文本"],
    fixes: ["斜体、下划线和删除线统一支持再次点击取消，表现与加粗一致"],
    optimizations: ["文字样式写入优先复用现有内联节点，减少重复嵌套导致的样式残留"]
  },
  {
    version: "1.2.98",
    date: "2026-06-13",
    title: "知识点排版日志排查",
    featureUpdates: ["新增知识点排版调试日志，记录工具命令、选区和保存结果"],
    fixes: ["修复文字排版后立即规范化编辑区导致后续按钮失效的问题"],
    optimizations: ["新增独立排版推演页，覆盖加粗回撤、字号、字体、颜色和装饰线等操作"]
  },
  {
    version: "1.2.97",
    date: "2026-06-13",
    title: "知识点排版规则固化",
    featureUpdates: ["知识点段间距和字间距改为编辑器统一控制，不随字号调整变化"],
    fixes: ["修复文字类排版命令可能改动段落结构并产生空行的问题"],
    optimizations: ["保存时只保留必要的文字差异格式，减少普通格式被固化为不可修改基准的情况"]
  },
  {
    version: "1.2.96",
    date: "2026-06-13",
    title: "知识点字号修复",
    featureUpdates: ["知识点字号调整改为只作用于选中文本"],
    fixes: ["修复调整字号时选区上下生成空行的问题"],
    optimizations: ["字号下拉框减少重复触发，避免一次选择产生多次排版写入"]
  },
  {
    version: "1.2.95",
    date: "2026-06-13",
    title: "知识点格式重置",
    featureUpdates: ["已有知识点内容已清空历史排版格式，回到无内联样式的初始正文状态"],
    fixes: ["修复全选加粗后再次点击加粗无法取消，以及全选排版后段首出现空格的问题"],
    optimizations: ["取消排版时优先移除对应样式，保存时自动裁剪段首段尾空白"]
  },
  {
    version: "1.2.94",
    date: "2026-06-13",
    title: "知识点排版命令拆分",
    featureUpdates: ["知识点文本排版拆分为独立命令，粗体、斜体、下划线、删除线、颜色、列表、缩进和清除格式分开处理"],
    fixes: ["修复普通正文、标题正文混合选区在重复点击排版按钮时状态判断混乱的问题"],
    optimizations: ["保存时自动清理与段落样式重复的内联标签，减少历史样式残留对后续排版的影响"]
  },
  {
    version: "1.2.93",
    date: "2026-06-13",
    title: "知识点文本工具重构",
    featureUpdates: ["知识点粗体、斜体、下划线、删除线改为可再次点击取消"],
    fixes: ["修复加粗只能开启不能关闭，以及 Ctrl+X 被错误占用导致剪切不可用的问题"],
    optimizations: ["列表、缩进、清除格式和插入内容统一使用知识点选区命令，减少浏览器排版命令的不稳定影响"]
  },
  {
    version: "1.2.92",
    date: "2026-06-13",
    title: "知识点排版内核统一",
    featureUpdates: ["知识点加粗、斜体、下划线、删除线和对齐统一使用稳定排版写入"],
    fixes: ["修复工具栏切换焦点后部分选区格式没有真正落到正文的问题"],
    optimizations: ["编辑区在选择变化时持续记忆选区，减少排版按钮、字体和颜色操作丢失选区的情况"]
  },
  {
    version: "1.2.91",
    date: "2026-06-13",
    title: "知识点编辑内核重构",
    featureUpdates: ["知识点加粗使用稳定选区样式写入"],
    fixes: ["修复历史嵌套样式导致加粗、字号和颜色继续叠加污染正文的问题"],
    optimizations: ["保存知识点时自动压平内联样式，减少冗余标签并提升后续排版稳定性"]
  },
  {
    version: "1.2.90",
    date: "2026-06-13",
    title: "类型页加粗重构",
    featureUpdates: ["知识点加粗改为稳定写入选区样式"],
    fixes: ["修复股票类型知识点历史样式嵌套导致整页加粗不明显的问题"],
    optimizations: ["清理类型页冗余样式，并在保存时简化重复的样式标签"]
  },
  {
    version: "1.2.89",
    date: "2026-06-13",
    title: "性质页样式修复",
    featureUpdates: ["股票性质知识点恢复可区分粗细的正文样式"],
    fixes: ["修复性质页历史样式嵌套过深导致普通正文加粗无明显变化的问题"],
    optimizations: ["清理性质页冗余样式标签，保留短标题加粗显示"]
  },
  {
    version: "1.2.88",
    date: "2026-06-13",
    title: "颜色区回撤",
    featureUpdates: ["知识点文字颜色和背景颜色恢复为原生取色器"],
    fixes: ["回撤常用色板及后续排版工具改动，恢复原先排版工具交互"],
    optimizations: ["工具栏恢复原有横向滚动方式，减少颜色面板对排版操作的干扰"]
  },
  {
    version: "1.2.87",
    date: "2026-06-13",
    title: "加粗显示增强",
    featureUpdates: ["知识点加粗改为更明显的重字重样式"],
    fixes: ["修复局部文字加粗后视觉变化不明显的问题"],
    optimizations: ["保存知识点时压平重复嵌套的相同样式，减少连续排版产生的冗余标签"]
  },
  {
    version: "1.2.86",
    date: "2026-06-13",
    title: "加粗样式稳定修复",
    featureUpdates: ["知识点加粗、斜体、下划线和删除线改为直接应用到选区"],
    fixes: ["修复部分正文选区点击加粗后只激活按钮但文字样式没有写入的问题"],
    optimizations: ["文字样式按钮与颜色、字号使用同一套选区处理方式"]
  },
  {
    version: "1.2.85",
    date: "2026-06-13",
    title: "排版工具实机修复",
    featureUpdates: ["知识点排版按钮改为按下即应用到当前正文选区"],
    fixes: ["修复加粗、颜色等工具点击后没有应用到选中文字的问题"],
    optimizations: ["色板浮层不再被工具栏裁剪，常用色选择区域完整显示"]
  },
  {
    version: "1.2.84",
    date: "2026-06-13",
    title: "排版工具恢复",
    featureUpdates: ["知识点排版工具恢复加粗、颜色、对齐等常用操作"],
    fixes: ["修复点击工具栏后正文选区丢失导致排版命令不生效的问题"],
    optimizations: ["工具栏仅保护按钮类操作的正文选区，保留下拉框和取色器原生交互"]
  },
  {
    version: "1.2.83",
    date: "2026-06-13",
    title: "排版工具点击修复",
    featureUpdates: ["知识点颜色入口保留常用色板和自定义取色器"],
    fixes: ["修复色板改造后排版工具点击被工具栏选区保护拦截的问题"],
    optimizations: ["调整色板菜单悬停区域，减少移动鼠标时菜单意外关闭"]
  },
  {
    version: "1.2.82",
    date: "2026-06-13",
    title: "知识点常用色板",
    featureUpdates: ["知识点文字颜色和背景颜色新增常用色板"],
    fixes: ["保留自定义取色器，仍可选择任意文字和背景颜色"],
    optimizations: ["颜色入口改为悬停展开，常用色与自定义色集中在同一控件"]
  },
  {
    version: "1.2.81",
    date: "2026-06-13",
    title: "父级知识点页开关",
    featureUpdates: ["知识点工具栏新增父级标题知识点页开关"],
    fixes: ["关闭后有子分支的标题不再打开自己的知识点页，子分支仍可正常进入"],
    optimizations: ["开关状态随课程保存，重启后保持上次设置"]
  },
  {
    version: "1.2.80",
    date: "2026-06-13",
    title: "知识点有内容翻页",
    featureUpdates: ["知识点工具栏新增上一页和下一页切换按钮"],
    fixes: ["翻页仅跳转到已写入内容的知识点页面，自动跳过空白页面"],
    optimizations: ["切换前会保存当前知识点内容，按钮无可跳转页面时自动禁用"]
  },
  {
    version: "1.2.79",
    date: "2026-06-13",
    title: "格式刷双击复用恢复",
    featureUpdates: ["知识点格式刷恢复为双击进入连续复用"],
    fixes: ["取消单击开启后选区自动应用的交互"],
    optimizations: ["单击仍用于复制或应用一次，连续复用可通过关闭按钮或 Esc 退出"]
  },
  {
    version: "1.2.78",
    date: "2026-06-13",
    title: "格式刷选区应用",
    featureUpdates: ["知识点格式刷改为点击开启后可直接选中文字应用格式"],
    fixes: ["再次点击格式刷即可关闭，避免连续刷格式时反复点击按钮"],
    optimizations: ["仅在鼠标选中非空内容后自动刷格式，普通点击正文不触发"]
  },
  {
    version: "1.2.77",
    date: "2026-06-12",
    title: "知识点格式刷复用",
    featureUpdates: ["知识点格式刷支持双击进入连续复用"],
    fixes: ["区分格式刷单击应用和双击复用，避免双击时误触发一次性应用"],
    optimizations: ["连续格式刷可重复应用，仍可通过关闭按钮或 Esc 退出"]
  },
  {
    version: "1.2.76",
    date: "2026-06-12",
    title: "AI 学习体系整理",
    featureUpdates: ["补充可执行的 AI 辅助课程学习体系"],
    fixes: ["将案例调研结果收束为学习流程、产物和验收标准"],
    optimizations: ["突出课程资料导入、知识建模、练习反馈和复盘沉淀"]
  },
  {
    version: "1.2.75",
    date: "2026-06-12",
    title: "AI 学习案例调研",
    featureUpdates: ["补充 AI 工具辅助课程学习体系搭建的案例调研记录"],
    fixes: ["整理 B 站与知乎来源中的可借鉴学习流程"],
    optimizations: ["提炼资料导入、框架构建、练习验证和复盘沉淀的学习闭环"]
  },
  {
    version: "1.2.74",
    date: "2026-06-12",
    title: "Mimo 调用提速",
    featureUpdates: ["Mimo 普通问答改为轻量请求路径"],
    fixes: ["修复 README 快捷发送被误判为知识点改写导致响应变慢的问题"],
    optimizations: ["普通 Mimo 请求不再附带知识点 HTML，并降低输出预算与等待时间"]
  },
  {
    version: "1.2.73",
    date: "2026-06-12",
    title: "README 快捷发送精简",
    featureUpdates: ["系统信息快捷按钮改为发送 README 内容"],
    fixes: ["减少聊天快捷发送内容过长的问题"],
    optimizations: ["仅附带当前课程与知识点边界，避免冗余运行信息占用聊天窗口"]
  },
  {
    version: "1.2.72",
    date: "2026-06-12",
    title: "系统信息快捷发送",
    featureUpdates: ["知识点聊天新增系统信息快捷按钮，可一键发送系统上下文"],
    fixes: ["补充 README 系统说明，覆盖运行路径、存储位置、AI 接入和 MCP 入口"],
    optimizations: ["聊天发送上下文时自动附带当前课程与当前知识点信息"]
  },
  {
    version: "1.2.71",
    date: "2026-06-12",
    title: "界面文字修复",
    featureUpdates: ["恢复课程中心、学习工作台、目录与工具栏的中文显示"],
    fixes: ["修复多处固定界面文案因编码错解出现乱码"],
    optimizations: ["清理字体、段落样式、流程图与导图工具栏的中文标签"]
  },
  {
    version: "1.2.70",
    date: "2026-06-12",
    title: "任务回调兜底",
    featureUpdates: ["Claude 任务回调改为事件流与状态轮询并行等待"],
    fixes: ["连续发送第二条消息时，任务已完成但聊天窗口仍转圈的问题"],
    optimizations: ["事件流结束时补读最后一段完成事件，并在投递后立即检查一次任务状态"]
  },
  {
    version: "1.2.69",
    date: "2026-06-12",
    title: "Claude 原文投递",
    featureUpdates: ["Claude 回答改为仅投递用户输入原文"],
    fixes: ["任务完成回调优先监听 The Muti Agent 事件流，减少完成后仍转圈的问题"],
    optimizations: ["Claude 通道保留任务状态轮询兜底，事件流不可用时仍可读取结果"]
  },
  {
    version: "1.2.68",
    date: "2026-06-12",
    title: "Claude 任务追踪",
    featureUpdates: ["Claude 回答改为投递后台任务并通过任务追踪读取结果"],
    fixes: ["移除旧的会话问答与日志兜底路径，避免聊天结果来源混杂"],
    optimizations: ["按 The Muti Agent 的任务投递、状态查询、完成读取流程整理 Claude 通道"]
  },
  {
    version: "1.2.67",
    date: "2026-06-12",
    title: "Mimo 响应提速",
    featureUpdates: ["Mimo 回答保留直接调用模式，并优化普通问答响应速度"],
    fixes: ["兼容 Mimo 返回 JSON 代码块时的结果解析"],
    optimizations: ["普通 Mimo 问答减少上下文与输出预算，编辑类请求仍保留更高输出空间"]
  },
  {
    version: "1.2.66",
    date: "2026-06-12",
    title: "Mimo 回答选择",
    featureUpdates: ["知识点聊天新增 Claude 与 Mimo 回答来源切换"],
    fixes: ["Mimo 回答不显示推理过程，仅在结果完成后反馈正文"],
    optimizations: ["接入 mimo-v2.5-pro，并使用本地配置读取 Token Plan 凭证"]
  },
  {
    version: "1.2.65",
    date: "2026-06-12",
    title: "Claude MCP 对接",
    featureUpdates: ["知识点聊天改为通过 AIstudy MCP 受控任务连接 Claude Code"],
    fixes: ["聊天请求不再依赖同步会话返回，避免 Claude 已完成但窗口持续转圈"],
    optimizations: ["按课程复用 Claude Code 会话，并由 AIstudy 校验后仅写回当前知识点"]
  },
  {
    version: "1.2.64",
    date: "2026-06-12",
    title: "Claude 等待兜底",
    featureUpdates: ["知识点聊天在 Claude Code 日志完成后可直接返回最终结果"],
    fixes: ["Claude Code 已生成结果但桥接请求未结束时，聊天窗口不再持续转圈"],
    optimizations: ["复用固定课程会话时优先读取同会话最新结果日志，减少等待卡住"]
  },
  {
    version: "1.2.63",
    date: "2026-06-12",
    title: "Claude 聊天结果容错",
    featureUpdates: ["知识点聊天会自动提取 Claude Code 的最终回复内容"],
    fixes: ["Claude 返回非严格 JSON 时不再把原始日志直接显示在聊天窗口"],
    optimizations: ["自动恢复 Claude Code 日志中的中文编码显示，聊天反馈更干净"]
  },
  {
    version: "1.2.62",
    date: "2026-06-12",
    title: "Claude Code 聊天接入",
    featureUpdates: ["知识点聊天窗口接入固定 Claude Code 会话，按进入课程绑定独立会话"],
    fixes: ["Claude Code 写回时仅允许更新当前课程的当前知识点内容"],
    optimizations: ["聊天处理期间显示等待转圈，结果完成后再反馈最终回复"]
  },
  {
    version: "1.2.61",
    date: "2026-06-12",
    title: "标题正文样式",
    featureUpdates: ["知识点工具栏新增标题与正文样式"],
    fixes: ["标题和正文排版格式会随知识点内容保存"],
    optimizations: ["预设采用中文文档常用字体、字号、缩进、对齐和行距"]
  },
  {
    version: "1.2.60",
    date: "2026-06-12",
    title: "AI 聊天入口",
    featureUpdates: ["知识点页面右下角新增 AI 辅助聊天入口"],
    fixes: ["聊天窗口仅保留必要输入区域，减少页面说明干扰"],
    optimizations: ["使用现有头像作为悬浮入口，点击后弹出轻量聊天窗"]
  },
  {
    version: "1.2.59",
    date: "2026-06-12",
    title: "知识点流程图",
    featureUpdates: ["知识点正文支持插入流程图并重新载入编辑"],
    fixes: ["流程图块会随知识点内容保存，切换目录或重启后可继续编辑"],
    optimizations: ["流程图编辑器支持节点、形状、连线和标签调整"]
  },
  {
    version: "1.2.58",
    date: "2026-06-12",
    title: "知识点缩放",
    featureUpdates: ["知识点正文支持 Ctrl 加鼠标滚轮放大和缩小"],
    fixes: ["缩放时阻止浏览器页面整体缩放，避免工具栏和布局被误放大"],
    optimizations: ["知识点正文缩放比例会保留到下次打开"]
  },
  {
    version: "1.2.57",
    date: "2026-06-12",
    title: "目录层级折叠",
    featureUpdates: ["知识点目录支持按层级折叠和展开"],
    fixes: ["重启后保留上次手动折叠的目录状态"],
    optimizations: ["有下级的目录项显示独立箭头，目录层级浏览更紧凑"]
  },
  {
    version: "1.2.56",
    date: "2026-06-12",
    title: "MCP 路线功能补全",
    featureUpdates: ["课程库 MCP 新增目录搜索、知识点搜索、目录导出和巡检报告"],
    fixes: ["路线菜单补充中文用途说明和数据影响提示"],
    optimizations: ["MCP 引导按巡检、读取、写入、备份、迁移、数据库路线细分步骤"]
  },
  {
    version: "1.2.55",
    date: "2026-06-12",
    title: "MCP 路线式启动",
    featureUpdates: ["新增 MCP.ps1 PowerShell 启动器，一条命令进入课程库 MCP 引导"],
    fixes: ["MCP.py 交互菜单改为路线选择，减少平铺选项造成的选择负担"],
    optimizations: ["课程库 MCP 按巡检、读取、写入、备份、迁移和数据库路线组织流程"]
  },
  {
    version: "1.2.54",
    date: "2026-06-12",
    title: "课程库 MCP 脚本入口",
    featureUpdates: ["新增 PowerShell 引导式 MCP.py，可执行课程库状态、目录、知识点、备份、导入导出和 MySQL 同步服务"],
    fixes: ["课程库直接写入服务加入运行状态拦截、写前备份和写后校验"],
    optimizations: ["MCP.py 支持交互菜单和命令行 JSON 输出，便于 Claude 或 PowerShell 自动调用"]
  },
  {
    version: "1.2.53",
    date: "2026-06-12",
    title: "MCP 状态控制台",
    featureUpdates: ["MCP 页面新增调用进度、阶段状态和实时日志"],
    fixes: ["补齐 MCP 接入状态持续检测反馈"],
    optimizations: ["MCP 页面改为紧凑控制台布局，关键状态集中在首屏"]
  },
  {
    version: "1.2.52",
    date: "2026-06-12",
    title: "目录初始宽度调整",
    featureUpdates: ["课程目录初始宽度略微加宽"],
    fixes: ["减少目录内容初次进入时过窄导致的换行拥挤"],
    optimizations: ["保留拖拽调宽能力，知识点与导图区布局更舒展"]
  },
  {
    version: "1.2.51",
    date: "2026-06-12",
    title: "格式刷跨页面",
    featureUpdates: ["知识点和思维导图格式刷支持切换页面后继续使用"],
    fixes: ["修复知识点目录切换后格式刷状态丢失的问题"],
    optimizations: ["格式刷状态提升到课程工作区，跨分支排版更连续"]
  },
  {
    version: "1.2.50",
    date: "2026-06-12",
    title: "导图工具区简化",
    featureUpdates: ["课程顶部栏和思维导图功能区改为轻量工具条"],
    fixes: ["减少功能区分组边框和标题造成的视觉拥挤"],
    optimizations: ["工具按钮改为紧凑图标样式，导图区上方空间更简洁"]
  },
  {
    version: "1.2.49",
    date: "2026-06-12",
    title: "知识点标题区移除",
    featureUpdates: ["知识点编辑页移除内部标题区"],
    fixes: ["清理知识点工具栏上方多余占位"],
    optimizations: ["知识点功能区上移，正文可用高度更大"]
  },
  {
    version: "1.2.48",
    date: "2026-06-12",
    title: "课程顶部栏合并",
    featureUpdates: ["返回课程中心和课程功能切换合并为同一条顶部栏"],
    fixes: ["移除课程详情顶部双层工具栏造成的额外占位"],
    optimizations: ["课程内容区上方空间更紧凑，导图和知识点可视区域更大"]
  },
  {
    version: "1.2.47",
    date: "2026-06-12",
    title: "课程工作区顶部精简",
    featureUpdates: ["课程详情顶部切换入口移到工作区栏左侧"],
    fixes: ["移除课程详情和知识点标题区重复的已保存状态"],
    optimizations: ["返回课程中心按钮改为更轻量的胶囊样式，减少顶部视觉占用"]
  },
  {
    version: "1.2.46",
    date: "2026-06-12",
    title: "格式刷关闭优化",
    featureUpdates: ["知识点和思维导图格式刷新增关闭按钮"],
    fixes: ["修复格式刷激活后不易退出的问题"],
    optimizations: ["格式刷应用一次后自动退出，知识点编辑区支持 Esc 关闭格式刷"]
  },
  {
    version: "1.2.45",
    date: "2026-06-12",
    title: "MySQL 静默启动修复",
    featureUpdates: ["MySQL 仍随 AIstudy 自动启动"],
    fixes: ["修复启动 AIstudy 时 MySQL 命令窗口或 Windows Terminal 弹出的问题"],
    optimizations: ["数据库启动改为隐藏窗口后台进程，并继续记录启动日志"]
  },
  {
    version: "1.2.44",
    date: "2026-06-12",
    title: "知识点格式刷增强",
    featureUpdates: ["知识点格式刷支持复制文字样式和段落样式"],
    fixes: ["修复对齐、缩进等段落格式切换目录后丢失的问题"],
    optimizations: ["知识点保存仅保留学习编辑需要的安全样式，减少格式漂移"]
  },
  {
    version: "1.2.43",
    date: "2026-06-12",
    title: "知识点重做快捷键",
    featureUpdates: ["知识点编辑器支持 Ctrl+X 执行重做操作"],
    fixes: ["调整重做快捷键提示与实际操作保持一致"],
    optimizations: ["保留 Ctrl+Y 和 Ctrl+Shift+Z 作为兼容重做方式"]
  },
  {
    version: "1.2.42",
    date: "2026-06-12",
    title: "知识点格式边界修复",
    featureUpdates: ["知识点编辑器新增撤销和重做操作"],
    fixes: ["修复多段落改文本格式时可能误改全文的问题"],
    optimizations: ["文字格式仅作用于明确选区或当前段落，避免样式落到整个编辑器"]
  },
  {
    version: "1.2.41",
    date: "2026-06-12",
    title: "知识点多段字号修复",
    featureUpdates: ["知识点字号工具支持跨多个段落统一调整选中文字"],
    fixes: ["修复多段落选区无法稳定修改文字大小的问题"],
    optimizations: ["跨段格式仅作用于非空文本，避免空白行被误套字号"]
  },
  {
    version: "1.2.40",
    date: "2026-06-11",
    title: "知识点局部字号持久化",
    featureUpdates: ["知识点字号可稳定作用于选中的局部文字"],
    fixes: ["修复切换目录后局部字号丢失以及空白行跟随放大的问题"],
    optimizations: ["旧版字号标签会自动转为稳定的内联样式，减少切换回显差异"]
  },
  {
    version: "1.2.39",
    date: "2026-06-11",
    title: "知识点字号即时生效",
    featureUpdates: ["知识点字号工具支持选区和当前段落即时调整"],
    fixes: ["修复字号下拉显示已变化但正文大小没有变化的问题"],
    optimizations: ["工具栏操作前自动保留正文选区，减少点击控件导致的格式丢失"]
  },
  {
    version: "1.2.38",
    date: "2026-06-11",
    title: "知识点空格段落保留",
    featureUpdates: ["知识点正文支持保留连续空格和空格段落"],
    fixes: ["修复用空格隔开段落后保存回弹的问题"],
    optimizations: ["正文编辑区按 Word 类编辑器方式显示连续空格"]
  },
  {
    version: "1.2.37",
    date: "2026-06-11",
    title: "知识点字号工具增强",
    featureUpdates: ["知识点工具栏新增字体与像素字号选择"],
    fixes: ["修复部分选中文字无法调整文字大小的问题"],
    optimizations: ["字体、字号、文字颜色和背景色改为稳定选区样式应用"]
  },
  {
    version: "1.2.36",
    date: "2026-06-11",
    title: "快捷方式图标固定",
    featureUpdates: ["应用启动时自动修正 AIstudy 快捷方式图标"],
    fixes: ["修复重新打包或旧快捷方式导致桌面图标不一致的问题"],
    optimizations: ["安装包、卸载程序和快捷方式统一使用同一图标资源"]
  },
  {
    version: "1.2.35",
    date: "2026-06-11",
    title: "知识点输入空行保护",
    featureUpdates: ["知识点编辑时保留正在输入的段落空行"],
    fixes: ["修复自动保存回显重写正文导致段落间空行被吃掉的问题"],
    optimizations: ["正文仅在失焦或切换时规范化段落，避免打断输入"]
  },
  {
    version: "1.2.34",
    date: "2026-06-11",
    title: "知识点空行保留",
    featureUpdates: ["知识点正文支持保留手动输入的空白行"],
    fixes: ["修复统一段间距时空行被自动清除的问题"],
    optimizations: ["空白行与普通段落保持相同字距和行距节奏"]
  },
  {
    version: "1.2.33",
    date: "2026-06-11",
    title: "知识点段距与目录冻结",
    featureUpdates: ["目录同步关闭状态会随课程保存并在重启后恢复"],
    fixes: ["修复关闭目录同步后重启仍自动同步新增导图分支的问题"],
    optimizations: ["知识点正文保存时统一段落结构，保持段间距一致"]
  },
  {
    version: "1.2.32",
    date: "2026-06-11",
    title: "知识点正文版心调整",
    featureUpdates: ["知识点正文改为固定阅读版心"],
    fixes: ["修复正文位置偏左和内容呈现区域不稳定的问题"],
    optimizations: ["统一正文、段落和列表的字间距与段间距"]
  },
  {
    version: "1.2.31",
    date: "2026-06-11",
    title: "MySQL 终端残留清理",
    featureUpdates: ["启动时自动关闭 MySQL 相关空终端窗口"],
    fixes: ["修复旧控制台进程退出后 Windows Terminal 空窗仍残留的问题"],
    optimizations: ["数据库后台运行与可见终端清理分离处理"]
  },
  {
    version: "1.2.30",
    date: "2026-06-11",
    title: "MySQL 控制台清理",
    featureUpdates: ["启动时自动清理旧版可见 MySQL 控制台进程"],
    fixes: ["修复数据库已启动时残留黑色控制台窗口的问题"],
    optimizations: ["MySQL 启动链路统一走后台隐藏进程"]
  },
  {
    version: "1.2.29",
    date: "2026-06-11",
    title: "知识点排版修复",
    featureUpdates: ["知识点内容改为可编辑"],
    fixes: ["修复正文区域上下和左右空挡过大的问题"],
    optimizations: ["收紧正文行距与段落间距，内容呈现更紧凑"]
  },
  {
    version: "1.2.28",
    date: "2026-06-11",
    title: "静默自动保存",
    featureUpdates: ["课程内容改为后台静默自动保存"],
    fixes: ["修复连续编辑时多次保存可能乱序落库的问题"],
    optimizations: ["保存状态改为轻量提示，失败时自动兜底"]
  },
  {
    version: "1.2.27",
    date: "2026-06-11",
    title: "知识点保存加固",
    featureUpdates: ["知识点编辑切换前强制保存当前草稿"],
    fixes: ["修复知识点目录切换时防抖保存被取消导致内容丢失的问题"],
    optimizations: ["课程变更立即同步本地数据库和 MySQL，启动时按最新保存源加载"]
  },
  {
    version: "1.2.26",
    date: "2026-06-11",
    title: "MySQL 静默启动",
    featureUpdates: ["随应用启动的 MySQL 改为后台静默运行"],
    fixes: ["移除 MySQL 控制台启动参数，避免启动 exe 时弹出窗口"],
    optimizations: ["保留后台启动日志，便于排查数据库启动状态"]
  },
  {
    version: "1.2.25",
    date: "2026-06-11",
    title: "编辑格式刷",
    featureUpdates: ["思维导图和知识点工具栏新增格式刷"],
    fixes: ["知识点格式刷应用后立即保存当前编辑内容"],
    optimizations: ["格式刷开启后显示选中状态，支持双击清空"]
  },
  {
    version: "1.2.24",
    date: "2026-06-11",
    title: "隔离分支切换保存",
    featureUpdates: ["子分支切换前自动保存当前隔离画布"],
    fixes: ["修复切换子分支后跳回主思维导图和隔离数据丢失的问题"],
    optimizations: ["隔离分支保存按当前画布来源记录，避免内容写入错误分支"]
  },
  {
    version: "1.2.23",
    date: "2026-06-11",
    title: "第四章顺序整理",
    featureUpdates: ["第四章 Notion 页面按第一节到第四节顺序排列"],
    fixes: ["修正第四章页面序号接在第三章之后"],
    optimizations: ["清理章节标题中的重复掌握标记"]
  },
  {
    version: "1.2.22",
    date: "2026-06-11",
    title: "第四章 Notion 文档",
    featureUpdates: ["第四章股票内容整理为四篇 Notion 文档"],
    fixes: ["清理文档页码、页眉和重复章节混排"],
    optimizations: ["保留表格、真题、章节练习和答案详解的结构"]
  },
  {
    version: "1.2.21",
    date: "2026-06-11",
    title: "上下分支隔离",
    featureUpdates: ["分支隔离拆分为上隔离和下隔离两个开关"],
    fixes: ["修复开启分支隔离后画布跳回主思维导图的问题"],
    optimizations: ["下隔离关闭时可让已有下级分支导图跟随当前分支更新"]
  },
  {
    version: "1.2.20",
    date: "2026-06-11",
    title: "分支隔离编辑",
    featureUpdates: ["思维导图新增分支隔离开关，子分支可独立编辑"],
    fixes: ["隔离编辑时不再把子分支改动回写到上级导图"],
    optimizations: ["知识点插入分支导图时优先使用隔离分支内容"]
  },
  {
    version: "1.2.19",
    date: "2026-06-11",
    title: "导图目录冻结规则",
    featureUpdates: ["关闭目录同步后新增序号子分支不再进入左侧目录"],
    fixes: ["隐藏目录新增项时保留真实导图数据同步，已有子分支导图可继续向下展开"],
    optimizations: ["知识点标题优先读取真实导图节点，避免目录过滤后标题回退"]
  },
  {
    version: "1.2.18",
    date: "2026-06-11",
    title: "导图目录同步开关",
    featureUpdates: ["思维导图新增序号层级目录同步开关"],
    fixes: ["支持从 1. 序号层级开始冻结目录标题，避免导图编辑误改左侧目录"],
    optimizations: ["重新开启同步后目录会按当前导图刷新"]
  },
  {
    version: "1.2.17",
    date: "2026-06-11",
    title: "MCP 写入强制规范",
    featureUpdates: ["Notion 知识点导入新增写入强制门槛"],
    fixes: ["补齐歧义分支、缺少备份、危险 HTML 和验收失败时的阻断规则"],
    optimizations: ["MCP 状态改为按流程状态呈现"]
  },
  {
    version: "1.2.16",
    date: "2026-06-11",
    title: "Notion 导入标准程序",
    featureUpdates: ["Notion 写入知识点流程升级为标准化 MCP 程序"],
    fixes: ["补齐导入前检测、标题歧义处理、写入验收和回滚规范"],
    optimizations: ["Claude 可按固定引导完成 Notion 内容解析、匹配、写入和验证"]
  },
  {
    version: "1.2.15",
    date: "2026-06-11",
    title: "MCP 状态引导",
    featureUpdates: ["MCP 页面新增规范、接入和执行三段式状态检测"],
    fixes: ["补齐 Notion 课程导入和 MySQL 同步备份提示"],
    optimizations: ["MCP 页面改为卡片式状态呈现"]
  },
  {
    version: "1.2.14",
    date: "2026-06-11",
    title: "Notion 导入 MCP 标准",
    featureUpdates: ["新增 Notion 知识点导入 MCP 契约和流程文档"],
    fixes: ["规范 Claude 写入 exe 知识点时的备份、匹配、落库和验证步骤"],
    optimizations: ["MCP 页面入口改为 Notion 导入、标题匹配和写入验证"]
  },
  {
    version: "1.2.13",
    date: "2026-06-11",
    title: "UI 文案协议",
    featureUpdates: ["项目规范新增 UI 文案协议"],
    fixes: ["移除 MCP 页面中非必要的功能说明文案"],
    optimizations: ["界面文案改为短标签和状态优先，减少阅读干扰"]
  },
  {
    version: "1.2.12",
    date: "2026-06-11",
    title: "知识点切换串内容修复",
    featureUpdates: ["知识点页面切换分支时会重新隔离编辑状态"],
    fixes: ["修复从方式切到特征时旧内容被写入新分支的问题"],
    optimizations: ["切换知识点时会丢弃陈旧草稿，避免后台自动保存误覆盖"]
  },
  {
    version: "1.2.11",
    date: "2026-06-11",
    title: "知识点默认字号调整",
    featureUpdates: ["知识点正文初始字号统一为证券市场融资活动方式节点的字号"],
    fixes: ["修复新知识点正文默认字号偏小的问题"],
    optimizations: ["字号下拉默认状态与正文实际显示大小保持一致"]
  },
  {
    version: "1.2.10",
    date: "2026-06-11",
    title: "知识点编辑稳定性修复",
    featureUpdates: ["知识点编辑器支持选中文本后稳定使用工具栏"],
    fixes: ["修复点击功能区后选中内容丢失或知识点内容串写的问题"],
    optimizations: ["知识点保存改为按当前分支单独合并，减少快速切换时的覆盖风险"]
  },
  {
    version: "1.2.9",
    date: "2026-06-11",
    title: "知识点插入分支导图",
    featureUpdates: ["知识点工具栏新增插入当前分支思维导图按钮"],
    fixes: ["解决章节知识点需要手动整理对应导图分支的问题"],
    optimizations: ["插入后的分支结构可在知识点正文中继续编辑和保存"]
  },
  {
    version: "1.2.8",
    date: "2026-06-11",
    title: "课程工作区字体统一",
    featureUpdates: ["知识点、知识笔记和思维导图统一使用微软雅黑"],
    fixes: ["修复不同学习区域字体观感不一致的问题"],
    optimizations: ["课程内容阅读和导图节点显示更统一"]
  },
  {
    version: "1.2.7",
    date: "2026-06-11",
    title: "知识点阅读宽度优化",
    featureUpdates: ["知识点正文切换为居中的阅读版心，减少横向扫视距离"],
    fixes: ["修复大屏下正文行宽过长、阅读视线容易跑偏的问题"],
    optimizations: ["正文行距和段落间距更适合连续学习阅读"]
  },
  {
    version: "1.2.6",
    date: "2026-06-11",
    title: "MySQL 随应用异步启动",
    featureUpdates: ["AIstudy 启动时可异步拉起本机 MySQL 数据库"],
    fixes: ["修复打开应用前需要手动启动 MySQL 才能连接课程库的问题"],
    optimizations: ["数据库启动不阻塞主窗口，连接失败时仍保留本地课程备份"]
  },
  {
    version: "1.2.5",
    date: "2026-06-11",
    title: "MySQL 数据库接入",
    featureUpdates: ["课程中心支持连接 MySQL 保存课程数据"],
    fixes: ["数据库不可用时自动保留本地文件备份，避免课程数据被清空"],
    optimizations: ["课程数据可在 MySQL 与本地文件之间自动兜底同步"]
  },
  {
    version: "1.2.4",
    date: "2026-06-11",
    title: "课程数据持久化",
    featureUpdates: ["课程中心新增本地文件数据库保存", "启动时可从旧课程缓存自动恢复"],
    fixes: ["修复课程数据库缓存发布变化后失效的问题"],
    optimizations: ["旧课程缓存自动迁移到稳定数据库"]
  },
  {
    version: "1.2.3",
    date: "2026-06-11",
    title: "导图排版工具区压缩",
    featureUpdates: ["思维导图排版工具区改为紧凑布局"],
    fixes: ["修复排版功能区占用画布空间过多的问题"],
    optimizations: ["工具分组高度更低，画布可视区域更大"]
  },
  {
    version: "1.2.2",
    date: "2026-06-11",
    title: "应用图标修复",
    featureUpdates: ["应用快捷方式恢复正确图标"],
    fixes: ["修复重新打包后快捷方式图标显示异常的问题"],
    optimizations: ["应用图标在不同桌面尺寸下显示更稳定"]
  },
  {
    version: "1.2.1",
    date: "2026-06-11",
    title: "知识点编辑区布局修复",
    featureUpdates: ["知识点编辑区恢复为完整可编辑页面"],
    fixes: ["修复排版工具栏下沉和正文区域空白过大的问题"],
    optimizations: ["知识点工具栏与正文区域贴合更自然"]
  },
  {
    version: "1.2.0",
    date: "2026-06-10",
    title: "知识点排版工具",
    featureUpdates: [
      "知识点编辑器升级为富文本编辑器",
      "添加排版工具栏：加粗、斜体、下划线、删除线",
      "添加字体大小选择：正常、小、较小、较大、大、特大、超大",
      "添加文字颜色和背景颜色选择",
      "添加对齐方式：左对齐、居中、右对齐、两端对齐",
      "添加列表功能：无序列表、有序列表",
      "添加缩进功能：增加缩进、减少缩进",
      "添加清除格式功能"
    ],
    fixes: [],
    optimizations: ["知识点编辑体验更接近 Word/WPS"]
  },
  {
    version: "1.1.0",
    date: "2026-06-09",
    title: "目录层级优化",
    featureUpdates: [
      "目录标题分级显示：章节标题加粗大字体，子标题按层级递减",
      "目录缩进优化：每级缩进22px，末级标题额外增加16px",
      "目录序号优化：章节标题不加序号，子标题按层级显示序号"
    ],
    fixes: ["修复目录层级样式错乱问题", "修复子标题序号显示问题"],
    optimizations: ["目录层级关系更清晰，视觉层次更分明"]
  },
  {
    version: "1.0.19",
    date: "2026-06-09",
    title: "目录层级序号",
    featureUpdates: ["目录支持 Word/WPS 风格的层级序号", "一级：第一章、第二章... 二级：一、二、三... 三级：（一）（二）（三）... 四级：1. 2. 3... 五级：1) 2) 3)..."],
    fixes: [],
    optimizations: ["目录显示更规范，符合文档编辑习惯"]
  },
  {
    version: "1.0.18",
    date: "2026-06-09",
    title: "目录自适应布局",
    featureUpdates: ["目录宽度调整时页面也自动适应", "使用 CSS Grid 实现真正的自适应布局"],
    fixes: ["修复目录拉伸时页面布局被挤压"],
    optimizations: ["整个编辑器布局使用 CSS 变量控制，更灵活"]
  },
  {
    version: "1.0.17",
    date: "2026-06-09",
    title: "目录优化",
    featureUpdates: ["目录支持拖拽宽度：180-500px", "目录项支持自动换行显示"],
    fixes: [],
    optimizations: ["目录文本溢出时自动换行，不再截断"]
  },
  {
    version: "1.0.16",
    date: "2026-06-09",
    title: "系统索引",
    featureUpdates: ["补充全系统程序、数据、构建和交接索引"],
    fixes: ["统一交接资料中的版本和位置说明"],
    optimizations: ["索引覆盖源码、exe、存储、发布产物和后续开发重点"]
  },
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
    featureUpdates: ["新增更新管理入口", "版本记录支持折叠查看", "最新版本自动置顶"],
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
