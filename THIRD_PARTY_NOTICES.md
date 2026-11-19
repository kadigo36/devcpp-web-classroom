# Third-party notices

This proof of concept dynamically loads the YoWASP Clang/LLD browser toolchain from jsDelivr.

- **@yowasp/clang** — YoWASP Clang/LLD WebAssembly package. See the package/repository for its ISC packaging license and LLVM/Clang upstream licensing terms.
- **LLVM/Clang/LLD** — upstream LLVM Project components, distributed under the Apache License 2.0 with LLVM exceptions where applicable.
- **cpp-forge** — used as an architectural reference for the browser-only compilation pipeline; MIT licensed. No cpp-forge UI code is bundled in this PoC.

The compiler artefacts are not vendored in this ZIP; they are fetched by the browser from the pinned CDN URL on first use.
