# 项目迁移指南 (Project Migration Guide)

本指南将帮助你将 Crypto Bookkeeper 项目及其数据从旧电脑迁移到新电脑（Mac M4）。

## 1. 迁移代码 (Migrate Code)

### 在旧电脑上 (Old Mac):
1. 打开终端 (Terminal)，进入项目文件夹。
2. 为了减小传输体积，建议先删除依赖包文件夹 `node_modules` (不用担心，在新电脑上会重新安装)。
   ```bash
   rm -rf node_modules
   rm -rf server/node_modules
   ```
3. 将整个项目文件夹打包压缩 (Zip)。

### 在新电脑上 (New Mac):
1. 将压缩包传输到新电脑并解压。
2. 确保新电脑已安装 [Node.js](https://nodejs.org/) (建议版本 v18 或更高)。
3. 打开终端，进入解压后的项目文件夹。
4. 安装依赖：
   ```bash
   # 安装前端依赖
   npm install

   # 安装后端依赖
   cd server
   npm install
   cd ..
   ```

## 2. 迁移数据 (Migrate Data)

由于项目数据（钱包、API Key、标签等）存储在浏览器的本地存储 (Local Storage) 中，你需要手动迁移这部分数据。

### 在旧电脑上 (Old Mac):
1. 启动项目：`npm run dev`。
2. 在浏览器中打开 `http://localhost:5173`。
3. 打开开发者工具 (按 `F12` 或 `Cmd + Option + I`)。
4. 切换到 **Console (控制台)** 标签页。
5. 输入以下命令并回车，这会将你的数据复制到剪贴板：
   ```javascript
   copy(localStorage.getItem('crypto-bookkeeper-storage'))
   ```
   *如果看到 `undefined`，说明没有数据或命令执行成功（数据已在剪贴板）。*
6. 将剪贴板中的内容粘贴到一个文本文件（例如 `data_backup.txt`）中，并发送到新电脑。

### 在新电脑上 (New Mac):
1. 启动项目：`npm run dev`。
2. 在浏览器中打开 `http://localhost:5173`。
3. 打开开发者工具 (**Console** 标签页)。
4. 输入以下命令（**注意：请将 `YOUR_DATA` 替换为你刚才备份的文本内容**）：
   ```javascript
   localStorage.setItem('crypto-bookkeeper-storage', 'YOUR_DATA')
   ```
   *注意：保留单引号 `'`，将 `YOUR_DATA` 替换为实际的长字符串。*
5. 按回车执行。
6. 刷新页面，你应该能看到所有的钱包和设置都回来了！

## 3. 启动服务 (Start Services)

在新电脑上，你可以像往常一样启动项目：

1. **启动后端服务** (用于获取链上数据和价格)：
   ```bash
   npm start
   ```
   *(或者 `node server/index.js`)*

2. **启动前端页面** (新建一个终端窗口)：
   ```bash
   npm run dev
   ```

祝你在新电脑上使用愉快！
