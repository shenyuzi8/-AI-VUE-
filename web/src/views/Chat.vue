<template>
  <div class="chat-container">
    <!-- PC 端侧边栏 -->
    <div class="chat-sidebar pc-sidebar">
      <div class="sidebar-header">
        <el-button 
          type="primary" 
          style="width:100%" 
          @click="userStore.token ? createConversation() : (ElMessage.warning('请先登录'), $router.push('/login'))"
        >
          + 新建会话
        </el-button>
      </div>
      
      <div v-if="!userStore.token" style="padding:20px;text-align:center;color:#909399">
        登录后查看历史会话
      </div>
      
      <div v-else class="conversation-list">
        <div
          v-for="item in conversationList"
          :key="item.id"
          class="conversation-item"
          :class="{ active: currentConversationId === item.id }"
          @click="switchConversation(item)"
        >
          <span class="conv-title">{{ item.title }}</span>
          <el-icon class="del-icon" @click.stop="deleteConversation(item.id)"><Delete /></el-icon>
        </div>
      </div>
    </div>

    <!-- 这里做了一个手机端适配收纳 -->
    <el-drawer
      v-model="mobileSidebarOpen"
      direction="ltr"
      size="260px"
      :close-on-click-modal="true"
    >
      <div class="sidebar-header">
        <el-button 
          type="primary" 
          style="width:100%" 
          @click="userStore.token ? createConversation() : (ElMessage.warning('请先登录'), $router.push('/login'))"
        >
          + 新建会话
        </el-button>
      </div>
      <div v-if="!userStore.token" style="padding:20px;text-align:center;color:#909399">
        登录后查看历史会话
      </div>
      <div v-else class="conversation-list">
        <div
          v-for="item in conversationList"
          :key="item.id"
          class="conversation-item"
          :class="{ active: currentConversationId === item.id }"
          @click="() => { switchConversation(item); mobileSidebarOpen = false; }"
        >
          <span class="conv-title">{{ item.title }}</span>
          <el-icon class="del-icon" @click.stop="deleteConversation(item.id)"><Delete /></el-icon>
        </div>
      </div>
    </el-drawer>

    <!-- 右侧聊天主区域 -->
    <div class="chat-main">
      <!-- 顶部导航 -->
      <div class="chat-header">
        <!-- 手机端菜单按钮 -->
        <el-icon class="menu-btn" @click="mobileSidebarOpen = true" v-if="isMobile">
          <Menu />
        </el-icon>
        <div class="header-title">{{ currentConversation?.title || 'AI聚合聊天' }}</div>
        <div class="header-right">
          <template v-if="!userStore.token">
            <el-button type="primary" @click="$router.push('/login')">登录</el-button>
          </template>
          <template v-else>
            <el-button @click="handleRecharge">充值</el-button>
            <el-button @click="handleLogout">退出登录</el-button>
          </template>
        </div>
      </div>

      <!-- 聊天消息 -->
      <div class="chat-messages" ref="messagesRef">
        <div v-if="messageList.length === 0 && !isStreaming" class="empty-chat">
          <h2>选择模型，开始对话</h2>
          <p>当前模型：{{ currentModel.name || '未选择' }}</p>
        </div>

        <div
          v-for="(msg, index) in messageList"
          :key="index"
          class="message-item"
          :class="{ 'user-message': msg.role === 'user' }"
        >
          <div class="message-avatar">
            <el-icon v-if="msg.role === 'assistant'"><ChatDotRound /></el-icon>
            <el-icon v-else><User /></el-icon>
          </div>
          <div class="message-content">
            <div
              class="message-text"
              v-html="msg.role === 'assistant' ? renderMarkdown(msg.content) : escapeHtml(msg.content)"
            ></div>
          </div>
        </div>

        <div v-if="isStreaming" class="message-item">
          <div class="message-avatar"><el-icon><ChatDotRound /></el-icon></div>
          <div class="message-content">
            <div class="message-text streaming-text" v-html="renderMarkdown(streamingContent)"></div>
          </div>
        </div>
      </div>

      <!-- 模型栏 -->
      <div class="model-bar">
        <div class="model-tabs">
          <el-tag v-if="currentModel.id" type="primary" class="model-tag">
            当前：{{ currentModel.name }}
          </el-tag>
          <el-tag
            v-for="model in historyModels"
            :key="model.id"
            class="model-tag"
            @click="setCurrentModel(model)"
          >
            {{ model.name }}
          </el-tag>
          <el-tag class="model-tag market-tag" @click="$router.push('/market')">
            模型市场
          </el-tag>
        </div>
      </div>

      <!-- 未登录提示 -->
      <div v-if="!userStore.token" class="login-tip">
        <el-alert
          title="您尚未登录，只能浏览界面，发送消息需要登录"
          type="info"
          show-icon
          :closable="false"
          style="max-width: 900px; margin: 0 auto 10px;"
        >
          <template #default>
            <el-button type="primary" size="small" @click="$router.push('/login')">立即登录</el-button>
          </template>
        </el-alert>
      </div>

      <!-- 输入框 -->
      <div class="chat-input-area">
        <el-input
          v-model="inputContent"
          type="textarea"
          :rows="4"
          placeholder="请输入问题，Ctrl+Enter快速发送"
          @keydown.ctrl.enter="sendMessage"
          :disabled="!currentModel.id || isStreaming"
        />
        <div class="input-footer">
          <div class="points-wrapper">
            <span class="points-info" :class="{ 'points-zero': (userInfo?.points ?? 0) <= 0 }">
              剩余点数：{{ userInfo?.points ?? 0 }}
            </span>
            <el-link 
              v-if="(userInfo?.points ?? 0) <= 0" 
              type="primary" 
              :underline="false"
              @click="handleRecharge"
              class="recharge-link"
            >
              去充值
            </el-link>
          </div>
          <el-button
            type="primary"
            @click="sendMessage"
            :loading="isStreaming"
            :disabled="!inputContent.trim() || !currentModel.id || isStreaming || (userInfo?.points ?? 0) <= 0"
          >
            {{ isStreaming ? '生成中...' : '发送' }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store'
import request from '@/utils/request'
import { ElMessage, ElMessageBox, ElDrawer } from 'element-plus'
import { Delete, ChatDotRound, User, Menu } from '@element-plus/icons-vue'
import { renderMarkdown } from '@/utils/markdown'

const router = useRouter()
const userStore = useUserStore()
const messagesRef = ref(null)

const isStreaming = ref(false)
const streamingContent = ref('')
const inputContent = ref('')
const messageList = ref([])

const userInfo = computed(() => userStore.userInfo)
const currentModel = computed(() => userStore.currentModel)
const historyModels = computed(() => userStore.historyModels)

const conversationList = ref([])
const currentConversationId = ref(null)
const currentConversation = ref(null)

// 响应式 + 手机端抽屉
const isMobile = ref(window.innerWidth < 768)
const mobileSidebarOpen = ref(false)

window.addEventListener('resize', () => {
  isMobile.value = window.innerWidth < 768
})

const escapeHtml = (str) => {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}

const getConversationList = async () => {
  if (!userStore.token) {
    conversationList.value = []
    return
  }
  try {
    const res = await request.get('/user/conversations')
    conversationList.value = res.data
    if (conversationList.value.length > 0 && !currentConversationId.value) {
      switchConversation(conversationList.value[0])
    }
  } catch (e) {
    console.error(e)
  }
}

const createConversation = async () => {
  if (!currentModel.value.id) return ElMessage.error('请先选择模型')
  try {
    const res = await request.post('/user/conversation', {
      model_id: currentModel.value.id,
      model_name: currentModel.value.name,
      title: '新会话'
    })
    conversationList.value.unshift(res.data)
    switchConversation(res.data)
    messageList.value = []
    if (isMobile.value) mobileSidebarOpen.value = false
  } catch (e) {
    console.error(e)
  }
}

const switchConversation = async (conv) => {
  currentConversationId.value = conv.id
  currentConversation.value = conv
  messageList.value = []
  try {
    const res = await request.get(`/user/conversation/${conv.id}/messages`)
    messageList.value = res.data
    scrollToBottom()
  } catch (e) {
    console.error(e)
  }
}

const deleteConversation = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除该会话吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await request.delete(`/user/conversation/${id}`)
    ElMessage.success('删除成功')
    conversationList.value = conversationList.value.filter(item => item.id !== id)
    if (currentConversationId.value === id) {
      currentConversationId.value = null
      currentConversation.value = null
      messageList.value = []
      if (conversationList.value.length > 0) {
        switchConversation(conversationList.value[0])
      }
    }
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') console.error(e)
  }
}

const sendMessage = async () => {
  if (!userStore.token) {
    ElMessage.warning('请先登录后再发送消息')
    router.push('/login')
    return
  }

  // 检查剩余点数，为0时提示并阻止发送
  const currentPoints = userInfo.value?.points ?? 0
  if (currentPoints <= 0) {
    ElMessage.error('点数不足，请充值后再发送消息')
    return
  }

  const content = inputContent.value.trim()
  if (!content || !currentModel.value.id || isStreaming.value) return

  if (!currentConversationId.value) {
    await createConversation()
  }

  messageList.value.push({ role: 'user', content })
  inputContent.value = ''
  streamingContent.value = ''
  isStreaming.value = true
  scrollToBottom()

  const messages = [
    ...messageList.value.map(item => ({
      role: item.role,
      content: item.content
    }))
  ]

  try {
    const response = await fetch('/api/user/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userStore.token}`
      },
      body: JSON.stringify({
        conversation_id: currentConversationId.value,
        model_id: currentModel.value.id,
        messages: messages,
        stream: true
      })
    })

    if (!response.ok) throw new Error('请求失败')

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let done = false
    let finalData = null

    while (!done) {
      const { value, done: readerDone } = await reader.read()
      done = readerDone
      if (value) {
        const chunkStr = decoder.decode(value)
        const lines = chunkStr.split('\n').filter(line => line.trim() !== '')
        
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const dataStr = line.slice(6).trim()
          
          if (dataStr === '[DONE]') continue
          
          try {
            const data = JSON.parse(dataStr)
            if (data.error) throw new Error(data.error)
            if (data.content) {
              streamingContent.value += data.content
              scrollToBottom()
            }
            if (data.done) {
              finalData = data
              if (data.conversation_title && currentConversation.value) {
                currentConversation.value.title = data.conversation_title
                const target = conversationList.value.find(i => i.id === currentConversationId.value)
                if (target) target.title = data.conversation_title
              }
            }
          } catch {}
        }
      }
    }

    if (streamingContent.value) {
      messageList.value.push({
        role: 'assistant',
        content: streamingContent.value
      })
    }

    if (finalData?.remaining_points !== undefined) {
      userStore.updatePoints(finalData.remaining_points)
      // 点数为0时额外提示充值
      if (finalData.remaining_points <= 0) {
        ElMessage.warning('点数已用完，请及时充值')
      }
    }

  } catch (e) {
    ElMessage.error('AI 响应失败，请重试')
  } finally {
    isStreaming.value = false
    streamingContent.value = ''
    scrollToBottom()
  }
}

const handleLogout = () => {
  userStore.logout()
  router.push('/login')
  ElMessage.success('已退出登录')
  conversationList.value = []
  messageList.value = []
  currentConversationId.value = null
}

const handleRecharge = async () => {
  const email = userStore.userInfo?.email
  if (!email) {
    ElMessage.warning('请先登录')
    return
  }

  // 充值档位（可自定义）
  const rechargeOptions = [
    { points: 10, money: 1.00 },
    { points: 50, money: 5.00 },
    { points: 250, money: 25.00 },
    { points: 500, money: 50.00 },
    { points: 1000, money: 100.00 },
    { label: '其他...', custom: true }
  ]

  // 创建弹窗 DOM
  const div = document.createElement('div')
  div.innerHTML = `
    <div class="recharge-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px);">
      <div class="modal-content" style="background: #fef9ef; color: #2c3e4e; border-radius: 24px; width: 660px; max-width: 92%; padding: 28px 24px 32px; box-sizing: border-box; box-shadow: 0 20px 35px -12px rgba(0,0,0,0.2); font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
          <h2 style="margin: 0; font-size: 26px; font-weight: 600; color: #1e2f3a;">选择一个金额</h2>
          <span class="close-btn" style="cursor: pointer; font-size: 32px; line-height: 1; color: #7f8c8d; transition: color 0.2s;">&times;</span>
        </div>
        <p style="text-align: center; color: #5d6f7f; margin-bottom: 28px; font-size: 15px; letter-spacing: 0.3px;">
          💡 寻求弹性计费？<a href="#" style="color: #3b82f6; text-decoration: none; font-weight: 500;">弹性付费</a>
        </p>
        <div class="recharge-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-bottom: 32px;"></div>
        <button class="submit-btn" style="width: 100%; padding: 14px; border-radius: 60px; border: none; background: #3b82f6; color: white; font-size: 18px; cursor: pointer; font-weight: 600; transition: all 0.2s ease; box-shadow: 0 4px 8px rgba(59,130,246,0.2);">
          + 购买 点数
        </button>
      </div>
    </div>
    <style>
      .recharge-modal .recharge-btn {
        background: #ffffff;
        border: 1px solid #e9eef3;
        border-radius: 20px;
        padding: 18px 12px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 2px 6px rgba(0,0,0,0.02);
      }
      .recharge-modal .recharge-btn:hover {
        transform: translateY(-2px);
        border-color: #b9d0f0;
        background: #fafcff;
        box-shadow: 0 8px 18px rgba(59,130,246,0.12);
      }
      .recharge-modal .close-btn:hover {
        color: #3b82f6 !important;
      }
      .recharge-modal .submit-btn:hover {
        background: #2563eb;
        transform: scale(0.98);
        box-shadow: 0 6px 14px rgba(59,130,246,0.3);
      }
      .recharge-modal .submit-btn:active {
        transform: scale(0.96);
      }
      .recharge-modal .custom-input {
        width: 80%;
        margin: 12px auto 0;
        display: block;
        padding: 10px 12px;
        border-radius: 40px;
        border: 1px solid #dce3ec;
        background: #ffffff;
        font-size: 15px;
        text-align: center;
        font-weight: 500;
        color: #1e2f3a;
        outline: none;
        transition: 0.2s;
      }
      .recharge-modal .custom-input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59,130,246,0.2);
      }
      .recharge-modal .custom-label {
        font-size: 16px;
        font-weight: 500;
        color: #2c3e4e;
        margin-bottom: 6px;
      }
    </style>
  `
  document.body.appendChild(div)

  const modal = div.querySelector('.recharge-modal')
  const grid = div.querySelector('.recharge-grid')
  const submitBtn = div.querySelector('.submit-btn')
  const closeBtn = div.querySelector('.close-btn')

  let selected = null
  let customMoney = null

  // 更新选中状态
  const updateSelection = (activeBtn, amount = null, isCustom = false) => {
    div.querySelectorAll('.recharge-btn').forEach(btn => {
      btn.style.border = '1px solid #e9eef3'
      btn.style.background = '#ffffff'
      btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.02)'
    })
    if (activeBtn) {
      activeBtn.style.border = '2px solid #3b82f6'
      activeBtn.style.background = '#eff6ff'
      activeBtn.style.boxShadow = '0 8px 18px rgba(59,130,246,0.15)'
    }

    if (isCustom && amount && amount > 0) {
      submitBtn.textContent = `+ 充值 ${amount.toFixed(2)} 元`
    } else if (selected && !selected.custom) {
      submitBtn.textContent = `+ 购买 ${selected.points} 点数`
    } else if (selected && selected.custom && customMoney && customMoney > 0) {
      submitBtn.textContent = `+ 充值 ${customMoney.toFixed(2)} 元`
    } else {
      submitBtn.textContent = `+ 购买 点数`
    }
  }

  rechargeOptions.forEach((opt, idx) => {
    const btn = document.createElement('div')
    btn.className = 'recharge-btn'

    if (opt.custom) {
      btn.innerHTML = `
        <div class="custom-label">✨ 其他...</div>
        <input type="number" class="custom-input" placeholder="输入金额 (元)" step="0.01" min="0.01">
      `
      const inputEl = btn.querySelector('.custom-input')
      
      inputEl.addEventListener('input', (e) => {
        let val = parseFloat(e.target.value)
        if (!isNaN(val) && val > 0) {
          selected = opt
          customMoney = val
          updateSelection(btn, val, true)
        } else {
          if (selected === opt) {
            selected = null
            customMoney = null
            updateSelection(null)
          }
          if (selected && selected !== opt) {
            const otherActive = Array.from(div.querySelectorAll('.recharge-btn')).find(b => {
              const isCustom = b.querySelector('.custom-input')
              if (isCustom) return false
              return b._selected
            })
            if (otherActive) {
              otherActive.style.border = '2px solid #3b82f6'
              otherActive.style.background = '#eff6ff'
            }
          } else {
            updateSelection(null)
          }
        }
      })

      btn.addEventListener('click', (e) => {
        if (e.target !== inputEl) {
          inputEl.focus()
        }
      })
    } else {
      btn.innerHTML = `
        <div style="font-size: 28px; font-weight: 600; margin-bottom: 6px; color: #1f3a4b;">☁️ ${opt.points}</div>
        <div style="font-size: 16px; font-weight: 500; color: #3b82f6;">${opt.money.toFixed(2)} ¥</div>
      `
      btn.onclick = () => {
        const customCard = Array.from(div.querySelectorAll('.recharge-btn')).find(b => b.querySelector('.custom-input'))
        if (customCard) {
          const customInput = customCard.querySelector('.custom-input')
          customInput.value = ''
        }
        selected = opt
        customMoney = null
        updateSelection(btn)
        div.querySelectorAll('.recharge-btn').forEach(b => b._selected = false)
        btn._selected = true
      }
    }

    grid.appendChild(btn)
  })

  closeBtn.onclick = () => modal.remove()
  modal.onclick = (e) => { if (e.target === modal) modal.remove() }

  submitBtn.onclick = () => {
    if (!selected) {
      ElMessage.warning('请选择充值档位或输入有效的自定义金额')
      return
    }

    const amount = customMoney || (selected.money ? selected.money : null)
    if (!amount || amount <= 0) {
      ElMessage.warning('请选择或输入有效的充值金额')
      return
    }

    const form = document.createElement('form')
    form.method = 'POST'
    form.action = '' //充值 支付跳转接口地址，填写自定义的接口。
    form.target = '_blank'

    const inputAmount = document.createElement('input')
    inputAmount.type = 'hidden'
    inputAmount.name = 'amount'
    inputAmount.value = amount

    const inputBody = document.createElement('input')
    inputBody.type = 'hidden'
    inputBody.name = 'body'
    inputBody.value = email

    form.appendChild(inputAmount)
    form.appendChild(inputBody)
    document.body.appendChild(form)
    form.submit()
    document.body.removeChild(form)

    modal.remove()
    ElMessage.success('已打开支付页面，支付成功后点数自动到账')

    startCheckRecharge(email)
  }
}

function startCheckRecharge(email) {
  let count = 0
  const timer = setInterval(async () => {
    count++
    if (count > 60) {
      clearInterval(timer)
      ElMessage.info('支付查询超时，请稍后查看点数')
      return
    }
    try {
      const { data } = await request.get('/user/recharge/check', {
        params: { mark: email }
      })
      if (data?.success) {
        clearInterval(timer)
        ElMessage.success('充值成功！点数已到账！')
        userStore.updatePoints(data.remaining_points)
      }
    } catch (e) {
      // 静默处理
    }
  }, 2000)
}

const setCurrentModel = (model) => {
  userStore.setCurrentModel(model)
  ElMessage.success(`已切换：${model.name}`)
}

onMounted(() => {
  getConversationList()
})
</script>

<style scoped>
.chat-container {
  display: flex;
  width: 100vw;
  height: 100vh;
  background: #f5f5f5;
  overflow: hidden;
}

/* PC 侧边栏 */
.chat-sidebar {
  width: 260px;
  background: #fff;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
@media (max-width: 768px) {
  .pc-sidebar {
    display: none;
  }
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #e4e7ed;
}
.conversation-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.conversation-item {
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.conversation-item:hover {
  background: #f5f7fa;
}
.conversation-item.active {
  background: #ecf5ff;
  color: #409eff;
}
.conv-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.del-icon {
  opacity: 0;
}
.conversation-item:hover .del-icon {
  opacity: 1;
}

/* 主内容 */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
}

/* 头部 */
.chat-header {
  height: 60px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 12px;
}
.menu-btn {
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.header-title {
  font-size: 18px;
  font-weight: 600;
  flex: 1;
}
.header-right {
  display: flex;
  gap: 8px;
}

/* 消息区域 */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}
@media (max-width: 768px) {
  .chat-messages {
    padding: 12px 8px;
  }
}

.empty-chat {
  text-align: center;
  margin-top: 100px;
  color: #999;
}

.message-item {
  display: flex;
  margin-bottom: 20px;
  gap: 12px;
}
.message-item.user-message {
  flex-direction: row-reverse;
}
.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #409eff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.message-item.user-message .message-avatar {
  background: #67c23a;
}
.message-content {
  max-width: 70%;
}
@media (max-width: 768px) {
  .message-content {
    max-width: 90%;
  }
}
.message-text {
  padding: 12px 16px;
  border-radius: 8px;
  background: #fff;
  line-height: 1.6;
  word-break: break-word;
}
.message-item.user-message .message-text {
  background: #ecf5ff;
}

/* 流式光标 */
.streaming-text::after {
  content: "|";
  animation: blink 1s infinite;
  font-weight: bold;
}
@keyframes blink {
  0%,100%{opacity:1;}50%{opacity:0;}
}

/* Markdown */
.message-text :deep(pre) {
  background: #f6f8fa;
  border-radius: 6px;
  padding: 12px;
  overflow-x: auto;
}
.message-text :deep(code) {
  background: #f6f8fa;
  padding: 2px 6px;
  border-radius: 4px;
}
.message-text :deep(pre code) {
  background: none;
  padding: 0;
}
.message-text :deep(blockquote) {
  border-left: 4px solid #409eff;
  padding: 10px;
  background: #f5f7ff;
}
.message-text :deep(table) {
  border-collapse: collapse;
  width: 100%;
}
.message-text :deep(th),.message-text :deep(td){
  border:1px solid #ddd;padding:6px;
}
.message-text :deep(img){max-width:100%;border-radius:4px;}

/* 模型栏 */
.model-bar {
  padding: 10px 20px;
  background: #fff;
  border-top: 1px solid #eee;
}
.model-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  max-width: 900px;
  margin: 0 auto;
}

/* 输入框 */
.chat-input-area {
  padding: 0 20px 20px;
  background: #fff;
}
@media (max-width:768px){
  .chat-input-area{padding:0 10px 15px;}
}
.chat-input-area :deep(.el-textarea__inner) {
  border-radius: 8px;
  max-width: 900px;
  margin: 0 auto;
}
.input-footer {
  max-width: 900px;
  margin: 10px auto 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.points-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.points-info {
  font-size: 13px;
  color: #909399;
  transition: color 0.2s;
}

.points-info.points-zero {
  color: #f56c6c !important;
  font-weight: 500;
}

.recharge-link {
  font-size: 12px;
}

.login-tip {
  padding: 0 20px;
}
</style>