const fs = require('fs');
const https = require('https');

// ================== 1. 基础配置 ==================
// 默认渲染当前运行 Workflow 的仓库，也可以指定其他公开仓库
const TARGET_REPO = process.env.TARGET_REPOSITORY || process.env.GITHUB_REPOSITORY;
const METRICS_TOKEN = process.env.METRICS_TOKEN;
const OUTPUT_FILE = 'repo/github-card.svg';

// ================== 2. 自定义卡片配色与主题 ==================
// 你可以直接修改以下颜色，完全对应生成器中的自定义设置
const THEME = {
    colTitle: '#0969da',   // 标题颜色
    colDesc: '#24292f',    // 描述文本颜色
    colBg: '#ffffff',      // 卡片底色
    colBorder: '#e1e4e8',  // 边框颜色
    colMeta: '#57606a',    // 图标与统计数字颜色
    colLang: '#3572A5',    // 语言小圆点颜色 (Python)
    hasShadow: true,       // 是否开启投影
    hasRound: true,        // 是否开启圆角
    hasGrid: true          // 是否开启点阵背景
};

// 常见语言小圆点颜色自动匹配
const LANG_COLORS = {
    'Python': '#3572A5',
    'JavaScript': '#f1e05a',
    'TypeScript': '#3178c6',
    'HTML': '#e34c26',
    'CSS': '#563d7c',
    'Go': '#00ADD8',
    'Rust': '#dea584',
    'Java': '#b07219',
    'C++': '#f34b7d',
    'C': '#555555'
};

// ================== 3. 辅助函数 ==================
function escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

function formatNum(num) {
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return num.toString();
}

// ================== 4. 请求 API 并渲染 SVG ==================
console.log(`正在获取仓库 ${TARGET_REPO} 的最新数据...`);

const options = {
    hostname: 'api.github.com',
    path: `/repos/${TARGET_REPO}`,
    headers: {
        'User-Agent': 'GitHub-Actions-SVG-Generator'
    }
};

// 如果配置了 GitHub Action 默认 Token，则带上鉴权以确保 100% 成功
if (METRICS_TOKEN) {
    options.headers['Authorization'] = `token ${METRICS_TOKEN}`;
}

https.get(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            if (res.statusCode !== 200) {
                throw new Error(`API 返回状态码错误: ${res.statusCode}. 信息: ${data}`);
            }

            const repoInfo = JSON.parse(data);
            renderSvg(repoInfo);
        } catch (err) {
            console.error('获取 GitHub 数据失败:', err.message);
            process.exit(1);
        }
    });
}).on('error', (err) => {
    console.error('网络请求失败:', err.message);
    process.exit(1);
});

// ================== 5. SVG 组装生成 ==================
function renderSvg(data) {
    const repoName = data.full_name;
    const lang = data.language || 'Markdown';
    const stars = formatNum(data.stargazers_count);
    const forks = formatNum(data.forks_count);

    // 智能分配描述排版 (支持两行防重叠)
    let desc1 = data.description || "No description provided.";
    let desc2 = "";
    if (desc1.length > 45) {
        let cutoff = desc1.indexOf(' ', 40);
        if (cutoff === -1 || cutoff > 52) cutoff = 42;
        desc2 = desc1.substring(cutoff).trim();
        desc1 = desc1.substring(0, cutoff).trim();
        if (desc2.length > 45) desc2 = desc2.substring(0, 42) + '...';
    }

    // 自动映射语言颜色
    const colLang = LANG_COLORS[lang] || THEME.colLang;

    // 定位计算
    const cardWidth = 430;
    const cardHeight = 110;
    const svgWidth = THEME.hasGrid ? 480 : cardWidth + 20;
    const svgHeight = THEME.hasGrid ? 170 : cardHeight + 20;
    const cardX = THEME.hasGrid ? 25 : 10;
    const cardY = THEME.hasGrid ? 30 : 10;
    const rxValue = THEME.hasRound ? 8 : 0;
    const shadowFilter = THEME.hasShadow ? 'filter="url(#shadow)"' : '';

    // 构建标准的 SVG 文本字符串
    const svgCode = `<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1" fill="#e2e8f0" />
    </pattern>
    <filter id="shadow" x="-5%" y="-5%" width="112%" height="115%">
      <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#0f172a" flood-opacity="0.06" />
    </filter>
  </defs>

  ${THEME.hasGrid ? `<rect width="100%" height="100%" fill="url(#grid)" />` : ''}

  <g ${shadowFilter}>
    <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="${rxValue}" fill="${THEME.colBg}" stroke="${THEME.colBorder}" stroke-width="1" />
  </g>

  <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5ZM9 3v1.25c0 .138.112.25.25.25h1.25L9 3Z" fill="${THEME.colMeta}" transform="translate(${cardX + 15}, ${cardY + 18}) scale(0.95)" />

  <text x="${cardX + 38}" y="${cardY + 30}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="14" font-weight="600" fill="${THEME.colTitle}">${escapeXml(repoName)}</text>

  <g transform="translate(${cardX + 355}, ${cardY + 16})">
    <rect width="60" height="18" rx="9" fill="none" stroke="${THEME.colBorder}" stroke-width="1" />
    <text x="30" y="12" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="10" font-weight="500" fill="${THEME.colMeta}" text-anchor="middle">Public</text>
  </g>

  <text x="${cardX + 16}" y="${cardY + 54}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="12" font-weight="normal" fill="${THEME.colDesc}">${escapeXml(desc1)}</text>
  <text x="${cardX + 16}" y="${cardY + 70}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="12" font-weight="normal" fill="${THEME.colDesc}">${escapeXml(desc2)}</text>

  <circle cx="${cardX + 22}" cy="${cardY + 90}" r="5" fill="${colLang}" />
  <text x="${cardX + 34}" y="${cardY + 94}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="12" fill="${THEME.colMeta}">${escapeXml(lang)}</text>

  <g transform="translate(${cardX + 110}, ${cardY + 84})">
    <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.047 2.97 1.055 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l1.055-4.193L1.173 6.378a.75.75 0 0 1 .416-1.279l4.21-.612L7.327.668A.75.75 0 0 1 8 .25Z" fill="${THEME.colMeta}" transform="scale(0.85)" />
    <text x="18" y="10" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="12" fill="${THEME.colMeta}">${stars}</text>
  </g>

  <g transform="translate(${cardX + 185}, ${cardY + 84})">
    <path d="M5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 2.122a2.25 2.25 0 1 0-1.5 0v.878A2.25 2.25 0 0 0 5.75 8.5h1.5v2.128a2.251 2.251 0 1 0 1.5 0V8.5h1.5A2.25 2.25 0 0 0 12 6.25v-.878a2.25 2.25 0 1 0-1.5 0v.878a.75.75 0 0 1-.75.75h-4.5A.75.75 0 0 1 4.5 6.25v-.878ZM11 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 12.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" fill="${THEME.colMeta}" transform="scale(0.85)" />
    <text x="18" y="10" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="12" fill="${THEME.colMeta}">${forks}</text>
  </g>
</svg>`;
    if (!fs.existsSync('repo')) { fs.mkdirSync('repo'); }
    fs.writeFileSync(OUTPUT_FILE, svgCode);
    console.log(`成功生成卡片并保存至: ${OUTPUT_FILE}`);
}
