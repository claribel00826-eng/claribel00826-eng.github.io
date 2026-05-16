# /sdd-bugfix - BUG 修复

## 阶段说明

当开发过程中遇到 BUG 时，使用此命令进入修复流程。

## 使用方式

```
/sdd-bugfix <问题描述>
```

**示例**：
```
/sdd-bugfix 登录页点击登录按钮后没有反应，控制台报错 "Cannot read property 'token' of undefined"

/sdd-bugfix 后端接口返回 500 错误，日志显示数据库连接失败

/sdd-bugfix 首页列表数据加载很慢，有时候会超时
```

## 执行流程

1. **记录用户原话** - 完整保存用户描述的问题
2. **问题分析** - 翻译精简问题，定位可能原因
3. **排查修复** - 检查相关代码，定位并修复 BUG
4. **生成文档** - 将修复过程记录到 `.output/bug_fix/` 目录

## 产出物

| 文件 | 内容 |
|------|------|
| `.output/bug_fix/问题编号-问题简述.md` | BUG 修复报告 |

## 执行指令

执行 `.cursor/skills/bugfix/bugfix-skill.md` 中的流程。

## 完成后

告知用户：

```
BUG 已修复！

问题：[简述]
原因：[根本原因]
方案：[修复方案]

修复报告已存档：.output/bug_fix/问题编号-xxx.md

修改的文件：
- [文件列表]
```
