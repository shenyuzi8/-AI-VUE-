<template>
  <div class="market-container">
    <div class="market-header">
      <el-button type="default" @click="$router.push('/')">← 返回聊天</el-button>
      <h1>模型市场</h1>
    </div>
    <div class="model-grid">
      <div v-for="model in modelList" :key="model.id" class="model-card">
        <div class="card-header">
          <h3>{{ model.name }}</h3>
          <el-tag v-if="model.tags" size="small">{{ model.tags }}</el-tag>
        </div>
        <div class="card-info">
          <p>每1000Token消耗：<span class="price">{{ model.price_per_1k_token }} 点数</span></p>
        </div>
        <div class="card-footer">
          <el-button type="primary" @click="useModel(model)">立即使用</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store'
import request from '@/utils/request'
import { ElMessage } from 'element-plus'

const router = useRouter()
const userStore = useUserStore()
const modelList = ref([])

//获取模型列表
const getModelList = async () => {
  try {
    const res = await request.get('/public/models')
    modelList.value = res.data
  } catch (e) {
    console.error(e)
  }
}

//使用模型
const useModel = (model) => {
  userStore.setCurrentModel(model)
  ElMessage.success(`已选择模型：${model.name}`)
  router.push('/')
}

onMounted(() => {
  getModelList()
})
</script>

<style scoped>
.market-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20px;
}
.market-header {
  max-width: 1200px;
  margin: 0 auto 30px;
  display: flex;
  align-items: center;
  gap: 20px;
}
.market-header h1 {
  margin: 0;
  color: #303133;
}
.model-grid {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}
.model-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.1);
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
}
.model-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.card-header h3 {
  margin: 0;
  font-size: 18px;
  color: #303133;
}
.card-info {
  flex: 1;
  margin-bottom: 20px;
}
.price {
  color: #e6a23c;
  font-weight: 600;
}
.card-footer {
  text-align: center;
}
</style>