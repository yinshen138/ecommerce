# B2C E‑commerce Platform — Implementation Plan (MVP-first)

## Problem statement
开发一个面向消费者（B2C）的电商独立站，采用前后端分离架构。首要目标交付一个可运行的最小可行产品（MVP），随后按优先级迭代完善所有列出的功能与非功能性要求。

## 技术栈（已确认）
- 前端：Next.js (React 18) + TypeScript + Tailwind CSS
- 后端：Node.js + Express + TypeScript
- 数据库：PostgreSQL（迁移和种子脚本）
- 认证：Supabase Auth（邮箱/手机号/第三方）
- 支付：微信支付、支付宝（先接入沙箱或占位回调）
- 部署：Docker、NGINX、Let's Encrypt；CI/CD 用 GitHub Actions

## MVP 范围（必交）
- 用户：注册/登录（Supabase）、登录态维护
- 商品：浏览、分类、搜索、详情（图片轮播、规格选择）
- 购物车：增删改、优惠预计算
- 下单：结算页（地址/运费/优惠券）、下单并预扣库存
- 支付：支付回调占位（可切换为真流水在后续迭代）
- 订单：用户侧查看、取消；后台查看与发货占位
- 管理：基础商品/订单管理页面（CRUD + 上下架）
- 数据库模式与基本迁移脚本
- 自动化：15分钟未支付自动取消释放库存的后台任务

## 非功能性（MVP 验收门槛）
- HTTPS 全站（开发/测试用自签或本地证书，生产使用 Let's Encrypt）
- 响应式布局（PC/平板/手机）
- 文档：README、部署说明、API 列表

## 高级设计概览
- 服务拆分：frontend (Next.js) + api (Express)；共享类型库 package 或 monorepo workspace（可选）
- 数据库事务：创建订单时在单事务内写订单、明细并预扣 inventory，若支付失败或超时回滚/补偿
- 预扣库存策略：订单创建时减少 inventory.available 并写库存锁记录；15分钟未支付由后台任务取消并释放
- 优惠策略：优惠券/满减/秒杀互斥规则在下单时校验（MVP：券不可与秒杀并存）
- 支付：先实现支付抽象（/payments/create, /payments/notify），真接入放在后续里程碑
- 可观测性：健康检查、简单 Prometheus 指标埋点（或等价方案）

## 里程碑与任务（将同步到 todos）
1. scaffold-project — 初始化前后端脚手架、TypeScript、Tailwind、Dockerfile、基本 README
2. setup-postgres — 设计并实现数据库 schema 与迁移脚本
3. setup-supabase-auth — 集成 Supabase Auth（邮箱/手机号/第三方）并在后端校验 JWT
4. implement-product-catalog — 列表/搜索/筛选/排序 API 与页面
5. implement-product-details — 商品详情页（轮播、规格、库存提示）
6. implement-cart — 购物车 API 与前端（批量操作、优惠预计算）
7. implement-checkout-order — 结算页、地址管理、下单并预扣库存
8. implement-payment — 支付抽象与沙箱回调（微信/支付宝占位）
9. implement-order-management — 订单状态流转、用户端查询、取消；后台发货接口
10. implement-inventory-timer — 后台任务：15 分钟未支付自动取消并释放库存
11. implement-refunds — 售后申请与管理员审核流程（退款原路返回占位）
12. implement-admin-panel — 基础管理后台（商品/分类/订单/用户/优惠券/Banner）
13. implement-monitoring-ci — 健康检查、基础监控、GitHub Actions CI
14. implement-deployment — Docker Compose / k8s 清单、HTTPS、部署文档
15. implement-performance — 基准测试与性能优化，目标 500 QPS 与首屏<2s

## 验收细则（MVP）
- 能在本地或测试环境完成一次完整下单（含预扣库存）流程并触发未支付自动取消
- 登录注册功能可用，用户能浏览商品、加入购物车并下单
- 管理后台能完成商品的新增与上下架，能查看订单

## 风险与后续注意事项
- 支付接入在国内环境需要商户资质和证书（MVP 用沙箱或占位实现）
- 规模化需考虑读写分离、缓存（Redis）、CDN、数据库分片与队列（RabbitMQ/Sidekiq）
- 身份认证与安全（速率限制、CSP、XSS/CSRF）需在迭代中加强

---

(更多实现细节、接口规范与 ER 图将在对应任务中补充)

## 进度更新（2026-07-31 17:25:29 +08:00）
- 已完成：初始化仓库脚手架、数据库 schema（Postgres/SQLite 备份）、Supabase 验证与本地 JWT 验证骨架、商品与购物车 API（含商品详情与规格）、SQLite 本地自动初始化脚本、购物车 CRUD 自动化 smoke tests。
- CI：已在 .github/workflows/smoke-tests.yml 加入 smoke tests；为避免 hosted runner 上 native sqlite 二进制问题，CI 在 smoke tests 使用显式的 USE_FAKE_DB=1 启用内存适配器。
- 文档：README 已补充 CI 行为与差异说明；backend/src/db_adapter.js 已限制仅在 USE_FAKE_DB==='1' 时使用内存适配器。

## 下一步（短期）
1. 合并 feature/ci-smoke-tests 分支并决定是否在 CI 上添加 file-backed SQLite 或 Postgres 集成测试。
2. 修复/验证 frontend Next.js 开发环境（Node/Next 版本一致性或转为容器化开发）。
3. 完成结算/下单与支付占位实现（订单预扣库存、15 分钟超时释放）。

(如需我代为推送分支、创建 PR 或在 plan 中增补更详细的接口/ER 图，请告知)
