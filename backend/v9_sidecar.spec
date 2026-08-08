# -*- mode: python ; coding: utf-8 -*-
"""
V9 Python Sidecar — PyInstaller 打包配置（优化版）

方案B: Electron + 本地 Python Sidecar

优化项：
  1. UPX 压缩 — 压缩可执行文件和 DLL（排除 torch/pydantic 核心 DLL）
  2. 排除 scipy 测试模块 — 移除 _test_*.pyd 等测试二进制
  3. 排除不需要的大型模块 — matplotlib, tkinter, jupyter 等
  4. 排除 sklearn 测试模块

构建命令：
  cd d:\\FinSightV9
  .venv\\Scripts\\python.exe -m PyInstaller backend/v9_sidecar.spec --distpath dist/v9-python-sidecar --noconfirm

输出：
  dist/v9-python-sidecar/v9-python-sidecar/v9-python-sidecar.exe  (Windows)

注意事项：
  1. 打包前确保 .venv 已安装全部依赖
  2. torch CPU 版本：pip install torch --index-url https://download.pytorch.org/whl/cpu
  3. 模型文件不打包进 exe，由 Electron 首次运行时按需下载
  4. UPX 需单独安装（本项目使用 upx/upx-4.2.4-win64/upx.exe）
"""

import os
import sys
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

block_cipher = None

# ──────────────────────────────────────────────
# UPX 路径配置
# ──────────────────────────────────────────────

_UPX_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'upx', 'upx-4.2.4-win64')
if not os.path.isdir(_UPX_DIR):
    # 尝试备选路径
    _UPX_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'upx')
    if not os.path.isdir(_UPX_DIR):
        _UPX_DIR = None

# ──────────────────────────────────────────────
# 收集隐式依赖
# ──────────────────────────────────────────────

hiddenimports = []

# sentence-transformers 及其依赖链
hiddenimports += collect_submodules('sentence_transformers')
hiddenimports += collect_submodules('transformers')
hiddenimports += [
    'torch',
    'torch.nn',
    'torch.nn.functional',
    'torch.cuda',
    'torch._C',
]

# FastAPI / Uvicorn 依赖链
hiddenimports += collect_submodules('uvicorn')
hiddenimports += collect_submodules('uvicorn.logging')
hiddenimports += collect_submodules('uvicorn.loops')
hiddenimports += collect_submodules('uvicorn.loops.auto')
hiddenimports += collect_submodules('uvicorn.protocols')
hiddenimports += collect_submodules('uvicorn.protocols.http')
hiddenimports += collect_submodules('uvicorn.protocols.http.auto')
hiddenimports += collect_submodules('uvicorn.protocols.websockets')
hiddenimports += collect_submodules('uvicorn.protocols.websockets.auto')
hiddenimports += collect_submodules('uvicorn.lifespan')
hiddenimports += collect_submodules('uvicorn.lifespan.on')

# Pydantic v2
hiddenimports += collect_submodules('pydantic')
hiddenimports += collect_submodules('pydantic._internal')

# HuggingFace Hub
hiddenimports += collect_submodules('huggingface_hub')
hiddenimports += collect_submodules('tokenizers')

# numpy / scipy（torch 依赖）
hiddenimports += ['numpy', 'numpy.core']
hiddenimports += collect_submodules('scipy')

# AKShare（数据采集）
hiddenimports += collect_submodules('akshare')

# Pydantic v2 核心（C 扩展，PyInstaller 常漏）
hiddenimports += ['pydantic_core', 'pydantic_core._pydantic_core']

# httpx（embedding_service 转发层依赖）
hiddenimports += collect_submodules('httpx')

# ──────────────────────────────────────────────
# 收集数据文件
# ──────────────────────────────────────────────

datas = []

# sentence-transformers 模型配置文件
datas += collect_data_files('sentence_transformers')
datas += collect_data_files('transformers')
datas += collect_data_files('huggingface_hub')

# ──────────────────────────────────────────────
# 二进制文件
# ──────────────────────────────────────────────

binaries = []

# torch 的 DLL 文件（Windows）
if sys.platform == 'win32':
    try:
        import torch
        torch_lib_dir = os.path.join(os.path.dirname(torch.__file__), 'lib')
        if os.path.isdir(torch_lib_dir):
            for dll in os.listdir(torch_lib_dir):
                if dll.endswith('.dll'):
                    binaries.append((os.path.join(torch_lib_dir, dll), 'torch_lib'))
    except ImportError:
        pass

# ──────────────────────────────────────────────
# Analysis
# ──────────────────────────────────────────────

a = Analysis(
    ['sidecar_entry.py'],
    pathex=['.', '..'],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # ── 不需要的大型模块 ──
        'matplotlib',
        'tkinter',
        'test',
        'unittest',
        'pydoc',
        'doctest',
        'IPython',
        'jupyter',
        'notebook',
        'pytest',
        'setuptools',
        'pip',
        'wheel',
        # ── scipy 测试模块（优化体积）──
        'scipy._lib._test_ccallback',
        'scipy._lib._test_deprecation_call',
        'scipy._lib._test_deprecation_def',
        'scipy.integrate._test_multivariate',
        'scipy.ndimage._ctest',
        'scipy.ndimage._cytest',
        'scipy.special._test_internal',
        'scipy.stats.tests',
        'scipy.linalg.tests',
        'scipy.fftpack.tests',
        'scipy.sparse.tests',
        'scipy.spatial.tests',
        'scipy.signal.tests',
        'scipy.optimize.tests',
        'scipy.interpolate.tests',
        'scipy.integrate.tests',
        'scipy.odr.tests',
        'scipy._lib.tests',
        # ── sklearn 测试模块 ──
        'sklearn.tests',
        'sklearn.utils.tests',
        'sklearn.cluster.tests',
        'sklearn.decomposition.tests',
    ],
    cipher=block_cipher,
    noarchive=False,
)

# ──────────────────────────────────────────────
# PYZ
# ──────────────────────────────────────────────

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# ──────────────────────────────────────────────
# UPX 排除列表
# ──────────────────────────────────────────────
# 这些 DLL/pyd 不能被 UPX 压缩，否则会导致运行时崩溃：
# - vcruntime140.dll / python3.dll — C 运行时和 Python 核心
# - _torch*.pyd / torch_cpu.dll / torch_python.dll — torch 的原生扩展
# - _pydantic_core.* — pydantic C 扩展
# - *.pyd (所有) — Python C 扩展模块（UPX 可能导致加载失败）

UPX_EXCLUDE = [
    'vcruntime140.dll',
    'python3.dll',
    'python314.dll',
    '_torch*.pyd',
    'torch_cpu.dll',
    'torch_python.dll',
    '_pydantic_core*.pyd',
    'pydantic_core*.pyd',
    'libcrypto-3.dll',
    'libssl-3.dll',
]

# ──────────────────────────────────────────────
# EXE
# ──────────────────────────────────────────────

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='v9-python-sidecar',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_dir=_UPX_DIR if _UPX_DIR else None,
    upx_exclude=UPX_EXCLUDE,
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

# ──────────────────────────────────────────────
# COLLECT（目录模式，非单文件）
# ──────────────────────────────────────────────

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_dir=_UPX_DIR if _UPX_DIR else None,
    upx_exclude=UPX_EXCLUDE,
    name='v9-python-sidecar',
)
