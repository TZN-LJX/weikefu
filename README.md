# 威科夫 ETH 闯关

面向手机和电脑浏览器的单人学习工具。课程按 14 个知识单元顺序解锁，每个单元只有三个步骤：

1. 最多 5 道到期错题回顾。
2. 10 道原书单选题，答对至少 8 道通过。
3. 1 个真实 Binance Futures `ETHUSDT` 历史回放，选择上涨、下跌或震荡。

错误题目会自动进入错题本。错题在正式复习中累计答对 10 次后移入已掌握池；后续突击复测答错会重新开始计数。

## 使用

打开 <https://tzn-ljx.github.io/weikefu/>，首次使用时导入本机的 `weikefu-private-content.wkf`。学习包只保存在当前浏览器中，不会上传到 GitHub。

手机和电脑的进度不会自动同步。需要换设备时，在设置页导出进度 JSON，再在另一台设备导入。替换或删除学习包也在设置页完成。

## 隐私边界

公开仓库和 GitHub Pages 只包含应用代码。原始 PDF、原书题库、ETH 历史案例、`.wkf` 学习包和 API 密钥均被 Git 忽略，不会进入公开部署。

应用运行时不调用 AI、不请求实时 Binance 行情、不连接交易账户，也不具备下单功能。

## 本地开发

```powershell
pnpm install
pnpm dev
```

完整验证：

```powershell
pnpm lint
pnpm test:run
pnpm test:tools
pnpm test:e2e
pnpm build
```

产品需求见 [`prd(new).md`](./prd(new).md)。内容制作与学习包构建脚本位于 `scripts/`，生成物保存在被 Git 忽略的 `private-content/` 和 `private-packs/`。
