require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { encode } = require('gpt-tokenizer');
const app = express();


app.use(cors());
app.use(express.json());


const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});


const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_AUTH_CODE
  }
});


const codeMap = new Map();
const CODE_EXPIRE_TIME = 5 * 60 * 1000; 
const CODE_SEND_INTERVAL = 60 * 1000; 

//JWT权限校验中间件
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ code: 401, msg: '未登录' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ code: 401, msg: '登录失效' });
  }
};

//管理员角色鉴权
const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ code: 403, msg: '无管理员权限' });
  next();
};

//这里去生成标题
async function generateConversationTitle(model, userFirstMessage) {
  const fallbackTitle = userFirstMessage.slice(0, 20).trim();
  
  try {
    const titleResponse = await axios.post(
      model.api_url,
      {
        model: model.name,
        messages: [
          {
            role: "system",
            content: "你是一个标题生成助手，必须用不超过10个汉字总结用户的问题，只返回标题本身，不要标点符号、不要引号、不要任何多余内容，精准抓住核心主题。"
          },
          {
            role: "user",
            content: userFirstMessage
          }
        ],
        stream: false,
        temperature: 0.3,
        max_tokens: 20
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${model.api_key}`
        },
        timeout: 10000
      }
    );

    let aiTitle = titleResponse.data.choices?.[0]?.message?.content?.trim() || fallbackTitle;
    aiTitle = aiTitle.replace(/^["'“”]|["'“”]$/g, '').replace(/\n/g, '').trim();
    return aiTitle.slice(0, 20) || fallbackTitle;

  } catch (error) {
    console.warn('会话标题生成失败，使用兜底方案:', error.message);
    return fallbackTitle;
  }
}

//数据库初始化-这里我建议使用虚拟机里的数据库，不要用到生产环境里的数据库了。
//数据库初始化-这里我建议使用虚拟机里的数据库，不要用到生产环境里的数据库了。
async function initDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    multipleStatements: true
  });
//这里自动创建表单数据，可根据自己的数据库实际情况修改。
//没有则创建，有则不创建。
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
    await connection.changeUser({ database: process.env.DB_NAME });

    const createTablesSql = [
      `CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(100) UNIQUE NOT NULL COMMENT '用户邮箱',
        password VARCHAR(255) NOT NULL COMMENT '密码',
        points INT DEFAULT 0 COMMENT '剩余点数',
        total_recharge DECIMAL(10,2) DEFAULT 0 COMMENT '累计充值金额',
        role ENUM('user','admin') DEFAULT 'user' COMMENT '角色',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS models (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL COMMENT '模型名称',
        api_url VARCHAR(255) NOT NULL COMMENT '模型API地址',
        api_key VARCHAR(255) NOT NULL COMMENT '模型API密钥',
        price_per_1k_token INT NOT NULL COMMENT '每1000token消耗点数',
        tags VARCHAR(255) DEFAULT '' COMMENT '模型标签',
        status TINYINT DEFAULT 1 COMMENT '1启用 0禁用',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS conversations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL COMMENT '用户ID',
        model_id INT NOT NULL COMMENT '使用的模型ID',
        model_name VARCHAR(100) NOT NULL COMMENT '模型名称',
        title VARCHAR(255) DEFAULT '新会话' COMMENT '会话标题',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        conversation_id INT NOT NULL COMMENT '会话ID',
        role ENUM('user','assistant') NOT NULL COMMENT '角色',
        content TEXT NOT NULL COMMENT '消息内容',
        tokens INT DEFAULT 0 COMMENT '消耗token数',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      // ✅ 修复：不再硬编码默认值
      `CREATE TABLE IF NOT EXISTS system_config (
        id INT PRIMARY KEY AUTO_INCREMENT,
        smtp_host VARCHAR(100),
        smtp_port INT,
        smtp_email VARCHAR(100),
        smtp_auth_code VARCHAR(255),
        money_to_points INT DEFAULT 10 COMMENT '1元兑换点数',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS recharge_orders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL COMMENT '用户ID',
        order_no VARCHAR(50) UNIQUE NOT NULL COMMENT '订单号',
        money DECIMAL(10,2) NOT NULL COMMENT '充值金额',
        points INT NOT NULL COMMENT '兑换点数',
        status TINYINT DEFAULT 0 COMMENT '0待支付 1已完成',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        FOREIGN KEY (user_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
    ];

    for (const sql of createTablesSql) {
      await connection.query(sql);
    }

    // 从 .env 读取并插入初始配置
    const [config] = await connection.query('SELECT id FROM system_config WHERE id = 1');
    if (config.length === 0) {
      await connection.query(
        'INSERT INTO system_config (id, smtp_host, smtp_port, smtp_email, smtp_auth_code) VALUES (1, ?, ?, ?, ?)',
        [
          process.env.SMTP_HOST,
          process.env.SMTP_PORT,
          process.env.SMTP_EMAIL,
          process.env.SMTP_AUTH_CODE
        ]
      );
    }

    const [admin] = await connection.query('SELECT id FROM users WHERE email = ?', ['admin@admin.com']);
    if (admin.length === 0) {
      await connection.query('INSERT INTO users (email,password,role,points) VALUES (?,?,?,?)', ['admin@admin.com', '123456', 'admin', 999999]);
    }

    console.log('数据库初始化完成，表结构已自动创建');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// api接口这里-前后端都调取这个，记得先启动好数据库再启动后端，否则会报not connect 错误
//遇到该错误检查数据库配置和表单是否自动创建。
app.post('/api/public/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ code: 400, msg: '邮箱不能为空' });

  const lastSendTime = codeMap.get(`${email}_time`) || 0;
  if (Date.now() - lastSendTime < CODE_SEND_INTERVAL) {
    return res.json({ code: 400, msg: '60秒内只能发送一次验证码' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  codeMap.set(email, { code, expire: Date.now() + CODE_EXPIRE_TIME });
  codeMap.set(`${email}_time`, Date.now());

  try {
    await transporter.sendMail({
      from: `"AI聚合聊天系统" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: '邮箱验证码',
      text: `您的验证码是：${code}，5分钟内有效，请勿泄露给他人`
    });
    console.log(`验证码已发送至 ${email}`);
    res.json({ code: 200, msg: '验证码发送成功' });
  } catch (e) {
    console.error('邮件发送失败:', e);
    codeMap.delete(email);
    codeMap.delete(`${email}_time`);
    res.json({ 
      code: 500, 
      msg: '邮件发送失败，请检查SMTP配置、网络是否封禁465端口，或更换邮箱服务商' 
    });
  }
});

app.post('/api/public/register', async (req, res) => {
  const { email, password, code } = req.body;
  if (!email || !password || !code) return res.json({ code: 400, msg: '请填写完整的注册信息' });

  const codeInfo = codeMap.get(email);
  if (!codeInfo || codeInfo.code !== code || Date.now() > codeInfo.expire) {
    return res.json({ code: 400, msg: '验证码错误或已过期' });
  }

  const [user] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
  if (user.length > 0) return res.json({ code: 400, msg: '该邮箱已注册' });

  try {
    await pool.execute('INSERT INTO users (email,password) VALUES (?,?)', [email, password]);
    codeMap.delete(email);
    codeMap.delete(`${email}_time`);
    res.json({ code: 200, msg: '注册成功，请登录' });
  } catch (e) {
    console.error('注册失败:', e);
    res.json({ code: 500, msg: '注册失败，请稍后重试' });
  }
});

app.post('/api/public/login', async (req, res) => {
  const { email, password, code } = req.body;
  if (!email) return res.json({ code: 400, msg: '邮箱不能为空' });

  if (code && code.trim() !== '') {
    const codeInfo = codeMap.get(email);
    if (!codeInfo) {
      return res.json({ code: 400, msg: '验证码未发送或已过期，请重新获取' });
    }
    if (codeInfo.code !== code.trim()) {
      return res.json({ code: 400, msg: '验证码错误' });
    }
    if (Date.now() > codeInfo.expire) {
      return res.json({ code: 400, msg: '验证码已过期，请重新获取' });
    }

    const [user] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (user.length === 0) {
      return res.json({ code: 400, msg: '该邮箱未注册，请先注册账号' });
    }

    codeMap.delete(email);
    codeMap.delete(`${email}_time`);

    const token = jwt.sign(
      { id: user[0].id, email: user[0].email, role: user[0].role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      code: 200,
      msg: '登录成功',
      data: {
        token,
        userInfo: {
          id: user[0].id,
          email: user[0].email,
          points: user[0].points,
          role: user[0].role
        }
      }
    });
  }

  if (!password || password.trim() === '') {
    return res.json({ code: 400, msg: '密码不能为空' });
  }

  const [user] = await pool.execute('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
  if (user.length === 0) {
    return res.json({ code: 400, msg: '邮箱或密码错误' });
  }

  const token = jwt.sign(
    { id: user[0].id, email: user[0].email, role: user[0].role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    code: 200,
    msg: '登录成功',
    data: {
      token,
      userInfo: {
        id: user[0].id,
        email: user[0].email,
        points: user[0].points,
        role: user[0].role
      }
    }
  });
});

app.get('/api/public/models', async (req, res) => {
  const [models] = await pool.execute('SELECT id,name,tags,price_per_1k_token FROM models WHERE status = 1');
  res.json({ code: 200, data: models });
});

// 这里是用户接口
app.get('/api/user/info', authMiddleware, async (req, res) => {
  const [user] = await pool.execute('SELECT id,email,points,total_recharge,role FROM users WHERE id = ?', [req.user.id]);
  res.json({ code: 200, data: user[0] });
});

app.post('/api/user/conversation', authMiddleware, async (req, res) => {
  const { model_id, model_name, title = '新会话' } = req.body;
  const [result] = await pool.execute(
    'INSERT INTO conversations (user_id,model_id,model_name,title) VALUES (?,?,?,?)',
    [req.user.id, model_id, model_name, title]
  );
  res.json({ code: 200, data: { id: result.insertId, title, model_id, model_name } });
});

app.get('/api/user/conversations', authMiddleware, async (req, res) => {
  const [conversations] = await pool.execute(
    'SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json({ code: 200, data: conversations });
});

app.delete('/api/user/conversation/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  await pool.execute('DELETE FROM conversations WHERE id = ? AND user_id = ?', [id, req.user.id]);
  res.json({ code: 200, msg: '删除成功' });
});

app.get('/api/user/conversation/:id/messages', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const [conv] = await pool.execute('SELECT id FROM conversations WHERE id = ? AND user_id = ?', [id, req.user.id]);
  if (conv.length === 0) return res.status(403).json({ code: 403, msg: '无权限访问该会话' });

  const [messages] = await pool.execute(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
    [id]
  );
  res.json({ code: 200, data: messages });
});

// chat聊天接口-主要实现逻辑
app.post('/api/user/chat', authMiddleware, async (req, res) => {
  const { conversation_id, model_id, messages, stream = false } = req.body;
  if (!model_id || !messages || !Array.isArray(messages)) {
    return res.json({ code: 400, msg: '参数错误' });
  }

  const [models] = await pool.execute('SELECT * FROM models WHERE id = ? AND status = 1', [model_id]);
  if (models.length === 0) return res.json({ code: 400, msg: '模型不存在或已禁用' });
  const model = models[0];

  const [user] = await pool.execute('SELECT points FROM users WHERE id = ?', [req.user.id]);
  const userPoints = user[0].points;
  if (userPoints <= 0) return res.json({ code: 400, msg: '点数不足，请充值' });

  const allContent = messages.map(item => item.content).join('');
  const localTokenCount = encode(allContent).length;//计算上下文token
  const previewCostPoints = Math.ceil((localTokenCount / 1000) * model.price_per_1k_token);
  if (userPoints < previewCostPoints) return res.json({ code: 400, msg: `点数不足，预估需消耗${previewCostPoints}点` });

  if (conversation_id) {
    await pool.execute(
      'INSERT INTO messages (conversation_id,role,content,tokens) VALUES (?,?,?,?)',
      [conversation_id, 'user', messages[messages.length - 1].content, localTokenCount]
    );
  }

  if (!stream) {
    try {
      const aiResponse = await axios.post(
        model.api_url,
        { model: model.name, messages, stream: false },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${model.api_key}`
          },
          timeout: 120000
        }
      );

      const aiResult = aiResponse.data;
      if (!aiResult || !aiResult.choices || !aiResult.choices[0] || !aiResult.choices[0].message) {
        throw new Error('AI返回数据格式错误');
      }

      const assistantContent = aiResult.choices[0].message.content;
      const totalTokens = aiResult.usage?.total_tokens || localTokenCount;
      const finalCostPoints = Math.ceil((totalTokens / 1000) * model.price_per_1k_token);

      await pool.execute('UPDATE users SET points = points - ? WHERE id = ?', [finalCostPoints, req.user.id]);
      if (conversation_id) {
        await pool.execute(
          'INSERT INTO messages (conversation_id,role,content,tokens) VALUES (?,?,?,?)',
          [conversation_id, 'assistant', assistantContent, totalTokens]
        );
      }

      let newTitle = null;
      const [convCheck] = await pool.execute('SELECT title FROM conversations WHERE id = ?', [conversation_id]);
      if (convCheck[0]?.title === '新会话') {
        newTitle = await generateConversationTitle(model, messages[messages.length - 1].content);
        await pool.execute('UPDATE conversations SET title = ? WHERE id = ?', [newTitle, conversation_id]);
      }

      return res.json({
        code: 200,
        data: {
          content: assistantContent,
          total_tokens: totalTokens,
          cost_points: finalCostPoints,
          remaining_points: userPoints - finalCostPoints,
          conversation_title: newTitle
        }
      });

    } catch (e) {
      console.error('非流式AI接口请求失败:', e.response?.data || e.message);
      let errorMsg = 'AI接口请求失败，请检查模型配置';
      if (e.code === 'ETIMEDOUT') errorMsg = '连接One API超时，请检查网络或地址是否正确';
      else if (e.response?.data?.error?.message) errorMsg = `One API错误：${e.response.data.error.message}`;
      else if (e.message) errorMsg = e.message;
      return res.json({ code: 500, msg: errorMsg });
    }
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  let fullContent = '';
  let totalTokens = localTokenCount;
//构造请求体
  try {
    const aiResponse = await axios.post(
      model.api_url,
      { model: model.name, messages, stream: true },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${model.api_key}`
        },
        responseType: 'stream',
        timeout: 120000
      }
    );

    const stream = aiResponse.data;
    stream.on('data', (chunk) => {
      const chunkStr = chunk.toString('utf8');
      const lines = chunkStr.split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6).trim();
        if (dataStr === '[DONE]') {
          res.write(`data: [DONE]\n\n`);
          return;
        }

        try {
          const data = JSON.parse(dataStr);
          const deltaContent = data.choices?.[0]?.delta?.content || '';
          if (deltaContent) {
            fullContent += deltaContent;
            res.write(`data: ${JSON.stringify({ content: deltaContent })}\n\n`);
          }

          if (data.usage?.total_tokens) {
            totalTokens = data.usage.total_tokens;
          }
        } catch (e) {
          continue;
        }
      }
    });
//流式传输
    stream.on('end', async () => {
      const finalCostPoints = Math.ceil((totalTokens / 1000) * model.price_per_1k_token);//定价，也可在后台自定义。
      const remainingPoints = userPoints - finalCostPoints;

      await pool.execute('UPDATE users SET points = points - ? WHERE id = ?', [finalCostPoints, req.user.id]);

      if (conversation_id && fullContent) {
        await pool.execute(
          'INSERT INTO messages (conversation_id,role,content,tokens) VALUES (?,?,?,?)',
          [conversation_id, 'assistant', fullContent, totalTokens]
        );
      }

      let newTitle = null;
      const [convCheck] = await pool.execute('SELECT title FROM conversations WHERE id = ?', [conversation_id]);
      if (convCheck[0]?.title === '新会话') {
        newTitle = await generateConversationTitle(model, messages[messages.length - 1].content);
        await pool.execute('UPDATE conversations SET title = ? WHERE id = ?', [newTitle, conversation_id]);
      }

      res.write(`data: ${JSON.stringify({
        done: true,
        total_tokens: totalTokens,
        cost_points: finalCostPoints,
        remaining_points: remainingPoints,
        conversation_title: newTitle
      })}\n\n`);
      res.end();
    });

    stream.on('error', (err) => {
      console.error('流式响应错误:', err);
      res.write(`data: ${JSON.stringify({ error: 'AI响应中断，请重试' })}\n\n`);
      res.end();
    });

  } catch (e) {
    console.error('流式AI接口请求失败:', e.response?.data || e.message);
    let errorMsg = 'AI接口请求失败，请检查模型配置';
    if (e.code === 'ETIMEDOUT') errorMsg = '连接One API超时，请检查网络或地址是否正确';
    else if (e.response?.data?.error?.message) errorMsg = `One API错误：${e.response.data.error.message}`;
    else if (e.message) errorMsg = e.message;
    
    res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
    res.end();
  }
});

// 充值模块 -这里是需要自定义，我这里自定义是我的接口，课设不需要接入支付接口，做支付接口比较难。
app.get('/api/user/recharge/check', authMiddleware, async (req, res) => {
  const mark = req.query.mark
  const user_id = req.user.id

  try {
    const resp = await axios.get('', {//这里充值接口连接
      params: { mark }//mark代表传递的参数-可以是唯一支付ID或者用户ID数据，查询后接收标准的json包
    })

    const orders = resp.data?.data || []
    if (orders.length === 0) {
      return res.json({ code: 200, data: { success: false } })
    }

    const [cfg] = await pool.query('SELECT money_to_points FROM system_config WHERE id=1')
    const rate = cfg[0]?.money_to_points || 10

    let updated = false

    for (const order of orders) {
      if (order.status !== 'success') continue

      const order_no = order.id
      const money = parseFloat(order.mount)

      const [exist] = await pool.query(
        'SELECT id FROM recharge_orders WHERE order_no = ?',
        [order_no]
      )
      if (exist.length > 0) continue

      const points = Math.floor(money * rate)

      const conn = await pool.getConnection()
      await conn.beginTransaction()
      try {
        await conn.query(
          'INSERT INTO recharge_orders (user_id, order_no, money, points, status) VALUES (?,?,?,?,1)',
          [user_id, order_no, money, points]
        )
        await conn.query(
          'UPDATE users SET points = points + ?, total_recharge = total_recharge + ? WHERE id=?',
          [points, money, user_id]
        )
        await conn.commit()
        updated = true
      } catch (e) {
        await conn.rollback()
      } finally {
        conn.release()
      }
    }

    const [user] = await pool.query('SELECT points FROM users WHERE id=?', [user_id])
    return res.json({
      code: 200,
      data: {
        success: updated,
        remaining_points: user[0]?.points || 0
      }
    })
  } catch (e) {
    return res.json({ code: 200, data: { success: false } })
  }
})

// 管理员接口
app.get('/api/admin/dashboard', authMiddleware, adminMiddleware, async (req, res) => {
  const [userCount] = await pool.execute('SELECT COUNT(*) as total FROM users');
  const [rechargeTotal] = await pool.execute('SELECT SUM(total_recharge) as total FROM users');
  const [modelCount] = await pool.execute('SELECT COUNT(*) as total FROM models');
  const [messageCount] = await pool.execute('SELECT COUNT(*) as total FROM messages');

  res.json({
    code: 200,
    data: {
      total_user: userCount[0].total,
      total_recharge: rechargeTotal[0].total || 0,
      total_model: modelCount[0].total,
      total_message: messageCount[0].total
    }
  });
});

app.get('/api/admin/models', authMiddleware, adminMiddleware, async (req, res) => {
  const [models] = await pool.execute('SELECT * FROM models ORDER BY created_at DESC');
  res.json({ code: 200, data: models });
});

app.post('/api/admin/model', authMiddleware, adminMiddleware, async (req, res) => {
  const { name, api_url, api_key, price_per_1k_token, tags } = req.body;
  const [result] = await pool.execute(
    'INSERT INTO models (name,api_url,api_key,price_per_1k_token,tags) VALUES (?,?,?,?,?)',
    [name, api_url, api_key, price_per_1k_token, tags]
  );
  res.json({ code: 200, msg: '新增成功', data: { id: result.insertId } });
});

app.put('/api/admin/model/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, api_url, api_key, price_per_1k_token, tags, status } = req.body;
  await pool.execute(
    'UPDATE models SET name=?,api_url=?,api_key=?,price_per_1k_token=?,tags=?,status=? WHERE id=?',
    [name, api_url, api_key, price_per_1k_token, tags, status, id]
  );
  res.json({ code: 200, msg: '编辑成功' });
});

app.delete('/api/admin/model/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  await pool.execute('DELETE FROM models WHERE id=?', [id]);
  res.json({ code: 200, msg: '删除成功' });
});

app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  const [users] = await pool.execute('SELECT id,email,points,total_recharge,role,created_at FROM users ORDER BY created_at DESC');
  res.json({ code: 200, data: users });
});

app.put('/api/admin/user/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { password, points, role } = req.body;
  await pool.execute(
    'UPDATE users SET password=?,points=?,role=? WHERE id=?',
    [password, points, role, id]
  );
  res.json({ code: 200, msg: '修改成功' });
});

app.get('/api/admin/config', authMiddleware, adminMiddleware, async (req, res) => {
  const [config] = await pool.execute('SELECT * FROM system_config WHERE id = 1');
  res.json({ code: 200, data: config[0] });
});

app.put('/api/admin/config', authMiddleware, adminMiddleware, async (req, res) => {
  const { smtp_host, smtp_port, smtp_email, smtp_auth_code, money_to_points } = req.body;
  await pool.execute(
    'UPDATE system_config SET smtp_host=?,smtp_port=?,smtp_email=?,smtp_auth_code=?,money_to_points=? WHERE id=1',
    [smtp_host, smtp_port, smtp_email, smtp_auth_code, money_to_points]
  );
  res.json({ code: 200, msg: '修改成功' });
});

//订单管理 
app.get('/api/admin/order/list', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [list] = await pool.query(`
      SELECT 
        ro.id,
        ro.order_no,
        ro.money,
        ro.points,
        ro.status,
        ro.created_at,
        u.email
      FROM recharge_orders ro
      LEFT JOIN users u ON ro.user_id = u.id
      ORDER BY ro.id DESC
    `)
    res.json({ code: 200, data: { list } })
  } catch (e) {
    res.json({ code: 500, msg: '获取失败' })
  }
})

// 启动服务
async function startServer() {
  await initDatabase();
  app.listen(process.env.PORT, () => {
    console.log(`后端服务启动成功，运行在 http://localhost:${process.env.PORT}`);
    console.log(`默认管理员账号：admin@admin.com / 123456`);
    console.log(`模型配置提示：API地址请填写完整路径（如 https://xxx.xxx.com/v1/chat/completions）`);
  });
}

startServer();