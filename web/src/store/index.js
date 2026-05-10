import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref(JSON.parse(localStorage.getItem('userInfo') || '{}'))
  const currentModel = ref(JSON.parse(localStorage.getItem('currentModel') || '{}'))
  const historyModels = ref(JSON.parse(localStorage.getItem('historyModels') || '[]'))

  //设置登录信息
  const setLoginInfo = (data) => {
    token.value = data.token
    userInfo.value = data.userInfo
    localStorage.setItem('token', data.token)
    localStorage.setItem('userInfo', JSON.stringify(data.userInfo))
  }

  //退出登录
  const logout = () => {
    token.value = ''
    userInfo.value = {}
    currentModel.value = {}
    historyModels.value = []
    localStorage.clear()
  }

  //切换当前模型
  const setCurrentModel = (model) => {
    //旧模型加入历史
    if (currentModel.value.id && currentModel.value.id !== model.id) {
      const existIndex = historyModels.value.findIndex(item => item.id === currentModel.value.id)
      if (existIndex !== -1) historyModels.value.splice(existIndex, 1)
      historyModels.value.unshift(currentModel.value)
      //历史最多保留5个
      if (historyModels.value.length > 5) historyModels.value = historyModels.value.slice(0, 5)
      localStorage.setItem('historyModels', JSON.stringify(historyModels.value))
    }
    //设置新模型
    currentModel.value = model
    localStorage.setItem('currentModel', JSON.stringify(model))
  }

  //更新用户点数，ps：如果在数据库中直接修改点数，需要重新登录后点数生效，正常充值逻辑不影响，因为做了轮询实时到账。
  const updatePoints = (points) => {
    userInfo.value.points = points
    localStorage.setItem('userInfo', JSON.stringify(userInfo.value))
  }

  return {
    token,
    userInfo,
    currentModel,
    historyModels,
    setLoginInfo,
    logout,
    setCurrentModel,
    updatePoints
  }
})