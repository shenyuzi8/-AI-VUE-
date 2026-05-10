import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue')
  },
  {
    path: '/',
    name: 'Chat',
    component: () => import('@/views/Chat.vue')
  },
  {
    path: '/market',
    name: 'ModelMarket',
    component: () => import('@/views/ModelMarket.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router