# 原设计证据与 D0 归档校验

本目录中的 [artboard-review.json](artboard-review.json)、[contrast.json](contrast.json)、[theme_geometry.json](theme_geometry.json)、[pdf-review.json](pdf-review.json)均是原交付包的静态设计检查记录，逐字节保留。本次只校验其归档完整性，没有重跑原设计生成、配色计算、几何指纹算法或 PDF 渲染。记录中的 PNG/SVG 全集与 PDF 范围指原包；PDF 未收入仓库，记录中的 PDF hash 用于原包追溯。这些历史静态 PASS 不能充当 D0 或 D1–D5 的运行时验证。

[archive-manifest.json](archive-manifest.json)记录本次来源及文件指纹；[d0-validation.md](d0-validation.md)记录实际检查和 NOT_RUN。

从仓库根目录运行文档专项检查：

```text
python docs/ui-redesign/v1/checks/verify-archive.py
python docs/ui-redesign/v1/checks/verify-archive.py --zip <原交付包.zip>
git diff --check
```

带 `--zip` 时额外检查原包 hash、源文件 hash、56 条迁移行逐字一致及索引/token 无语义变化。脚本只读文档和输入包，不运行应用、不读取真实业务数据。
