import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_CONFIG = {
  // 主开关
  enableChat: true,
  enableWakeWord: true,
  wakeWord: '机器人',
  enableAt: false,

  // 文本模型配置
  apiUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: '',
  customModel: '',
  systemPrompt: '你是一个有用的助手。',
  maxTokens: 2000,
  temperature: 0.7,
  topP: 1.0,
  enableReply: true,
  enableSplitReply: false,
  splitRegex: '[。！？!?…]+',
  maxHistoryRounds: 50,
  modelsList: [],

  // 视觉模型配置
  enableVision: false,
  visionApiUrl: 'https://api.siliconflow.cn',
  visionApiKey: '',
  visionModel: 'nex-agi/Nex-N2-Pro',          // 修改默认模型
  visionCustomModel: '',
  visionModelsList: [],

  // 黑白名单
  whitelistUsers: [],
  blacklistUsers: [],
  whitelistGroups: [],
  blacklistGroups: []
};

let currentConfig = { ...DEFAULT_CONFIG };
let logger = null;
let selfId = '';
const conversations = new Map();
const startTime = Date.now();

// ---------- 配置规范化 ----------
function normalizeConfig(config) {
  const arrFields = ['whitelistUsers', 'blacklistUsers', 'whitelistGroups', 'blacklistGroups'];
  arrFields.forEach(field => {
    if (Array.isArray(config[field])) return;
    if (typeof config[field] === 'string') {
      config[field] = config[field].split(',').map(s => s.trim()).filter(Boolean);
    } else {
      config[field] = [];
    }
  });
}

function denormalizeConfig(config) {
  const copy = { ...config };
  const arrFields = ['whitelistUsers', 'blacklistUsers', 'whitelistGroups', 'blacklistGroups'];
  arrFields.forEach(field => {
    if (Array.isArray(copy[field])) {
      copy[field] = copy[field].join(',');
    }
  });
  return copy;
}

// ---------- 加载/保存 ----------
function loadConfig(ctx) {
  try {
    if (fs.existsSync(ctx.configPath)) {
      const raw = fs.readFileSync(ctx.configPath, 'utf-8');
      currentConfig = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } else {
      currentConfig = { ...DEFAULT_CONFIG };
      saveConfig(ctx, currentConfig);
    }
  } catch (e) {
    logger?.warn('加载配置失败', e);
  }
  normalizeConfig(currentConfig);
}

async function saveConfig(ctx, config) {
  currentConfig = { ...config };
  normalizeConfig(currentConfig);
  const dir = path.dirname(ctx.configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const toSave = denormalizeConfig(currentConfig);
  fs.writeFileSync(ctx.configPath, JSON.stringify(toSave, null, 2), 'utf-8');
}

// ---------- 通用获取模型列表 ----------
async function fetchModels(apiUrl, apiKey) {
  if (!apiUrl || !apiKey) return [];
  try {
    const res = await fetch(`${apiUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const data = await res.json();
    return (data.data || []).map(m => m.id).sort();
  } catch (e) {
    throw e;
  }
}

// ---------- UI 构建 ----------
function buildConfigUI(ctx) {
  const { NapCatConfig } = ctx;

  const textModelOptions = currentConfig.modelsList.map(m => ({ label: m, value: m }));
  const visionModelOptions = currentConfig.visionModelsList.map(m => ({ label: m, value: m }));

  const modelFetchHint = '💡 保存设置后再次打开设置将自动获取模型列表。保存后，关闭插件再启用可获取模型列表。关闭插件启用后，等待5秒后再打开设置，或前往 napcat左侧菜单 扩展页面 中 找到 本插件进行设置。';

  return NapCatConfig.combine(
    NapCatConfig.html('<h3>🤖 AI 聊天插件</h3>'),

    NapCatConfig.boolean('enableChat', '总开关', DEFAULT_CONFIG.enableChat, '关闭后所有触发方式失效'),
    NapCatConfig.boolean('enableWakeWord', '启用唤醒词', DEFAULT_CONFIG.enableWakeWord, '以唤醒词开头的消息触发'),
    NapCatConfig.text('wakeWord', '唤醒词', DEFAULT_CONFIG.wakeWord, 'AI聊天前缀，例如：机器人，发送机器人你好，AI将收到你好'),
    NapCatConfig.boolean('enableAt', '启用 @ 触发', DEFAULT_CONFIG.enableAt, '@ 机器人触发'),

    NapCatConfig.html('<hr><h4>📝 文本模型配置</h4>'),
    NapCatConfig.text('apiUrl', 'API 地址', DEFAULT_CONFIG.apiUrl, '例如 https://api.deepseek.com，或者前往 https://likefirefly.com/ai 注册并实名认证后可获得16块额度，即可使用几乎所有大模型'),
    NapCatConfig.text('apiKey', 'API 密钥', DEFAULT_CONFIG.apiKey),

    NapCatConfig.html(`<p style="color:gray; font-size:0.9em;">${modelFetchHint}</p>`),
    NapCatConfig.select('model', '选择模型', textModelOptions, DEFAULT_CONFIG.model || '', '加载中...'),
    NapCatConfig.text('customModel', '自定义模型', '', '将覆盖上方选择'),
    NapCatConfig.text('systemPrompt', '系统提示词', DEFAULT_CONFIG.systemPrompt, '可设置AI的人设、世界观等'),
    NapCatConfig.text('maxTokens', 'Max Tokens', String(DEFAULT_CONFIG.maxTokens), '生成回复的最大长度（通常 1-128k）'),
    NapCatConfig.text('temperature', 'Temperature', String(DEFAULT_CONFIG.temperature), '随机性参数，0~2，越高越随机'),
    NapCatConfig.text('topP', 'Top P', String(DEFAULT_CONFIG.topP), '核采样参数，0~1，越高越多样'),
    NapCatConfig.boolean('enableReply', '引用回复', DEFAULT_CONFIG.enableReply),
    NapCatConfig.boolean('enableSplitReply', '分段回复', DEFAULT_CONFIG.enableSplitReply, '启用后按正则拆分长回复'),
    NapCatConfig.text('splitRegex', '分段正则', DEFAULT_CONFIG.splitRegex, '默认定界符 [。！？!?…]+'),
    NapCatConfig.text('maxHistoryRounds', '最大对话轮次', String(DEFAULT_CONFIG.maxHistoryRounds), '保留最近 N 轮对话，0 为不保留历史'),

    NapCatConfig.html('<hr><h4>🖼️ 视觉模型配置</h4>'),
    NapCatConfig.html('<p style="color:gray; font-size:0.9em;">💡 可前往 https://likefirefly.com/ai 注册并实名认证后，使用免费视觉模型，例如API填 https://api.siliconflow.cn，model填 nex-agi/Nex-N2-Pro</p>'),
    NapCatConfig.boolean('enableVision', '启用视觉模型', DEFAULT_CONFIG.enableVision, '开启后，@机器人或使用唤醒词发送图片时会调用视觉模型'),
    NapCatConfig.text('visionApiUrl', '视觉 API 地址', DEFAULT_CONFIG.visionApiUrl, '视觉模型接口基础 URL'),
    NapCatConfig.text('visionApiKey', '视觉 API 密钥', DEFAULT_CONFIG.visionApiKey),

    NapCatConfig.html(`<p style="color:gray; font-size:0.9em;">${modelFetchHint}</p>`),
    NapCatConfig.select('visionModel', '选择视觉模型', visionModelOptions, DEFAULT_CONFIG.visionModel || '', '加载中...'),
    NapCatConfig.text('visionCustomModel', '自定义视觉模型', '', '将覆盖上方选择'),

    NapCatConfig.html('<hr><h4>🔒 访问控制</h4>'),
    NapCatConfig.text('whitelistUsers', '用户白名单', '', '逗号分隔 QQ 号，白名单优先'),
    NapCatConfig.text('blacklistUsers', '用户黑名单', '', '逗号分隔 QQ 号'),
    NapCatConfig.text('whitelistGroups', '群白名单', '', '逗号分隔群号'),
    NapCatConfig.text('blacklistGroups', '群黑名单', '', '逗号分隔群号')
  );
}

// ---------- 发送消息 ----------
async function sendMessage(ctx, event, content, reply = false) {
  const params = {
    message_type: event.message_type,
    ...(event.message_type === 'group' && event.group_id ? { group_id: String(event.group_id) } : {}),
    ...(event.message_type === 'private' && event.user_id ? { user_id: String(event.user_id) } : {}),
    message: reply ? `[CQ:reply,id=${event.message_id}]${content}` : content,
  };
  try {
    await ctx.actions.call('send_msg', params, ctx.adapterName, ctx.pluginManager.config);
  } catch (err) {
    logger?.error('发送消息失败', err);
  }
}

// ---------- 黑白名单检查 ----------
function isAllowed(event) {
  const userId = String(event.user_id);
  const groupId = event.group_id ? String(event.group_id) : null;
  const userWhitelist = currentConfig.whitelistUsers;
  const userBlacklist = currentConfig.blacklistUsers;
  const groupWhitelist = currentConfig.whitelistGroups;
  const groupBlacklist = currentConfig.blacklistGroups;

  if (userWhitelist.length > 0) {
    if (!userWhitelist.includes(userId)) return false;
  } else {
    if (userBlacklist.includes(userId)) return false;
  }
  if (groupId) {
    if (groupWhitelist.length > 0) {
      if (!groupWhitelist.includes(groupId)) return false;
    } else {
      if (groupBlacklist.includes(groupId)) return false;
    }
  }
  return true;
}

// ---------- 对话历史 ----------
function getConversationKey(event) {
  return event.message_type === 'group' ? `group_${event.group_id}` : `private_${event.user_id}`;
}

function getHistoryMessages(key) {
  if (!conversations.has(key)) {
    conversations.set(key, [
      { role: 'system', content: currentConfig.systemPrompt || 'You are a helpful assistant.' }
    ]);
  }
  return conversations.get(key);
}

function addHistoryAndTrim(key, message, maxRounds) {
  const history = getHistoryMessages(key);
  history.push(message);
  if (maxRounds > 0) {
    const maxLen = 1 + maxRounds * 2;
    if (history.length > maxLen) {
      history.splice(1, history.length - maxLen);
    }
  } else if (maxRounds === 0) {
    history.length = 1;
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------- 提取图片文件标识 ----------
function extractImageFiles(rawMessage) {
  const matches = rawMessage.match(/\[CQ:image,file=([^,\]]+)/g);
  if (!matches) return [];
  return matches.map(m => {
    const fileMatch = m.match(/file=([^,\]]+)/);
    return fileMatch ? fileMatch[1] : null;
  }).filter(Boolean);
}

// ---------- 获取图片 Base64 Data URI ----------
async function getImageBase64(ctx, file) {
  try {
    const data = await ctx.actions.call('get_image', { file }, ctx.adapterName, ctx.pluginManager.config);
    if (data.file && data.file.startsWith('base64://')) {
      const base64 = data.file.replace('base64://', '');
      return `data:image/jpeg;base64,${base64}`;
    } else if (data.url) {
      return data.url;
    }
    throw new Error('无法获取图片数据');
  } catch (e) {
    throw new Error(`获取图片失败: ${e.message}`);
  }
}

// ---------- 视觉模型 API 调用 ----------
async function callVisionAPI(ctx, event, imageFile, promptText) {
  const apiUrl = currentConfig.visionApiUrl;
  const apiKey = currentConfig.visionApiKey;
  const model = currentConfig.visionCustomModel?.trim() || currentConfig.visionModel;

  if (!apiUrl || !apiKey || !model) {
    await sendMessage(ctx, event, '视觉模型配置不完整，请检查 API 地址、密钥和模型名称');
    return;
  }

  try {
    const imageSrc = await getImageBase64(ctx, imageFile);

    const messages = [{
      role: 'user',
      content: [
        { type: 'text', text: promptText || '请描述这张图片' },
        { type: 'image_url', image_url: { url: imageSrc } }
      ]
    }];

    const url = `${apiUrl}/v1/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: parseInt(currentConfig.maxTokens) || 2000,
        temperature: parseFloat(currentConfig.temperature) ?? 0.7,
        top_p: parseFloat(currentConfig.topP) ?? 1.0
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`视觉 API 请求失败 [${res.status}]: ${errText}`);
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error('视觉模型未返回有效内容');

    await sendMessage(ctx, event, reply, currentConfig.enableReply);
  } catch (err) {
    logger?.error('视觉识别出错', err);
    await sendMessage(ctx, event, `视觉识别失败：${err.message}`);
  }
}

// ---------- 消息处理 ----------
const plugin_onmessage = async (ctx, event) => {
  if (!currentConfig.enableChat) return;
  if (event.post_type !== 'message') return;
  if (!isAllowed(event)) return;

  const raw = event.raw_message?.trim();

  // ---------- 统一触发检测 ----------
  let userInput = '';
  let triggered = false;

  // 唤醒词触发
  if (currentConfig.enableWakeWord && currentConfig.wakeWord && raw) {
    const wake = currentConfig.wakeWord;
    const regex = new RegExp(`^${escapeRegExp(wake)}\\s*(.*)`, 'i');
    const match = raw.match(regex);
    if (match) {
      userInput = match[1]?.trim();
      triggered = true;
    }
  }

  // @ 触发（仅当未被唤醒词触发时尝试）
  if (!triggered && currentConfig.enableAt && selfId && raw) {
    const atPattern = new RegExp(`\\[CQ:at,qq=${selfId}\\]`, 'g');
    if (atPattern.test(raw)) {
      userInput = raw.replace(atPattern, '').trim();
      triggered = true;
    }
  }

  // 未触发则直接返回
  if (!triggered) return;

  // ---------- 触发后判断是否有图片，优先处理视觉模型 ----------
  const imageFiles = extractImageFiles(raw);
  if (imageFiles.length > 0 && currentConfig.enableVision) {
    // 移除图片 CQ 码后剩余的文本（如果 userInput 中不包含图片码，则直接用 userInput）
    // 但 userInput 已经去除了唤醒词/@，仍可能包含图片码，需要进一步清理
    const promptText = userInput.replace(/\[CQ:image[^\]]*\]/g, '').trim();
    await callVisionAPI(ctx, event, imageFiles[0], promptText);
    return;
  }

  // ---------- 纯文本对话 ----------
  if (!userInput) {
    await sendMessage(ctx, event, `请输入内容，如 “${currentConfig.wakeWord} 你好”`);
    return;
  }

  const model = currentConfig.customModel?.trim() || currentConfig.model;
  if (!model) {
    await sendMessage(ctx, event, '错误：未设置文本模型');
    return;
  }

  const key = getConversationKey(event);
  const maxRounds = parseInt(currentConfig.maxHistoryRounds) || 0;

  addHistoryAndTrim(key, { role: 'user', content: userInput }, maxRounds);
  const messages = [...getHistoryMessages(key)];

  const body = {
    model,
    messages,
    max_tokens: parseInt(currentConfig.maxTokens) || 2000,
    temperature: parseFloat(currentConfig.temperature) ?? 0.7,
    top_p: parseFloat(currentConfig.topP) ?? 1.0
  };

  try {
    const url = `${currentConfig.apiUrl}/v1/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentConfig.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API 请求失败 [${res.status}]: ${errText}`);
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error('AI 未返回有效内容');

    addHistoryAndTrim(key, { role: 'assistant', content: reply }, maxRounds);

    if (currentConfig.enableSplitReply && currentConfig.splitRegex) {
      const parts = reply.split(new RegExp(currentConfig.splitRegex)).filter(p => p.trim());
      for (const part of parts) {
        await sendMessage(ctx, event, part.trim(), currentConfig.enableReply);
      }
    } else {
      await sendMessage(ctx, event, reply, currentConfig.enableReply);
    }
  } catch (err) {
    logger?.error('AI 聊天出错', err);
    await sendMessage(ctx, event, `AI 调用失败：${err.message}`);
  }
};

// ---------- 辅助函数 ----------
function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}天 ${hours % 24}小时 ${minutes % 60}分钟`;
  if (hours > 0) return `${hours}小时 ${minutes % 60}分钟`;
  if (minutes > 0) return `${minutes}分钟 ${seconds % 60}秒`;
  return `${seconds}秒`;
}

// ---------- 插件生命周期 ----------
let plugin_config_ui = [];

const plugin_init = async (ctx) => {
  logger = ctx.logger;
  loadConfig(ctx);
  plugin_config_ui = buildConfigUI(ctx);

  // 获取机器人 QQ
  try {
    const info = await ctx.actions.call('get_login_info', {}, ctx.adapterName, ctx.pluginManager.config);
    selfId = String(info.user_id);
    logger.info(`机器人 QQ: ${selfId}`);
  } catch (e) {
    logger.error('获取登录信息失败，@ 触发可能不可用', e);
  }

  // 后台自动拉取模型列表
  if (currentConfig.apiUrl && currentConfig.apiKey && currentConfig.modelsList.length === 0) {
    try {
      const models = await fetchModels(currentConfig.apiUrl, currentConfig.apiKey);
      currentConfig.modelsList = models;
      await saveConfig(ctx, currentConfig);
    } catch {}
  }
  if (currentConfig.visionApiUrl && currentConfig.visionApiKey && currentConfig.visionModelsList.length === 0) {
    try {
      const models = await fetchModels(currentConfig.visionApiUrl, currentConfig.visionApiKey);
      currentConfig.visionModelsList = models;
      await saveConfig(ctx, currentConfig);
    } catch {}
  }

  // ---------- WebUI 设置 ----------
  ctx.router.static("/static", "webui");

  ctx.router.staticOnMem("/dynamic", [
    {
      path: "/info.json",
      contentType: "application/json",
      content: () => JSON.stringify({
        pluginName: ctx.pluginName,
        generatedAt: new Date().toISOString(),
        uptime: Date.now() - startTime,
        config: currentConfig
      }, null, 2)
    }
  ]);

  ctx.router.get("/status", (_req, res) => {
    res.json({
      code: 0,
      data: {
        pluginName: ctx.pluginName,
        uptime: formatUptime(Date.now() - startTime),
        platform: process.platform,
        arch: process.arch,
        config: currentConfig
      }
    });
  });

  ctx.router.get("/config", (_req, res) => {
    res.json({ code: 0, data: currentConfig });
  });

  ctx.router.post("/config", async (req, res) => {
    try {
      const newConfig = req.body;
      Object.assign(currentConfig, newConfig);
      await saveConfig(ctx, currentConfig);
      res.json({ code: 0, message: "配置已更新" });
    } catch (e) {
      res.status(500).json({ code: -1, message: e.message });
    }
  });

  ctx.router.get("/models/text", async (_req, res) => {
    try {
      const models = await fetchModels(currentConfig.apiUrl, currentConfig.apiKey);
      res.json({ code: 0, data: models });
    } catch (e) {
      res.status(500).json({ code: -1, message: e.message });
    }
  });

  ctx.router.get("/models/vision", async (_req, res) => {
    try {
      const models = await fetchModels(currentConfig.visionApiUrl, currentConfig.visionApiKey);
      res.json({ code: 0, data: models });
    } catch (e) {
      res.status(500).json({ code: -1, message: e.message });
    }
  });

  ctx.router.page({
    path: "dashboard",
    title: "AI 聊天仪表盘",
    icon: "🤖",
    htmlFile: "webui/dashboard.html",
    description: "查看 AI 聊天插件运行状态、配置与模型列表"
  });

  logger.info("WebUI 路由已注册");
};

const plugin_get_config = async () => currentConfig;

const plugin_set_config = async (ctx, config) => {
  if (config.apiUrl && config.apiKey) {
    try {
      const models = await fetchModels(config.apiUrl, config.apiKey);
      config.modelsList = models;
      if (config.model && !models.includes(config.model) && !config.customModel) {
        config.model = '';
      }
    } catch {}
  }
  if (config.visionApiUrl && config.visionApiKey) {
    try {
      const models = await fetchModels(config.visionApiUrl, config.visionApiKey);
      config.visionModelsList = models;
      if (config.visionModel && !models.includes(config.visionModel) && !config.visionCustomModel) {
        config.visionModel = '';
      }
    } catch {}
  }
  await saveConfig(ctx, config);
};

const plugin_on_config_change = async (ctx, ui, key, value, _currentConfig) => {
  if (key === 'apiUrl' || key === 'apiKey') {
    const url = key === 'apiUrl' ? value : currentConfig.apiUrl;
    const keyVal = key === 'apiKey' ? value : currentConfig.apiKey;
    if (url && keyVal) {
      try {
        const models = await fetchModels(url, keyVal);
        ui.updateField('model', {
          options: models.map(m => ({ label: m, value: m })),
          description: `✅ 获取成功，共 ${models.length} 个模型`
        });
      } catch (e) {
        ui.updateField('model', { description: `❌ 获取失败：${e.message}` });
      }
    }
  }
  if (key === 'visionApiUrl' || key === 'visionApiKey') {
    const url = key === 'visionApiUrl' ? value : currentConfig.visionApiUrl;
    const keyVal = key === 'visionApiKey' ? value : currentConfig.visionApiKey;
    if (url && keyVal) {
      try {
        const models = await fetchModels(url, keyVal);
        ui.updateField('visionModel', {
          options: models.map(m => ({ label: m, value: m })),
          description: `✅ 获取成功，共 ${models.length} 个模型`
        });
      } catch (e) {
        ui.updateField('visionModel', { description: `❌ 获取失败：${e.message}` });
      }
    }
  }
};

export {
  plugin_init,
  plugin_get_config,
  plugin_set_config,
  plugin_on_config_change,
  plugin_config_ui,
  plugin_onmessage
};