<template>
  <div class="login-container">
    <div class="login-box">
      <h2>AI聚合聊天系统</h2>
      <el-tabs v-model="activeTab" type="card" class="login-tabs">
        <!-- 登录Tab -->
        <el-tab-pane label="登录" name="login">
          <!-- 登录模式选择 -->
          <el-radio-group v-model="loginMode" style="margin-bottom:20px;display:block;text-align:center">
            <el-radio value="password">密码登录</el-radio>
            <el-radio value="code">验证码登录</el-radio>
          </el-radio-group>

          <el-form :model="loginForm" label-width="80px">
            <el-form-item label="邮箱">
              <el-input v-model="loginForm.email" placeholder="请输入邮箱" />
            </el-form-item>

            <!-- 密码登录模式：仅显示密码框 -->
            <el-form-item v-if="loginMode === 'password'" label="密码">
              <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" @keyup.enter="handleLogin" />
            </el-form-item>

            <!-- 验证码登录模式：仅显示验证码 -->
            <el-form-item v-if="loginMode === 'code'" label="验证码">
              <div class="code-input">
                <el-input v-model="loginForm.code" placeholder="请输入验证码" style="flex:1" @keyup.enter="handleLogin" />
                <el-button :disabled="codeCountdown > 0" @click="sendCode('login')">
                  {{ codeCountdown > 0 ? `${codeCountdown}秒后重发` : '获取验证码' }}
                </el-button>
              </div>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" style="width:100%" @click="handleLogin" :loading="loading">
                {{ loginMode === 'password' ? '密码登录' : '验证码登录' }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 注册Tab -->
        <el-tab-pane label="账号注册" name="register">
          <el-form :model="registerForm" label-width="80px">
            <el-form-item label="邮箱">
              <el-input v-model="registerForm.email" placeholder="请输入邮箱" />
            </el-form-item>
            <el-form-item label="密码">
              <el-input v-model="registerForm.password" type="password" placeholder="请设置密码" />
            </el-form-item>
            <el-form-item label="验证码">
              <div class="code-input">
                <el-input v-model="registerForm.code" placeholder="请输入验证码" style="flex:1" />
                <el-button :disabled="codeCountdown > 0" @click="sendCode('register')">
                  {{ codeCountdown > 0 ? `${codeCountdown}秒后重发` : '获取验证码' }}
                </el-button>
              </div>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" style="width:100%" @click="handleRegister" :loading="loading">注册</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store'
import request from '@/utils/request'
import { ElMessage } from 'element-plus'

const router = useRouter()
const userStore = useUserStore()
const activeTab = ref('login')
const loginMode = ref('password')
const loading = ref(false)
const codeCountdown = ref(0)
let countdownTimer = null

// 表单数据
const loginForm = ref({
  email: '',
  password: '',
  code: ''
})

const registerForm = ref({
  email: '',
  password: '',
  code: ''
})

// 发送验证码
const sendCode = async (type) => {
  const email = type === 'login' ? loginForm.value.email : registerForm.value.email
  if (!email) return ElMessage.error('请先输入邮箱')

  try {
    await request.post('/public/send-code', { email })
    ElMessage.success('验证码发送成功')
    codeCountdown.value = 60
    countdownTimer = setInterval(() => {
      codeCountdown.value--
      if (codeCountdown.value <= 0) clearInterval(countdownTimer)
    }, 1000)
  } catch (e) {
    console.error(e)
  }
}

//登录逻辑
const handleLogin = async () => {
  //基础邮箱校验
  if (!loginForm.value.email) return ElMessage.error('请输入邮箱')

  //根据登录模式做不同校验
  if (loginMode.value === 'password') {
    //密码模式：必须填密码
    if (!loginForm.value.password) return ElMessage.error('请输入密码')
    //密码模式下，清空code（避免干扰）
    loginForm.value.code = ''
  } else {
    //验证码模式：必须填验证码
    if (!loginForm.value.code) return ElMessage.error('请输入验证码')
    //验证码模式下，清空password
    loginForm.value.password = ''
  }

  loading.value = true
  try {
    const res = await request.post('/public/login', loginForm.value)
    userStore.setLoginInfo(res.data)
    ElMessage.success('登录成功')
    router.push('/')
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

// 注册
const handleRegister = async () => {
  if (!registerForm.value.email || !registerForm.value.password || !registerForm.value.code) {
    return ElMessage.error('请填写完整信息')
  }
  loading.value = true
  try {
    await request.post('/public/register', registerForm.value)
    ElMessage.success('注册成功，请登录')
    activeTab.value = 'login'
    loginForm.value.email = registerForm.value.email
    loginForm.value.password = registerForm.value.password
    loginMode.value = 'password'
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

//清除定时器
onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer)
})
</script>

<style scoped>
.login-container {
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}
.login-box {
  width: 420px;
  background: #fff;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}
.login-box h2 {
  text-align: center;
  margin-bottom: 20px;
  color: #333;
}
.code-input {
  display: flex;
  gap: 10px;
}
</style>