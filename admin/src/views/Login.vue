<template>
  <div class="login-page">
    <div class="login-box">
      <h2>AI 管理后台登录</h2>
      <el-form :model="form" label-width="0">
        <el-form-item>
          <el-input v-model="form.email" placeholder="邮箱" size="large" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" placeholder="密码" type="password" size="large" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" block size="large" @click="login" :loading="loading">
            登录
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import request from '../utils/request.js'
import { ElMessage } from 'element-plus'

const router = useRouter()
const form = ref({ email: 'admin@admin.com', password: '123456' })
const loading = ref(false)

const login = async () => {
  loading.value = true
  const res = await request.post('/api/public/login', form.value)
  loading.value = false
  if (res.code === 200) {
    if (res.data.userInfo.role !== 'admin') {
      ElMessage.error('非管理员账号')
      return
    }
    localStorage.setItem('admin_token', res.data.token)
    ElMessage.success('登录成功')
    router.push('/admin/dashboard')
  } else {
    ElMessage.error(res.msg)
  }
}
</script>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}
.login-box {
  width: 400px;
  padding: 40px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 0 20px rgba(0,0,0,0.1);
}
.login-box h2 {
  text-align: center;
  margin-bottom: 30px;
}
</style>