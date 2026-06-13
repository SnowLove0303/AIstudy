param(
  [ValidateSet("bilibili", "zhihu")]
  [string]$Source = "bilibili",
  [string]$Bvid = "BV1fPJ76wEYA",
  [string]$ZhihuUrl = "",
  [string]$Query = "",
  [string]$OutputRoot = "E:\MorenAnzhuangLujing\Huangjingdajian\aistudy-ai-daily",
  [string]$SkillRoot = "",
  [string]$Python = "",
  [ValidateSet("auto", "whisper", "funasr")]
  [string]$Engine = "auto",
  [int]$ChunkCharLimit = 520,
  [switch]$ForceTranscribe,
  [switch]$SkipDownloadTranscribe
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$env:PYTHONIOENCODING = "utf-8"

function New-Utf8NoBomEncoding {
  [System.Text.UTF8Encoding]::new($false)
}

function Write-Utf8File {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Value
  )
  [System.IO.File]::WriteAllText($Path, $Value, (New-Utf8NoBomEncoding))
}

function Resolve-FirstExistingPath {
  param([string[]]$Candidates)
  foreach ($candidate in $Candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }
  return ""
}

function Get-PythonCommand {
  param([string]$Requested)
  $resolved = Resolve-FirstExistingPath @(
    $Requested,
    "E:\MorenAnzhuangLujing\Huangjingdajian\python-venvs\bilibili-all-in-one\Scripts\python.exe"
  )
  if ($resolved) { return $resolved }
  return "python"
}

function Get-SkillRoot {
  param([string]$Requested)
  $resolved = Resolve-FirstExistingPath @(
    $Requested,
    "F:\AIAPP\Codex\.codex\skills\bilibili-all-in-one-2026-04-18-v2",
    "F:\AIAPP\Codex\.codex\skills\all-channal-research-bilibili",
    "F:\AIAPP\Codex\.codex\skills\bilibili-all-in-one"
  )
  if (-not $resolved) {
    throw "未找到 bilibili-all-in-one 技能目录，请通过 -SkillRoot 指定。"
  }
  return $resolved
}

function ConvertTo-SafeFileName {
  param([string]$Value)
  $safe = $Value
  foreach ($char in [System.IO.Path]::GetInvalidFileNameChars()) {
    $safe = $safe.Replace([string]$char, "_")
  }
  $safe = $safe -replace '\s+', " "
  if ($safe.Length -gt 80) { return $safe.Substring(0, 80).Trim() }
  return $safe.Trim()
}

function Normalize-Text {
  param([string]$Text)
  if (-not $Text) { return "" }
  $normalized = $Text -replace "`r", "`n"
  $normalized = $normalized -replace "[`t　]+", " "
  $normalized = $normalized -replace "`n{3,}", "`n`n"
  return $normalized.Trim()
}

function ConvertTo-SimplifiedChinese {
  param([string]$Text)
  if (-not $Text) { return "" }
  $value = $Text
  $map = [ordered]@{
    "審" = "审"; "執" = "执"; "針" = "针"; "對" = "对"; "國" = "国";
    "個" = "个"; "為" = "为"; "與" = "与"; "這" = "这"; "後" = "后";
    "發" = "发"; "佈" = "布"; "臺" = "台"; "灣" = "湾"; "體" = "体";
    "碼" = "码"; "庫" = "库"; "戶" = "户"; "數" = "数"; "據" = "据";
    "歸" = "归"; "復" = "复"; "內" = "内"; "開" = "开"; "關" = "关";
    "過" = "过"; "還" = "还"; "會" = "会"; "應" = "应"; "將" = "将";
    "現" = "现"; "進" = "进"; "用戶" = "用户"; "資料" = "资料";
    "網絡" = "网络"; "軟件" = "软件"; "聲明" = "声明"; "詳情" = "详情"
  }
  foreach ($key in $map.Keys) {
    $value = $value.Replace([string]$key, [string]$map[$key])
  }
  return $value
}

function Repair-AiDailyTerms {
  param([string]$Text)
  if (-not $Text) { return "" }
  $value = $Text
  $replacements = [ordered]@{
    "非不无" = "Fable 5";
    "非博物" = "Fable 5";
    "非博" = "Fable 5";
    "麦克俗" = "Mythos 5";
    "麦克思" = "Mythos 5";
    "饶国" = "绕过";
    "饶过" = "绕过";
    "越遇" = "越狱";
    "越预" = "越狱";
    "伯克声明" = "博客声明";
    "带马库" = "代码库";
    "墙掉" = "强调";
    "够成" = "构成";
    "不输的模型" = "部署的模型";
    "不备允许" = "不被允许";
    "深处美国" = "身处美国";
    "全现无论" = "权限，无论";
    "一度觉得" = "以杜绝";
    "微归访问" = "违规访问";
    "金融上数" = "禁用上述";
    "上数两个模型" = "上述两个模型";
    "定为提供" = "未提供";
    "关系细节" = "相关细节";
    "少数一支" = "少数一致";
    "于美赢政府" = "已与美国政府";
    "以于美赢政府" = "已与美国政府";
    "以已与美国政府" = "已与美国政府";
    "上回发现" = "尚未发现";
    "热过防护" = "绕过防护";
    "各户数据" = "客户数据";
    "宗生防御" = "纵深防御";
    "侠窄" = "狭窄";
    "狭窄，越狱" = "狭窄越狱";
    "绕过会越狱" = "绕过并越狱";
    "才用了" = "采用了";
    "招回面向" = "召回面向";
    "数以人的" = "数以百万计的";
    "前业模型" = "前沿模型";
    "前业AI" = "前沿 AI";
    "橫凉" = "衡量";
    "横凉" = "衡量";
    "首席之新冠" = "首席执行官";
    "Darrille Amode" = "Dario Amodei";
    "进用事件" = "禁用事件";
    "以公开发表道歉" = "已公开发表道歉";
    "Open-AI" = "OpenAI";
    "Anthropic官方" = "Anthropic 官方";
    "Chat GPT" = "ChatGPT"
  }
  foreach ($key in $replacements.Keys) {
    $value = $value.Replace([string]$key, [string]$replacements[$key])
  }
  $value = $value -replace 'GPT\s*([0-9]+(?:\.[0-9]+)?)', 'GPT-$1'
  return $value
}

function Add-ReadablePunctuation {
  param([string]$Text)
  if (-not $Text) { return "" }
  $value = $Text
  $patterns = @(
    @('就在刚刚(?![，。])\s*', '就在刚刚，'),
    @('国家安全委员想\s*Anthropic', '国家安全委员会向 Anthropic'),
    @('发布出口管制指令要求', '发布出口管制指令，要求'),
    @('访问权限无论', '访问权限。无论'),
    @('境外都', '境外，都'),
    @('不被允许包括', '不被允许，包括'),
    @('外籍员工也', '外籍员工也'),
    @('也被禁止访问为遵守', '也被禁止访问。为遵守'),
    @('为遵守这一法律指令\s*Anthropic', '为遵守这一法律指令，Anthropic'),
    @('违规访问该公司确认', '违规访问。该公司确认'),
    @('该公司确认', '该公司确认'),
    @('不受此次事件影响据', '不受此次事件影响。据'),
    @('博客声明政府指令', '博客声明，政府指令'),
    @('相关细节但', '相关细节，但'),
    @('了解到政府认为', '了解到，政府认为'),
    @('方法\s*Anthropic', '方法。Anthropic'),
    @('演示发现', '演示后发现'),
    @('漏洞在公司', '漏洞。该公司'),
    @('这些发现并不构成', '这些发现并不构成'),
    @('安全威胁且包括', '安全威胁，且包括'),
    @('相同的漏洞\s*Anthropic', '相同的漏洞。Anthropic'),
    @('辩护指出', '辩护，指出'),
    @('有效官方称', '有效。官方称'),
    @('通用越狱 Fable 5', '通用越狱。Fable 5'),
    @('策略\s*Anthropic', '策略。Anthropic'),
    @('表示虽然', '表示，虽然'),
    @('指令但认为', '指令，但认为'),
    @('不合理的若以此标准', '不合理。若以此标准'),
    @('停止在社交平台', '停止。在社交平台'),
    @('时间也有评论', '时间。也有评论'),
    @('出口管制针对此次', '出口管制。针对此次'),
    @('服务中断\s*Anthropic', '服务中断，Anthropic'),
    @('道歉并承诺', '道歉，并承诺'),
    @('更多细节同时', '更多细节，同时')
  )
  foreach ($pair in $patterns) {
    $value = $value -replace $pair[0], $pair[1]
  }
  return $value
}

function Format-AiDailyText {
  param([string]$Text)
  if (-not $Text) { return "" }
  $value = Normalize-Text $Text
  $value = ConvertTo-SimplifiedChinese $value
  $value = Repair-AiDailyTerms $value
  $value = Add-ReadablePunctuation $value
  $value = $value -replace '\.{3,}', '……'
  $value = $value -replace '…{3,}', '……'
  $value = $value -replace ',', '，'
  $value = $value -replace ';', '；'
  $value = $value -replace ':', '：'
  $value = $value -replace '\?', '？'
  $value = $value -replace '!', '！'
  $value = $value -replace '([，。！？；：、])\s+', '$1'
  $value = $value -replace '\s+([，。！？；：、])', '$1'
  $value = $value -replace '，{2,}', '，'
  $value = $value -replace '。{2,}', '。'
  $value = $value -replace '；{2,}', '；'
  $value = $value -replace '([一-龥])(Anthropic|OpenAI|ChatGPT|Claude|Gemini|GPT-[0-9]+(?:\.[0-9]+)?|Fable 5|Mythos 5)', '$1 $2'
  $value = $value -replace '(Anthropic|OpenAI|ChatGPT|Claude|Gemini|GPT-[0-9]+(?:\.[0-9]+)?|Fable 5|Mythos 5)([一-龥])', '$1 $2'
  $value = $value -replace '([一-龥])AI', '$1 AI'
  $value = $value -replace 'AI([一-龥])', 'AI $1'
  $value = $value -replace '(Dario Amodei)([一-龥])', '$1 $2'
  $value = $value -replace '未来([0-9]+)小时', '未来 $1 小时'
  $value = $value -replace '\s{2,}', ' '
  $value = $value.Trim()
  if ($value -and $value -notmatch '[。！？]$') {
    $value = "$value。"
  }
  return $value
}

function Get-Excerpt {
  param(
    [string]$Text,
    [int]$MaxLength = 180
  )
  $value = Format-AiDailyText $Text
  if ($value.Length -le $MaxLength) { return $value }
  $window = $value.Substring(0, [Math]::Min($MaxLength, $value.Length))
  $cut = $window.LastIndexOfAny([char[]]@("。", "！", "？", "；", "，"))
  if ($cut -lt [Math]::Floor($MaxLength * 0.55)) { $cut = $MaxLength - 1 }
  return ($value.Substring(0, $cut + 1).TrimEnd("，", "；", "：", "、") + "……")
}

function Get-SectionTitle {
  param(
    [int]$Index,
    [string]$Text
  )
  $clean = Format-AiDailyText $Text
  $title = ([regex]::Split($clean, '[，。！？；]') | Where-Object { $_.Trim() } | Select-Object -First 1).Trim()
  if ($title.Length -gt 22) { $title = $title.Substring(0, 22).Trim() }
  if (-not $title) { $title = "正文整理" }
  return "分段 {0:D2}：{1}" -f $Index, $title
}

function Split-Transcript {
  param(
    [string]$Text,
    [int]$Limit
  )

  $clean = Format-AiDailyText $Text
  if (-not $clean) { return @() }

  $sentences = [regex]::Split($clean, '(?<=[。！？；])') |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ }

  if ($sentences.Count -eq 0) {
    $sentences = @($clean)
  }

  $chunks = New-Object System.Collections.Generic.List[object]
  $buffer = New-Object System.Collections.Generic.List[string]
  $length = 0

  $flushBuffer = {
    if ($buffer.Count -gt 0) {
      $text = Format-AiDailyText (($buffer -join ""))
      $chunks.Add([pscustomobject]@{
        index = $chunks.Count + 1
        title = Get-SectionTitle -Index ($chunks.Count + 1) -Text $text
        text = $text
      })
      $buffer.Clear()
      Set-Variable -Name length -Value 0 -Scope 1
    }
  }

  foreach ($sentence in $sentences) {
    $remaining = $sentence
    while ($remaining.Length -gt $Limit) {
      & $flushBuffer
      $window = $remaining.Substring(0, [Math]::Min($Limit, $remaining.Length))
      $breakChars = [char[]]@("。", "！", "？", "；", "，", ",", " ")
      $cut = $window.LastIndexOfAny($breakChars)
      if ($cut -lt [Math]::Floor($Limit * 0.55)) { $cut = $Limit - 1 }
      $part = Format-AiDailyText ($remaining.Substring(0, $cut + 1).Trim())
      if ($part) {
        $chunks.Add([pscustomobject]@{
          index = $chunks.Count + 1
          title = Get-SectionTitle -Index ($chunks.Count + 1) -Text $part
          text = $part
        })
      }
      $remaining = $remaining.Substring($cut + 1).Trim()
    }
    if (-not $remaining) { continue }
    $nextLength = $length + $remaining.Length
    if ($buffer.Count -gt 0 -and $nextLength -gt $Limit) {
      & $flushBuffer
    }
    $buffer.Add($remaining)
    $length += $remaining.Length
  }

  & $flushBuffer

  return $chunks.ToArray()
}

function Get-Highlights {
  param([object[]]$Chunks)
  $pattern = "AI|OpenAI|ChatGPT|Claude|Gemini|Google|微软|模型|发布|宣布|推出|更新|开源|融资|工具|应用|产品|功能|能力|研究"
  $items = New-Object System.Collections.Generic.List[string]
  foreach ($chunk in $Chunks) {
    $sentences = [regex]::Split([string]$chunk.text, '(?<=[。！？；])') |
      ForEach-Object { $_.Trim() } |
      Where-Object { $_ }
    foreach ($sentence in $sentences) {
      if ($sentence -match $pattern -and $items.Count -lt 8) {
        $items.Add((Get-Excerpt -Text $sentence -MaxLength 180))
      }
    }
    if ($items.Count -ge 8) { break }
  }

  if ($items.Count -eq 0) {
    foreach ($chunk in $Chunks | Select-Object -First 6) {
      $items.Add((Get-Excerpt -Text ([string]$chunk.text) -MaxLength 140))
    }
  }

  return @($items)
}

function New-DailySummary {
  param([object[]]$Chunks)
  if (-not $Chunks -or $Chunks.Count -eq 0) { return "暂无可整理摘要。" }
  $allText = (($Chunks | ForEach-Object { [string]$_.text }) -join "")
  $sentences = [regex]::Split((Format-AiDailyText $allText), '(?<=[。！？；])') |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ }
  $summary = ($sentences | Select-Object -First 3) -join ""
  if (-not $summary) {
    $summary = [string]$Chunks[0].text
  }
  return Get-Excerpt -Text $summary -MaxLength 420
}

function Get-BilibiliViewData {
  param([string]$TargetBvid)
  $api = "https://api.bilibili.com/x/web-interface/view?bvid=$TargetBvid"
  $response = Invoke-RestMethod -Uri $api -Headers @{
    "User-Agent" = "Mozilla/5.0 AIstudy"
    "Referer" = "https://www.bilibili.com/video/$TargetBvid/"
  } -TimeoutSec 20
  if ($response.code -ne 0 -or -not $response.data) {
    throw "Bilibili view API failed: $($response.message)"
  }
  return $response.data
}

function Get-VideoMetadata {
  param([string]$TargetBvid)
  $fallback = [pscustomobject]@{
    bvid = $TargetBvid
    aid = $null
    cid = $null
    title = $TargetBvid
    author = ""
    date = (Get-Date).ToString("yyyy-MM-dd")
    duration = 0
    plays = 0
    url = "https://www.bilibili.com/video/$TargetBvid"
    source = "direct"
  }

  try {
    $data = Get-BilibiliViewData $TargetBvid
    $pubDate = [DateTimeOffset]::FromUnixTimeSeconds([int64]$data.pubdate).LocalDateTime.ToString("yyyy-MM-dd")
    $cid = if ($data.pages -and $data.pages.Count -gt 0) { $data.pages[0].cid } else { $data.cid }
    return [pscustomobject]@{
      bvid = $data.bvid
      aid = $data.aid
      cid = $cid
      title = $data.title
      author = $data.owner.name
      date = $pubDate
      duration = $data.duration
      plays = $data.stat.view
      url = "https://www.bilibili.com/video/$($data.bvid)"
      source = "bilibili-api"
    }
  } catch {
    return $fallback
  }
}

function Invoke-LoggedCommand {
  param(
    [string]$Command,
    [string[]]$Arguments,
    [string]$LogPath,
    [switch]$AllowFailure
  )
  $displayArguments = $Arguments | ForEach-Object {
    if ($_ -match "\s") { [string]::Concat([char]34, $_, [char]34) } else { $_ }
  }
  $line = "$Command " + ($displayArguments -join " ")
  Write-Host "[run] $line"
  Write-Utf8File -Path $LogPath -Value "[run] $line`n"
  & $Command @Arguments 2>&1 | Tee-Object -FilePath $LogPath -Append
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    if ($AllowFailure) { return $false }
    throw "命令执行失败，exit=$exitCode，日志：$LogPath"
  }
  return $true
}

function Invoke-PublicAudioFallback {
  param(
    [object]$Metadata,
    [string]$TargetBvid,
    [string]$DownloadDir,
    [string]$LogPath
  )

  Write-Utf8File -Path $LogPath -Value "[public-audio] start $TargetBvid`n"
  $cid = $Metadata.cid
  if (-not $cid) {
    $data = Get-BilibiliViewData $TargetBvid
    $cid = if ($data.pages -and $data.pages.Count -gt 0) { $data.pages[0].cid } else { $data.cid }
  }
  if (-not $cid) {
    Add-Content -LiteralPath $LogPath -Encoding UTF8 -Value "[public-audio] missing cid"
    return $false
  }

  $playUrl = "https://api.bilibili.com/x/player/playurl?bvid=$TargetBvid&cid=$cid&qn=16&fnval=16&fourk=0"
  $play = Invoke-RestMethod -Uri $playUrl -Headers @{
    "User-Agent" = "Mozilla/5.0 AIstudy"
    "Referer" = "https://www.bilibili.com/video/$TargetBvid/"
  } -TimeoutSec 30

  $audios = @($play.data.dash.audio)
  if ($audios.Count -eq 0) {
    Add-Content -LiteralPath $LogPath -Encoding UTF8 -Value "[public-audio] no dash audio"
    return $false
  }

  $urls = New-Object System.Collections.Generic.List[string]
  foreach ($audio in ($audios | Sort-Object bandwidth -Descending)) {
    if ($audio.baseUrl) { $urls.Add([string]$audio.baseUrl) }
    if ($audio.base_url) { $urls.Add([string]$audio.base_url) }
    foreach ($backup in @($audio.backupUrl) + @($audio.backup_url)) {
      if ($backup) { $urls.Add([string]$backup) }
    }
  }

  $audioPath = Join-Path $DownloadDir "${TargetBvid}_public-audio.m4a"
  foreach ($url in ($urls | Select-Object -Unique)) {
    try {
      Add-Content -LiteralPath $LogPath -Encoding UTF8 -Value "[public-audio] download $url"
      Invoke-WebRequest -Uri $url -Headers @{
        "User-Agent" = "Mozilla/5.0"
        "Referer" = "https://www.bilibili.com/video/$TargetBvid/"
      } -OutFile $audioPath -TimeoutSec 180 -UseBasicParsing
      if ((Test-Path -LiteralPath $audioPath) -and ((Get-Item -LiteralPath $audioPath).Length -gt 1024)) {
        Add-Content -LiteralPath $LogPath -Encoding UTF8 -Value "[public-audio] saved $audioPath"
        return $true
      }
    } catch {
      Add-Content -LiteralPath $LogPath -Encoding UTF8 -Value "[public-audio] failed $($_.Exception.Message)"
    }
  }
  return $false
}

function Invoke-TranscribeFallback {
  param(
    [string]$SkillRootPath,
    [string]$PythonCommand,
    [string]$TargetBvid,
    [string]$DownloadDir,
    [string]$EngineName,
    [string]$RunDir,
    [string]$LogPath
  )

  $opencliScripts = Join-Path $SkillRootPath "scripts\bilibili-opencli\scripts"
  $fallbackPy = Join-Path $RunDir "transcribe-fallback.py"
  $pythonCode = @"
import gc
import json
import sys
sys.path.insert(0, r"$opencliScripts")
from transcribe import transcribe, release_models
result = transcribe(r"$TargetBvid", output_dir=r"$DownloadDir", skip_existing=False, engine=r"$EngineName")
print(json.dumps(result, ensure_ascii=False))
release_models()
gc.collect()
if result.get("status") not in ("success", "cached", "skipped"):
    raise SystemExit(1)
"@
  Write-Utf8File -Path $fallbackPy -Value $pythonCode
  Invoke-LoggedCommand -Command $PythonCommand -Arguments @($fallbackPy) -LogPath $LogPath
}

function Find-TranscriptFile {
  param(
    [string]$DownloadDir,
    [string]$TargetBvid
  )
  $candidates = @(
    (Join-Path $DownloadDir "${TargetBvid}_transcript.txt"),
    (Join-Path $DownloadDir "transcript_${TargetBvid}.txt")
  )
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) { return (Resolve-Path -LiteralPath $candidate).Path }
  }
  $found = Get-ChildItem -LiteralPath $DownloadDir -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "*$TargetBvid*transcript*.txt" -or $_.Name -like "*transcript*$TargetBvid*.txt" } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if ($found) { return $found.FullName }
  return ""
}

function New-DailyMarkdown {
  param(
    [object]$Metadata,
    [object[]]$Chunks,
    [string[]]$Highlights,
    [string]$Summary,
    [string]$TranscriptPath,
    [string]$GeneratedAt
  )

  $lines = New-Object System.Collections.Generic.List[string]
  $source = if ($Metadata.source) { [string]$Metadata.source } else { "bilibili" }
  $sourceLabel = if ($source -eq "zhihu") { "知乎" } else { "Bilibili" }
  $targetLabel = if ($source -eq "zhihu") { "知乎链接" } else { "BV 号" }
  $targetValue = if ($source -eq "zhihu") { [string]$Metadata.url } else { [string]$Metadata.bvid }
  $titleLabel = if ($source -eq "zhihu") { "文章标题" } else { "视频标题" }
  $authorLabel = if ($source -eq "zhihu") { "作者" } else { "UP 主" }
  $lines.Add("---")
  $lines.Add("type: ai-daily")
  $lines.Add("source: $source")
  if ($source -eq "zhihu") {
    $lines.Add("zhihuUrl: $($Metadata.url)")
  } else {
    $lines.Add("bvid: $($Metadata.bvid)")
  }
  $lines.Add("created: $GeneratedAt")
  $lines.Add("tags:")
  $lines.Add("  - AI日报")
  $lines.Add("  - $sourceLabel")
  $lines.Add("---")
  $lines.Add("")
  $lines.Add("# AI 日报 · $($Metadata.date)")
  $lines.Add("")
  $lines.Add("> 来源：[$($Metadata.title)]($($Metadata.url))")
  if ($Metadata.author) { $lines.Add("> 作者：$($Metadata.author)") }
  $lines.Add("")
  $lines.Add("## 基本信息")
  $lines.Add("")
  $lines.Add("- ${titleLabel}：$($Metadata.title)")
  $lines.Add("- ${authorLabel}：$($Metadata.author)")
  $lines.Add("- ${targetLabel}：$targetValue")
  $lines.Add("- 生成时间：$GeneratedAt")
  $lines.Add("- 内容分段：$($Chunks.Count) 段")
  $lines.Add("")
  $lines.Add("## 中文摘要")
  $lines.Add("")
  $lines.Add($Summary)
  $lines.Add("")
  $lines.Add("## 重点整理")
  $lines.Add("")
  if ($Highlights.Count -gt 0) {
    foreach ($item in $Highlights) { $lines.Add("- $item") }
  } else {
    $lines.Add("- 暂无可提取重点。")
  }
  $lines.Add("")
  $lines.Add("## 内容分段")
  $lines.Add("")
  foreach ($chunk in $Chunks) {
    $lines.Add("### $($chunk.title)")
    $lines.Add("")
    $lines.Add([string]$chunk.text)
    $lines.Add("")
  }
  $lines.Add("## 来源与产物")
  $lines.Add("")
  $lines.Add("- ${targetLabel}：$targetValue")
  $lines.Add("- 链接：$($Metadata.url)")
  $lines.Add("- 转录：$TranscriptPath")
  $lines.Add("")
  return ($lines -join "`n")
}

function ConvertTo-HtmlEncoded {
  param([string]$Value)
  return [System.Net.WebUtility]::HtmlEncode($Value)
}

function Get-ShortHash {
  param([string]$Value)
  $sha1 = [System.Security.Cryptography.SHA1]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
    $hash = $sha1.ComputeHash($bytes)
    return ([System.BitConverter]::ToString($hash) -replace "-", "").Substring(0, 12).ToLowerInvariant()
  } finally {
    $sha1.Dispose()
  }
}

function ConvertFrom-HtmlFragment {
  param([string]$Html)
  if (-not $Html) { return "" }
  $value = $Html
  $value = $value -replace "(?is)<script[^>]*>.*?</script>", " "
  $value = $value -replace "(?is)<style[^>]*>.*?</style>", " "
  $value = $value -replace "(?is)<br\s*/?>", "`n"
  $value = $value -replace "(?is)</(p|div|h1|h2|h3|li)>", "`n"
  $value = $value -replace "(?is)<[^>]+>", " "
  $value = [System.Net.WebUtility]::HtmlDecode($value)
  $value = $value -replace "[`t ]+", " "
  $value = $value -replace " *`n *", "`n"
  $value = $value -replace "`n{3,}", "`n`n"
  return $value.Trim()
}

function Get-MetaContent {
  param(
    [string]$Html,
    [string]$Name
  )
  $tags = [regex]::Matches($Html, "(?is)<meta\s+[^>]*>")
  foreach ($tagMatch in $tags) {
    $tag = [string]$tagMatch.Value
    $nameMatch = [regex]::Match($tag, "(?is)(?:property|name)\s*=\s*[`"']([^`"']+)[`"']")
    if (-not $nameMatch.Success -or $nameMatch.Groups[1].Value -ne $Name) { continue }
    $contentMatch = [regex]::Match($tag, "(?is)content\s*=\s*[`"']([^`"']*)[`"']")
    if ($contentMatch.Success) {
      return [System.Net.WebUtility]::HtmlDecode($contentMatch.Groups[1].Value).Trim()
    }
  }
  return ""
}

function Get-ZhihuArticleData {
  param([string]$Url)
  if (-not $Url -or $Url -notmatch "https?://([^/]+\.)?zhihu\.com/") {
    throw "知乎链接格式不正确。"
  }

  $headers = @{
    "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36 AIstudy"
    "Accept-Language" = "zh-CN,zh;q=0.9,en;q=0.8"
    "Referer" = "https://www.zhihu.com/"
  }
  $response = Invoke-WebRequest -Uri $Url -Headers $headers -TimeoutSec 30 -UseBasicParsing
  $html = [string]$response.Content
  if (-not $html) { throw "知乎文章读取为空。" }

  $title = Get-MetaContent -Html $html -Name "og:title"
  if (-not $title) { $title = Get-MetaContent -Html $html -Name "twitter:title" }
  if (-not $title -and $html -match "(?is)<title[^>]*>(.*?)</title>") {
    $title = ConvertFrom-HtmlFragment $matches[1]
  }
  $title = ($title -replace "\s*-\s*知乎\s*$", "").Trim()
  if (-not $title) { $title = "知乎文章" }

  $author = Get-MetaContent -Html $html -Name "article:author"
  if (-not $author) { $author = Get-MetaContent -Html $html -Name "author" }
  if (-not $author -and $html -match '"authorName"\s*:\s*"([^"]+)"') {
    $author = [System.Text.RegularExpressions.Regex]::Unescape($matches[1])
  }
  if (-not $author) { $author = "知乎" }

  $paragraphs = New-Object System.Collections.Generic.List[string]
  $blockMatches = [regex]::Matches($html, "(?is)<(p|h1|h2|h3|li)[^>]*>(.*?)</\1>")
  foreach ($blockMatch in $blockMatches) {
    $text = ConvertFrom-HtmlFragment $blockMatch.Groups[2].Value
    if ($text.Length -ge 8 -and $text -notmatch "^\s*(发布于|编辑于|赞同|添加评论|分享|收藏)\s*") {
      $paragraphs.Add($text)
    }
  }

  $content = ($paragraphs | Select-Object -Unique) -join "`n`n"
  if ($content.Length -lt 80) {
    $description = Get-MetaContent -Html $html -Name "description"
    if (-not $description) { $description = Get-MetaContent -Html $html -Name "og:description" }
    $content = ConvertFrom-HtmlFragment $description
  }
  if ($content.Length -lt 40) {
    throw "未能读取到足够的知乎文章正文，请确认文章可访问。"
  }

  return [pscustomobject]@{
    source = "zhihu"
    bvid = ""
    sourceId = Get-ShortHash $Url
    title = $title
    author = $author
    date = (Get-Date).ToString("yyyy-MM-dd")
    url = $Url
    content = $content
  }
}

function New-DailyHtml {
  param(
    [object]$Metadata,
    [object[]]$Chunks,
    [string[]]$Highlights,
    [string]$Summary,
    [string]$GeneratedAt
  )
  $highlightHtml = if ($Highlights.Count -gt 0) {
    ($Highlights | ForEach-Object { "<li>$(ConvertTo-HtmlEncoded $_)</li>" }) -join "`n"
  } else {
    "<li>暂无可提取重点。</li>"
  }
  $chunkHtml = ($Chunks | ForEach-Object {
    "<details><summary>$([System.Net.WebUtility]::HtmlEncode($_.title))</summary><p>$([System.Net.WebUtility]::HtmlEncode($_.text))</p></details>"
  }) -join "`n"
  $title = ConvertTo-HtmlEncoded $Metadata.title
  $author = ConvertTo-HtmlEncoded $Metadata.author
  $url = ConvertTo-HtmlEncoded $Metadata.url
  $source = if ($Metadata.source -eq "zhihu") { "知乎" } else { "Bilibili" }
  $sourceTarget = if ($Metadata.source -eq "zhihu") { "文章" } else { [string]$Metadata.bvid }
  $summary = ConvertTo-HtmlEncoded $Summary

  return @"
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI 日报 - $title</title>
  <style>
    :root { color-scheme: light; font-family: "Microsoft YaHei", "Segoe UI", sans-serif; }
    body { margin: 0; background: #eef3f6; color: #0f172a; }
    main { width: min(960px, calc(100% - 40px)); margin: 32px auto; }
    header { border-bottom: 1px solid #cbd5e1; padding-bottom: 18px; }
    h1 { margin: 0 0 10px; font-size: 30px; line-height: 1.25; }
    h2 { margin: 0 0 12px; font-size: 20px; }
    p, li { font-size: 16px; line-height: 1.9; }
    a { color: #0f766e; }
    .meta { color: #475569; font-size: 14px; }
    .panel, details { margin-top: 18px; padding: 18px; border: 1px solid #dbe3ea; border-radius: 8px; background: rgba(255, 255, 255, 0.82); }
    details summary { cursor: pointer; font-size: 18px; font-weight: 800; }
    ul { padding-left: 22px; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>AI 日报 · $($Metadata.date)</h1>
      <div class="meta">$source · $author · <a href="$url">$sourceTarget</a> · $GeneratedAt</div>
    </header>
    <div class="panel">
      <h2>中文摘要</h2>
      <p>$summary</p>
    </div>
    <div class="panel">
      <h2>重点整理</h2>
      <ul>$highlightHtml</ul>
    </div>
    $chunkHtml
  </main>
</body>
</html>
"@
}

$today = Get-Date -Format "yyyy-MM-dd"
$sourceKey = if ($Source -eq "zhihu") { "zhihu-$(Get-ShortHash $ZhihuUrl)" } else { $Bvid }
$runId = "$today-$sourceKey"
$runDir = Join-Path $OutputRoot $runId
$downloadDir = Join-Path $runDir "downloads"
$rawNoteDir = Join-Path $runDir "raw-notes"
$reportDir = Join-Path $runDir "report"
$logDir = Join-Path $runDir "logs"
New-Item -ItemType Directory -Force -Path $downloadDir, $rawNoteDir, $reportDir, $logDir | Out-Null

$generatedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
$skill = ""
$transcriptPath = ""

if ($Source -eq "zhihu") {
  $metadata = Get-ZhihuArticleData $ZhihuUrl
  Write-Utf8File -Path (Join-Path $runDir "zhihu-metadata.json") -Value ($metadata | ConvertTo-Json -Depth 8)
  $transcriptPath = Join-Path $downloadDir "$($metadata.sourceId)_article.txt"
  Write-Utf8File -Path $transcriptPath -Value $metadata.content
  Write-Utf8File -Path (Join-Path $logDir "01-zhihu-fetch.log") -Value "Zhihu article mode: $ZhihuUrl`n$($metadata.title)`n"
} else {
  $skill = Get-SkillRoot $SkillRoot
  $pythonCommand = Get-PythonCommand $Python
  $runPy = Join-Path $skill "scripts\bilibili-opencli\scripts\run.py"
  if (-not (Test-Path -LiteralPath $runPy)) {
    throw "未找到 Bilibili workflow run.py：$runPy"
  }

  $metadata = Get-VideoMetadata $Bvid
  $metadata | Add-Member -NotePropertyName source -NotePropertyValue "bilibili" -Force
  $metadata | Add-Member -NotePropertyName sourceId -NotePropertyValue $Bvid -Force
  Write-Utf8File -Path (Join-Path $runDir "video-metadata.json") -Value ($metadata | ConvertTo-Json -Depth 8)

  if ($Query) {
    $searchArgs = @(
      $runPy,
      "--find-video", $Query,
      "--limit", "10",
      "--strict-find",
      "--dry-run"
    )
    Invoke-LoggedCommand -Command $pythonCommand -Arguments $searchArgs -LogPath (Join-Path $logDir "01-search.log")
  } else {
    Write-Utf8File -Path (Join-Path $logDir "01-search.log") -Value "Direct BV mode: $Bvid`n$($metadata.url)`n"
  }

  if (-not $SkipDownloadTranscribe) {
    $workflowArgs = @(
      $runPy,
      "--bvid", $Bvid,
      "--output", $downloadDir,
      "--vault", $rawNoteDir,
      "--parallel", "1",
      "--engine", $Engine,
      "--keep-cache"
    )
    if ($ForceTranscribe) { $workflowArgs += "--force-transcribe" }
    $workflowOk = Invoke-LoggedCommand -Command $pythonCommand -Arguments $workflowArgs -LogPath (Join-Path $logDir "02-download-transcribe.log") -AllowFailure
    if (-not $workflowOk) {
      Write-Host "[fallback] 常规下载转录失败，尝试公开音频下载。"
    }
  }

  $transcriptPath = Find-TranscriptFile -DownloadDir $downloadDir -TargetBvid $Bvid
  if (-not $transcriptPath -and -not $SkipDownloadTranscribe) {
    $audioOk = Invoke-PublicAudioFallback -Metadata $metadata -TargetBvid $Bvid -DownloadDir $downloadDir -LogPath (Join-Path $logDir "03-public-audio.log")
    if ($audioOk) {
      Invoke-TranscribeFallback `
        -SkillRootPath $skill `
        -PythonCommand $pythonCommand `
        -TargetBvid $Bvid `
        -DownloadDir $downloadDir `
        -EngineName $Engine `
        -RunDir $runDir `
        -LogPath (Join-Path $logDir "04-transcribe-fallback.log")
      $transcriptPath = Find-TranscriptFile -DownloadDir $downloadDir -TargetBvid $Bvid
    }
  }

  if (-not $transcriptPath) {
    throw "未找到转录文件。请查看日志：$(Join-Path $logDir "02-download-transcribe.log")"
  }
}

$transcript = Get-Content -LiteralPath $transcriptPath -Encoding utf8 -Raw
$chunks = @(Split-Transcript -Text $transcript -Limit $ChunkCharLimit)
$summary = New-DailySummary -Chunks $chunks
$highlights = @(Get-Highlights -Chunks $chunks)

$safeTitle = ConvertTo-SafeFileName $metadata.title
$baseName = "$today AI日报-$safeTitle"
$markdownPath = Join-Path $reportDir "$baseName.md"
$htmlPath = Join-Path $reportDir "$baseName.html"
$cleanTranscriptPath = Join-Path $reportDir "$baseName.cleaned.txt"
$manifestPath = Join-Path $reportDir "manifest.json"

$markdown = New-DailyMarkdown -Metadata $metadata -Chunks $chunks -Highlights $highlights -Summary $summary -TranscriptPath $transcriptPath -GeneratedAt $generatedAt
$html = New-DailyHtml -Metadata $metadata -Chunks $chunks -Highlights $highlights -Summary $summary -GeneratedAt $generatedAt
Write-Utf8File -Path $markdownPath -Value $markdown
Write-Utf8File -Path $htmlPath -Value $html
Write-Utf8File -Path $cleanTranscriptPath -Value (($chunks | ForEach-Object { [string]$_.text }) -join "`n`n")

$manifest = [pscustomobject]@{
  source = $Source
  bvid = $Bvid
  zhihuUrl = if ($Source -eq "zhihu") { $ZhihuUrl } else { "" }
  sourceId = $metadata.sourceId
  query = $Query
  title = $metadata.title
  author = $metadata.author
  sourceUrl = $metadata.url
  generatedAt = $generatedAt
  summary = $summary
  skillRoot = $skill
  runDirectory = $runDir
  transcriptPath = $transcriptPath
  cleanTranscriptPath = $cleanTranscriptPath
  markdownPath = $markdownPath
  htmlPath = $htmlPath
  rawNoteDirectory = $rawNoteDir
  downloadDirectory = $downloadDir
  chunkCount = $chunks.Count
  sections = $chunks
  highlights = $highlights
  qualityNotes = @(
    "已整理为简体中文",
    "已规范常见标点和中英文间距",
    "已修正常见 AI 日报转录误识别词"
  )
}
Write-Utf8File -Path $manifestPath -Value ($manifest | ConvertTo-Json -Depth 8)

Write-Host ""
Write-Host "AI日报工作流完成"
Write-Host "Markdown: $markdownPath"
Write-Host "HTML:     $htmlPath"
Write-Host "Manifest: $manifestPath"




