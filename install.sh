#!/bin/bash

echo "🚀 欢迎使用 Crypto Bookkeeper 安装向导"
echo "======================================"
echo ""

# 检查 Node.js
echo "📋 检查系统环境..."
if ! command -v node &> /dev/null; then
    echo "❌ 未检测到 Node.js"
    echo "请先安装 Node.js 18 或更高版本："
    echo "  https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Node.js 版本过低（当前: $(node -v)）"
    echo "建议升级到 Node.js 18 或更高版本"
fi

echo "✅ Node.js 版本: $(node -v)"
echo "✅ npm 版本: $(npm -v)"
echo ""

# 安装前端依赖
echo "📦 安装前端依赖..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ 前端依赖安装失败"
    exit 1
fi
echo "✅ 前端依赖安装完成"
echo ""

# 安装后端依赖
echo "📦 安装后端依赖..."
cd server
npm install
if [ $? -ne 0 ]; then
    echo "❌ 后端依赖安装失败"
    exit 1
fi
cd ..
echo "✅ 后端依赖安装完成"
echo ""

# 创建 .env 文件（如果不存在）
if [ ! -f .env ]; then
    echo "📝 创建环境配置文件..."
    cp .env.example .env 2>/dev/null || echo ""
    echo "✅ 已创建 .env 文件（如需配置请编辑此文件）"
fi

echo ""
echo "======================================"
echo "✅ 安装完成！"
echo "======================================"
echo ""
echo "🚀 启动应用："
echo ""
echo "  方式 1: 分别启动前后端"
echo "    前端: npm run dev"
echo "    后端: cd server && node index.js"
echo ""
echo "  方式 2: 只启动前端（无 CEX API 功能）"
echo "    npm run dev"
echo ""
echo "📖 首次使用："
echo "  1. 访问 http://localhost:5173"
echo "  2. 进入 Settings 页面配置 CEX API（可选）"
echo "  3. 开始记录您的加密货币交易"
echo ""
echo "💡 提示："
echo "  - 所有数据存储在浏览器本地"
echo "  - 记得定期导出备份（Settings → Export Data）"
echo "  - API 密钥仅保存在本地，不会上传服务器"
echo ""
