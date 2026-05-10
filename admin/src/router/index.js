import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    component: () => import('../views/Login.vue')
  },
  {
    path: '/admin',
    component: () => import('../views/AdminApp.vue'),
    children: [
      { path: 'dashboard', component: () => import('../views/Dashboard.vue') },
      { path: 'models', component: () => import('../views/Models.vue') },
      { path: 'users', component: () => import('../views/Users.vue') },
      { path: 'config', component: () => import('../views/Config.vue') },
      { path: 'orders', component: () => import('../views/OrderManage.vue') },
    ]
  },
  {
    path: '/',
    redirect: '/admin/dashboard'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('admin_token')
  if (to.path.startsWith('/admin') && !token) {
    next('/login')
  } else {
    next()
  }
})

export default router