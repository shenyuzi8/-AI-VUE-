<template>
  <div class="order-page">
    <h2 class="page-title">充值订单管理</h2>

    <el-card shadow="hover" class="card">
      <el-table :data="orders" border stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="order_no" label="订单号" min-width="180" />
        <el-table-column prop="email" label="用户邮箱" min-width="200" />
        <el-table-column prop="money" label="充值金额" width="110">
          <template #default="scope">¥ {{ scope.row.money }}</template>
        </el-table-column>
        <el-table-column prop="points" label="到账点数" width="110" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 1 ? 'success' : 'warning'">
              {{ scope.row.status === 1 ? '已支付' : '未支付' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" min-width="200" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import request from '../utils/request'

const orders = ref([])

const getOrders = async () => {
  try {

    const { data } = await request.get('/api/admin/order/list')
    orders.value = data.list || []
  } catch (e) {
    console.error('获取订单失败', e)
  }
}

onMounted(() => {
  getOrders()
})
</script>

<style scoped>
.order-page {
  width: 100%;
}
.page-title {
  margin: 0 0 20px 0;
  font-size: 22px;
  color: #333;
}
.card {
  border-radius: 12px;
}
</style>