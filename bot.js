/**
 * 个人微信（网页版协议）群 AI 机器人：消息含「AI」或 @ 自己时调 DeepSeek，回复最多 25 个字。
 * @ +「今日运势」：本地词库 + 按用户+日期固定的伪随机运势。
 * 依赖 wechaty + wechaty-puppet-wechat，运行：node bot.js
 *
 * 注意：微信对网页版限制很多，大号也可能无法登录；仅作技术尝试，不保证可用。
 */
require('dotenv').config()
const axios = require('axios')
const { WechatyBuilder } = require('wechaty')
const { PuppetWeChat } = require('wechaty-puppet-wechat')

const MAX_REPLY_CHARS = 25

/** 今日运势词库（写死） */
const FORTUNE_POOL = {
  yun: ['大吉', '中吉', '小吉', '一般', '小凶', '大凶'],
  cai: ['暴富', '小赚', '平平', '别买', '要亏', '吃土'],
  gan: ['脱单', '有戏', '暧昧', '无感', '危险', '凉了'],
  jian: [
    '别摆烂',
    '早点睡',
    '去学习',
    '别冲动',
    '多喝水',
    '别想她',
    '赶DDL',
    '别点外卖',
    '你不行',
    '继续卷',
    '醒醒',
  ],
}

/** 字符串 -> 32 位无符号整数，作种子（FNV-1a） */
function hashSeed(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * 基于种子的线性同余伪随机（不使用 Math.random）
 * 同一 seed 串得到同一序列；配合 用户名+日期 即「同人同日固定」。
 */
function createSeededPrng(seedStr) {
  let state = hashSeed(seedStr)
  if (state === 0) state = 0x9e3779b9
  return function nextU32() {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0
    return state
  }
}

function pickFromPool(prng, arr) {
  return arr[prng() % arr.length]
}

function localDateYMD() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** @ + 今日运势 专用回复（格式固定） */
function buildTodayFortuneForUser(userName) {
  const dateStr = localDateYMD()
  const seed = `${userName}|${dateStr}`
  const prng = createSeededPrng(seed)
  const yun = pickFromPool(prng, FORTUNE_POOL.yun)
  const cai = pickFromPool(prng, FORTUNE_POOL.cai)
  const gan = pickFromPool(prng, FORTUNE_POOL.gan)
  const jian = pickFromPool(prng, FORTUNE_POOL.jian)
  return `运势：${yun}\n财运：${cai}\n感情：${gan}\n建议：${jian}`
}

function truncateToChars(str, n) {
  const s = String(str ?? '').trim()
  return [...s].slice(0, n).join('')
}

async function callDeepSeek(userMessage) {
  const key = process.env.API_KEY
  if (!key) {
    throw new Error('缺少环境变量 API_KEY，请在 .env 中配置')
  }

  const { data } = await axios.post(
    'https://api.deepseek.com/chat/completions',
    {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            '你是微信群里的吐槽役：毒舌、讽刺但无脏字。回答尽量不超过25个字（汉字算一个字）。' +
            '用户让你正经时可以稍微收敛，但仍保持冷幽默。',
        },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.8,
      max_tokens: 80,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      timeout: 60000,
    }
  )

  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string') {
    throw new Error('DeepSeek 返回格式异常')
  }
  return text.trim()
}

const bot = WechatyBuilder.build({
  name: 'group-ai-bot',
  puppet: new PuppetWeChat({ uos: true }),
})

bot
  .on('scan', (qrcode, status) => {
    const url = `https://wechaty.js.org/qrcode/${encodeURIComponent(qrcode)}`
    console.log(`请使用微信扫码登录 (status=${status})：\n${url}`)
  })
  .on('login', (user) => {
    console.log(`已登录：${user.name()}`)
  })
  .on('logout', (user) => {
    console.log(`已登出：${user?.name?.() ?? user}`)
  })
  .on('error', (e) => {
    console.error('[wechaty error]', e)
  })
  .on('message', async (message) => {
    const room = message.room()
    const text = message.text() || ''
    let mentionSelf = false
    try {
      mentionSelf = await message.mentionSelf()
    } catch (e) {
      console.warn('[mentionSelf]', e.message)
    }

    console.log('[message]', {
      room: room ? await room.topic() : null,
      self: message.self(),
      text: text.slice(0, 200),
      mentionSelf,
    })

    if (message.self()) return
    if (!room) return

    // @机器人 + 「今日运势」：不走 DeepSeek，同人同日结果固定
    if (mentionSelf && text.includes('今日运势')) {
      const talker = message.talker()
      const userName = talker.name() || talker.alias() || talker.id || 'unknown'
      const fortuneText = buildTodayFortuneForUser(userName)
      console.log('[今日运势]', { userName, date: localDateYMD(), reply: fortuneText })
      await room.say(fortuneText)
      return
    }

    const hitKeyword = text.includes('AI')
    if (!hitKeyword && !mentionSelf) return

    try {
      const raw = await callDeepSeek(text)
      const reply = truncateToChars(raw, MAX_REPLY_CHARS)
      if (!reply) return
      await room.say(reply)
    } catch (err) {
      console.error('[DeepSeek]', err.response?.data ?? err.message)
    }
  })

bot.start().catch((e) => {
  console.error('启动失败:', e)
  process.exit(1)
})
