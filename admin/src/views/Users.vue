<template>
  <div>
    <h3>用户管理</h3>
    <el-table :data="users" border class="mt15">
      <el-table-column prop="id" label="ID" />
      <el-table-column prop="email" label="邮箱" />
      <el-table-column prop="points" label="剩余点数" />
      <el-table-column prop="total_recharge" label="累计充值" />
      <el-table-column prop="role" label="角色" />
      <el-table-column prop="created_at" label="创建时间" />
      <el-table-column label="操作">
        <template #default="{row}">
          <el-button text @click="openEdit(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialog" title="编辑用户">
      <el-form :model="form" label-width="100px">
        <el-form-item label="邮箱"><el-input v-model="form.email" disabled /></el-form-item>
        <el-form-item label="密码"><el-input v-model="form.password" placeholder="留空不修改" /></el-form-item>
        <el-form-item label="点数"><el-input v-model="form.points" type="number" /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role">
            <el-option label="用户" value="user" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog=false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import request from '../utils/request.js'
import { ElMessage } from 'element-plus'

const users = ref([])
const dialog = ref(false)
const form = ref({})

const getList = async () => {
  const res = await request.get('/api/admin/users')
  users.value = res.data
}

const openEdit = (row) => {
  form.value = { ...row, password: '' }
  dialog.value = true
}

const save = async () => {
  await request.put(`/api/admin/user/${form.value.id}`, form.value)
  ElMessage.success('保存成功')
  dialog.value = false
  getList()
}

onMounted(getList)
</script>

<style scoped>
.mt15 { margin-top:15px; }
</style>