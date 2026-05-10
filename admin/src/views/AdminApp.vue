<template>
  <div class="admin-layout">
    <el-container style="height:100%">
      <el-aside width="220px" class="aside">
        <div class="logo">AI 管理后台</div>
        <el-menu
          :default-active="$route.path"
          router
          background-color="#304156"
          text-color="#bfcbd9"
          active-text-color="#409eff"
        >
          <el-menu-item index="/admin/dashboard">
            <el-icon><Odometer /></el-icon>
            <span>数据概览</span>
          </el-menu-item>
          <el-menu-item index="/admin/models">
            <el-icon><MagicStick /></el-icon>
            <span>模型管理</span>
          </el-menu-item>
          <el-menu-item index="/admin/users">
            <el-icon><User /></el-icon>
            <span>用户管理</span>
          </el-menu-item>
          <el-menu-item index="/admin/config">
            <el-icon><Setting /></el-icon>
            <span>系统配置</span>
          </el-menu-item>

          <el-menu-item index="/admin/orders">
            <el-icon><Tickets /></el-icon>
            <span>订单管理</span>
          </el-menu-item>

        </el-menu>
      </el-aside>

      <el-container>
        <el-header class="header">
          <div></div>
          <el-button text @click="logout">退出登录</el-button>
        </el-header>
        <el-main class="main">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
const router = useRouter()

const logout = () => {
  localStorage.removeItem('admin_token')
  ElMessage.success('退出成功')
  router.push('/login')
}
</script>

<style scoped>
.admin-layout {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
.aside {
  background: #304156;
}
.logo {
  height: 60px;
  line-height: 60px;
  text-align: center;
  color: #fff;
  font-weight: bold;
  border-bottom: 1px solid #263445;
}
.header {
  background: #fff;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  padding: 0 20px;
}
.main {
  background: #f5f7fa;
  overflow-y: auto;
  padding: 24px;
}
</style>