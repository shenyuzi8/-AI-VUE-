# 第一阶段设计逻辑架设
聚合式生成式AI管理系统:
技术栈：vue+JavaScript，mysql，oneapi，注意像用户数据，系统密钥数据应当存储在数据库中，请求json格式采用标准chatgpt格式。【完成】

1.该系统主要分为两个大模块，一个是前端页面负责用户与AI进行互动，例如chatgpt等，一个是后台管理系统，负责管理api请求地址，请求密钥，用户管理，计算每个用户的token数量，统计用户充值金额，点数等。【完成】

2.详细规划：
前台：主要分为三个页面，交互页面，登录注册页面，市场模型页面。其中交互页面主要负责交互逻辑，页面布局中下部分为聊天输入框，聊天输入框内有发送按键，或者使用crtl+回车发送;聊天输入框上部紧挨着当前使用模型，历史使用模型，模型市场，用户框选哪个模型就向该模型地址发送文本，用户可以从模型市场选择后台配置的已有的模型，选择一个就设为当前使用模型，原先如果有选择模型了，则将该模型往后排，变为历史使用模型，当前使用模型，历史使用模型，模型市场的选项布局加起来不要超过聊天输入框的长度。交互页面左侧为新建会话，历史会话，可供用户新建和删除。交互页面的右上角为登录按键，当用户点击登录后，可以使用邮箱密码登录，也可以使用邮箱验证码登录，邮箱登录时使用QQ邮箱stmp发送验证码给用户，用户输入正确验证码后方可登录成功，用户注册也是同理，注册时应当输入邮箱，密码，验证码，当用户点击获取验证码后通过smtp向用户发送验证码，验证码每隔60秒后才能重新获取。市场模型页面：当用户点击聊天输入框上面的市场模型时，进入市场模型详情页，这里显示在后台配置的各种模型，展示模型名称和标签，以及一个使用按键，当用户点击使用按键后，则回到交互页面使用该模型进行聊天，该模型变为当前使用模型。当用户发送文本后，向使用模型的地址发送请求，接收模型返回的文本，像微信聊天那样展示出来，在返回的文本框下部紧挨着一个很小的方块这里显示用户的剩余点数。用户的上下文数据应当存储在数据库中，每次发送文本，应当携带上下文数据，当用户删除历史会话时则删除该会话。在交互页面右上角登录按键旁边增加一个充值按键，只用做一个按键，后期才拓展。注意用户每次发送文本时应当计算上下token，扣除定价策略里的对应点数。【完成】

2.后台：负责洽接管理前端，可以新建模型，删除模型，编辑模型的api地址，api密钥，1000token对应的点数，配置stmp，配置充值金额可以换算为多少点数，可以看到每个用户的数据，设置用户的密码和点数，看到用户的充值金额。【完成】

3.api端：必须以接口方式与数据库，前后台数据交互。【完成】

一般情况：
数据库的连接数据使用环境变量配置,数据库的连接地址为xxx，用户xxx，密码xxx
数据库名为aichat，在该数据库下存储各数据。stmp授权码：xxx，邮箱：xxx@qq.com
数据库下一个有用户表（包含管理员），会话表，模型表等，系统应当自行检测是否有表数据，如果没有则自动创建。

对接充值模块：对接现有的充值系统，当用户点击充值后，弹出预设的充值金额，1元，6元，12元，30元，68元，自定义，其中自定义由用户填写，传递邮箱和充值金额，充值成功后，在数据库下有一张表，字段有id，mark，mount，notify_time，trade_no，buyer_logon_id，status，其中id为支付宝唯一商户订单号，mark为传递的邮箱名，mount为金额，status为两种状态success代表支付成功，nopay代表未支付。当支付成功时，同步到aichat数据库下的recharge_orders下，自动增加用户充值金额的对应点数，注意：充值成功一次才增加一次点数，不要同一笔订单反复增加点数。接口地址https://xxxx.com/check_order.php?mark=【完成】

涉及方面：vue的基本页面构建，鉴权，api，post，get，请求体的构造，stmp，流式传输，代理技术，openai标准接入格式，前后端分离。

测试数据：
安全代码审计提交：环境变量，外部接口【完成】

# 一、原理与技术
1.Vue 3 (Composition API/script setup)及Vue基本用法：
简介：Vue3 组合式 API，是当前 Vue 官方推荐的现代化写法，专注逻辑复用与代码组织。
使用位置：整个<script setup>块、ref/reactive/computed/onMounted等所有逻辑，isStreaming、streamingContent、inputContent、messageList、conversationList、mobileSidebarOpen、isMobile、messagesRef，userInfo、currentModel、historyModels，onMounted(() => getConversationList())，举例涉及书上部分基本知识点，1.ref 响应式变量：定义基本类型/对象/数组响应式数据，数据改变视图自动更新，2. computed计算属性：基于已有响应式数据派生新数据，具备缓存特性，依赖不变不会重复计算。3. 生命周期onMounted：Vue3 生命周期钩子，组件DOM 挂载完成后自动执行。

其他基本用法举例：
○1双向绑定 v-model：聊天输入框v-model="inputContent"，抽屉显示mobileSidebarOpen等。
○2条件渲染 v-if /v-else：未登录隐藏会话列表、手机端显示菜单按钮、无消息时展示空状态、区分登录后头部按钮。
○3列表渲染 v-for：遍历会话列表 conversationList、遍历历史模型 historyModels。
○4遍历会话列表 conversationList、遍历历史模型 historyModels。
○5动态样式绑定:class：会话选中高亮 active、用户消息右对齐、点数不足文字变红。
○6事件绑定 @click / 事件修饰符：@click.stop删除按钮阻止冒泡，.ctrl.enter 键盘组合按键监听。

参考书上第2章vue.js开发基础，第3章组件基础（上），第4章组件基础（下）。

2. Vue Router：
简介：Vue 官方路由管理器，用于页面跳转与路由控制。
使用位置：web/src/router，web/src/router。
参考书上第5章第119页。

3. Pinia / Store (useUserStore)：
简介：Vue 官方状态管理库，存储全局状态（token、用户信息、模型、点数）。 
使用位置：登录判断userStore.token、用户信息userInfo、当前模型currentModel、点数更新updatePoints。
参考书上第7章190页。

4. Element Plus UI和图标组件库：
简介：Vue3 企业级 UI 组件库，提供按钮、弹窗、抽屉、输入框等现成组件。
使用位置：<el-button> 按钮，<el-drawer> 手机端侧边抽屉，<el-input> 聊天输入框，<el-message>/el-message-box 消息提示等。
参考书上第6章141页。

5. Axios：
简介：HTTP 请求库，封装统一接口请求、token 携带、错误处理。 
使用位置：web/src/utils/request.js，web/src/utils/request.js，api/server.js。
参考书上第7章173页。

6. Fetch API + SSE 流式响应（额外扩展）：
简介：原生 Fetch 实现 AI 打字机效果（Stream 流式输出）。
使用位置：sendMessage()中fetch('/api/user/chat')、reader.read()逐字接收 AI 回复。

7. Markdown渲染及TextDecoder文本解码（额外拓展）：
简介：将 AI 返回的 Markdown 语法转为 HTML（代码块、表格、引用、标题），将二进制流转为 UTF-8 字符串。
使用位置：renderMarkdown(msg.content)，decoder.decode(value)。

8. 响应式布局及CSS作用域样式：
简介：适配 PC / 手机不同屏幕宽度，Vue 样式隔离，避免样式污染。 
使用位置：@media (max-width:768px)、isMobile判断、手机端隐藏 PC 侧边栏，     <style scoped>全部样式。

9. setInterval 定时器轮询：
简介：定时循环请求接口，轮询检测充值订单是否支付成功。
使用位置：startCheckRecharge每2秒请求一次充值校验接口，超时自动停止。

10. Flex 弹性布局：
简介：一维弹性布局，轻松实现左右分栏、水平垂直居中、自适应占满剩余空间。
使用位置：整体页面 chat-container 左右布局、头部导航、消息条目、输入栏底部布局全部使用 Flex。

# 二、错误与解决方法
问题1：api返回的格式为markdown，遇到code，标题等特殊文本时显示效果奇丑。
解决办法：单独写个util，使marked配合DOMPurify，并在Vue中用 v-html 渲染。 

问题2：交互逻辑缺失，当用户余额不足时，仍然能发送信息，虽然会被后端拦截掉，但是前端不会产生任何提示，只有在控制台返回业务code400，交互提示不够。
解决办法：在sendMessage函数里写一个if去check currentPoints，如果不足则return ElMessage.error，同时去把用户的发送键和ctrl+enter发送功能禁用了，且剩余点数标红。 
 
图3：底部发送禁用

问题3：在提示用户点数上，原使用response.text()去做提示，但是会与getReader()产生冲突，导致流被锁了，控制台输出Chat.vue:409 TypeError: Failed to execute 'getReader' on 'ReadableStream': ReadableStreamDefaultReader constructor can only accept readable streams that are not yet locked to a reader at sendMessage (Chat.vue:356:34) (匿名) @ Chat.vue:409。
解决办法：换个逻辑，参考问题二解决办法。

问题4：国内外各家AI厂商使用的SDK不同，还涉及到防火墙问题，代理问题，例如谷歌标准和OpenAI标准就不同, Gemini 原生接口格式和OpenAI完全不一样，有各自独立且完全不同的协议与数据格式，例如OpenAI使用 messages 数组，其中包含 role (如 system, user, assistant) 和 content 字段，Gemini使用 contents 数组，其中包含 role 和 parts 字段。系统指令是顶层字段 systemInstruction，工具也使用不同的 functionDeclarations 格式，虽然谷歌写了仿openai格式，可以强行兼容，但是可能会导致以下问题：多模态、长上下文、安全设置等。当写入多个SDK或构造不同请求体时，会导致代码冗余，不够简洁美观。
解决办法：使用OneApi项目解决，一个地址，一个密钥，一个格式，统一采取OpenAI标准格式兼容所有厂商。

# 三、实验效果
1.项目简介：该系统项目仅以课设水平标准，以《vue.js前端开发实战-第二版》为指导而建立，具有真实的验证码登录模块，支付模块等，有完整交互逻辑，基本覆盖书上所有知识点，前端和后端分离，用户和管理分离。

功能简述包含：
前台（用户端：代码位置web文件夹下）：用户登录（账号+密码，邮箱+验证码），用户注册（邮箱+验证码），用户登出，会话列表（新建会话，历史会话，删除会话，自动总结会话标题），充值（预设档位+自定义档位，支付模块，剩余点数），市场模型（切换模型，当前模型，历史模型），聊天区域(AI文本返回区，用户文本区，聊天输入框)。

API端（代码位置api文件夹下）：负责前后台功能逻辑洽接，以及对外接口发送接收。

后台（管理端：代码位置admin文件夹下）：管理登录（邮箱+密码），数据概览（总用户数, 累计充值, 模型数量, 消息总数）,模型管理（新增模型：模型名称，API 地址，API Key，每1000token消耗点数，标签，状态。模型删除，模型编辑），用户管理（ID, 邮箱，剩余点数，累计充值，角色，创建时间，操作），用户编辑（设置用户点数，角色，重置密码），系统配置（SMTP 服务器，SMTP 端口，发件邮箱，SMTP 授权码，定价），订单管理（ID，订单号，用户邮箱，充值金额，到账点数，状态）。

特别说明：由于安全原因在提交代码时我已删除外部支付接口的部分，要完全复现该系统的支付功能需要具备：1.营业执照，2.支付宝商户号，3. 公网服务器+备案。

部署：请先配置api文件夹下的环境变量，npm i 安装依赖，npm run server启动
web：npm i，npm run dev
admin： npm i，npm run dev
