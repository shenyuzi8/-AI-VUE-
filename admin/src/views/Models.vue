<template>
  <div>
    <div class="flex-between">
      <h3>模型管理</h3>
      <el-button type="primary" @click="openAdd">+ 新增模型</el-button>
    </div>

    <el-table :data="models" border class="mt15">
      <el-table-column prop="id" label="ID" />
      <el-table-column prop="name" label="模型名" />
      <el-table-column prop="api_url" label="API 地址" />
      <el-table-column prop="price_per_1k_token" label="1000token 点数" />
      <el-table-column prop="tags" label="标签" />
      <el-table-column label="状态">
        <template #default="{row}">
          <el-tag :type="row.status==1?'success':'danger'">
            {{ row.status==1?'启用':'禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作">
        <template #default="{row}">
          <el-button text @click="openEdit(row)">编辑</el-button>
          <el-button text type="danger" @click="del(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialog" title="模型配置">
      <el-form :model="form" label-width="100px">
        <el-form-item label="模型名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="API 地址"><el-input v-model="form.api_url" /></el-form-item>
        <el-form-item label="API Key"><el-input v-model="form.api_key" /></el-form-item>
        <el-form-item label="1000token消耗"><el-input v-model="form.price_per_1k_token" type="number" /></el-form-item>
        <el-form-item label="标签"><el-input v-model="form.tags" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option :value="1" label="启用" />
            <el-option :value="0" label="禁用" />
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

const models = ref([])
const dialog = ref(false)
const form = ref({})
const isEdit = ref(false)

const getList = async () => {
  const res = await request.get('/api/admin/models')
  models.value = res.data
}

const openAdd = () => {
  form.value = { name: '', api_url: '', api_key: '', price_per_1k_token: 1, tags: '', status: 1 }
  isEdit.value = false
  dialog.value = true
}

const openEdit = (row) => {
  form.value = { ...row }
  isEdit.value = true
  dialog.value = true
}

const save = async () => {
  if (isEdit.value) {
    await request.put(`/api/admin/model/${form.value.id}`, form.value)
  } else {
    await request.post('/api/admin/model', form.value)
  }
  ElMessage.success('保存成功')
  dialog.value = false
  getList()
}

const del = async (id) => {
  await request.delete(`/api/admin/model/${id}`)
  ElMessage.success('删除成功')
  getList()
}

onMounted(getList)
</script>

<style scoped>
.flex-between { display:flex; justify-content:space-between; align-items:center; }
.mt15 { margin-top:15px; }
</style>