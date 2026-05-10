<template>
  <div>
    <h2>数据概览</h2>
    <el-row :gutter="20" class="mt10">
      <el-col :span="6" v-for="item in list" :key="item.label">
        <el-card>
          <div class="num">{{ item.value }}</div>
          <div class="label">{{ item.label }}</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import request from '../utils/request.js'

const list = ref([
  { label: '总用户数', value: 0 },
  { label: '累计充值', value: 0 },
  { label: '模型数量', value: 0 },
  { label: '消息总数', value: 0 },
])

onMounted(async () => {
  const res = await request.get('/api/admin/dashboard')
  list.value[0].value = res.data.total_user
  list.value[1].value = res.data.total_recharge + ' 元'
  list.value[2].value = res.data.total_model
  list.value[3].value = res.data.total_message
})
</script>

<style scoped>
.num { font-size:32px; font-weight:bold; color:#409eff; margin-bottom:8px; }
.label { color:#999; }
.mt10 { margin-top:10px; }
</style>