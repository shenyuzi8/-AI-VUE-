import axios from 'axios'
import { useUserStore } from '@/store'
import { ElMessage } from 'element-plus'

const request = axios.create({
  baseURL: '/api',//我这里预设好了，请求路径，后面自定义修改接口时不用频繁带/api。
  timeout: 120000 //延长超时到2分钟，适配流式传输，这里可以自定义，避免文本过长导致截止。
})

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    const userStore = useUserStore()
    if (userStore.token) {
      config.headers.Authorization = `Bearer ${userStore.token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

//响应拦截器
request.interceptors.response.use(
  (response) => {
    //如果是流式响应（responseType: stream），直接返回原始 response。
    if (response.config.responseType === 'stream') {
      return response
    }

    //普通JSON响应处理
    const res = response.data
    if (res.code !== 200) {
      ElMessage.error(res.msg || '请求失败')
      return Promise.reject(new Error(res.msg || '请求失败'))
    }
    return res
  },
  (error) => {
    // 401 处理：只清 token 和提示，不强制跳转
    if (error.response?.status === 401) {
      const userStore = useUserStore()
      userStore.logout()
      ElMessage.error('登录已过期，请重新登录')
    } 
    // 超时处理
    else if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
      ElMessage.error('请求超时，请检查网络或稍后重试')
    }
    // 网络错误
    else if (!error.response) {
      ElMessage.error('网络连接失败，请检查网络')
    }
    // 其他错误
    else {
      ElMessage.error(error.response?.data?.msg || error.message || '请求失败')
    }
    
    return Promise.reject(error)
  }
)

export default request