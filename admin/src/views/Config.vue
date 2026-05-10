<template>
  <div>
    <h3>系统配置</h3>
    <el-card class="mt15">
      <el-form :model="form" label-width="150px" :disabled="loading">
        <el-form-item label="SMTP 服务器"><el-input v-model="form.smtp_host" /></el-form-item>
        <el-form-item label="SMTP 端口"><el-input v-model="form.smtp_port" type="number" /></el-form-item>
        <el-form-item label="发件邮箱"><el-input v-model="form.smtp_email" /></el-form-item>
        <el-form-item label="SMTP 授权码"><el-input v-model="form.smtp_auth_code" show-password /></el-form-item>
        <el-divider />
        <el-form-item label="1元 = 多少点数"><el-input v-model="form.money_to_points" type="number" /></el-form-item>
        <el-form-item>
          <el-button type="primary" @click="save" :loading="loading">保存配置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import request from '../utils/request.js'
import { ElMessage } from 'element-plus'

const form = ref({})
const loading = ref(false)

const getConfig = async () => {
  const res = await request.get('/api/admin/config')
  form.value = res.data
}

const save = async () => {
  loading.value = true
  await request.put('/api/admin/config', form.value)
  loading.value = false
  ElMessage.success('保存成功')
}

onMounted(getConfig)
</script>

<style scoped>
.mt15 { margin-top:15px; }
</style>