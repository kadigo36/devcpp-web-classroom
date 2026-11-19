const ERRNO = {
  SUCCESS: 0,
  BADF: 8,
  INVAL: 28,
  IO: 29,
  NOSYS: 52,
  SPIPE: 70,
};

const FILETYPE_CHARACTER_DEVICE = 2;
const DEFAULT_MAX_OUTPUT_BYTES = 1_000_000;

export class WasiExit extends Error {
  constructor(code) {
    super(`WASI exit ${code}`);
    this.name = 'WasiExit';
    this.code = Number(code) >>> 0;
  }
}

function u64(view, offset, value) {
  view.setBigUint64(offset, BigInt(value), true);
}

export class TinyWasi {
  constructor({ input = '', args = ['program.wasm'], env = {}, maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES } = {}) {
    this.input = new TextEncoder().encode(String(input));
    this.inputOffset = 0;
    this.args = args.map(String);
    this.env = Object.entries(env).map(([k, v]) => `${k}=${v}`);
    this.stdout = [];
    this.stderr = [];
    this.memory = null;
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
    this.maxOutputBytes = maxOutputBytes;
    this.outputBytes = 0;
    this.outputTruncated = false;
  }

  attach(instance) {
    const memory = instance?.exports?.memory;
    if (!(memory instanceof WebAssembly.Memory)) throw new Error('O programa WASI não exporta memória.');
    this.memory = memory;
  }

  bytes() {
    if (!this.memory) throw new Error('Memória WASI indisponível.');
    return new Uint8Array(this.memory.buffer);
  }

  view() {
    if (!this.memory) throw new Error('Memória WASI indisponível.');
    return new DataView(this.memory.buffer);
  }

  writeU32(ptr, value) {
    this.view().setUint32(ptr >>> 0, value >>> 0, true);
  }

  writeStrings(strings, ptrTable, ptrBuffer) {
    const bytes = this.bytes();
    const view = this.view();
    let cursor = ptrBuffer >>> 0;
    strings.forEach((value, i) => {
      const encoded = this.encoder.encode(value + '\0');
      view.setUint32((ptrTable >>> 0) + i * 4, cursor, true);
      bytes.set(encoded, cursor);
      cursor += encoded.length;
    });
  }

  importObject(module) {
    const known = this.imports();
    const wasi = {};
    for (const entry of WebAssembly.Module.imports(module)) {
      if (entry.module !== 'wasi_snapshot_preview1' || entry.kind !== 'function') continue;
      wasi[entry.name] = known[entry.name] ?? (() => ERRNO.NOSYS);
    }
    return { wasi_snapshot_preview1: wasi };
  }

  imports() {
    return {
      args_sizes_get: (argcPtr, argvBufSizePtr) => {
        this.writeU32(argcPtr, this.args.length);
        const size = this.args.reduce((n, s) => n + this.encoder.encode(s).length + 1, 0);
        this.writeU32(argvBufSizePtr, size);
        return ERRNO.SUCCESS;
      },
      args_get: (argvPtr, argvBufPtr) => {
        this.writeStrings(this.args, argvPtr, argvBufPtr);
        return ERRNO.SUCCESS;
      },
      environ_sizes_get: (countPtr, bufSizePtr) => {
        this.writeU32(countPtr, this.env.length);
        const size = this.env.reduce((n, s) => n + this.encoder.encode(s).length + 1, 0);
        this.writeU32(bufSizePtr, size);
        return ERRNO.SUCCESS;
      },
      environ_get: (environPtr, environBufPtr) => {
        this.writeStrings(this.env, environPtr, environBufPtr);
        return ERRNO.SUCCESS;
      },
      fd_write: (fd, iovs, iovsLen, nwrittenPtr) => {
        if (fd !== 1 && fd !== 2) return ERRNO.BADF;
        const bytes = this.bytes();
        const view = this.view();
        let total = 0;
        const chunks = [];
        for (let i = 0; i < iovsLen; i++) {
          const base = (iovs >>> 0) + i * 8;
          const ptr = view.getUint32(base, true);
          const len = view.getUint32(base + 4, true);
          chunks.push(bytes.slice(ptr, ptr + len));
          total += len;
        }
        const merged = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }

        const remaining = Math.max(0, this.maxOutputBytes - this.outputBytes);
        if (remaining > 0) {
          const visible = merged.subarray(0, remaining);
          (fd === 1 ? this.stdout : this.stderr).push(visible);
          this.outputBytes += visible.length;
        }
        if (merged.length > remaining) this.outputTruncated = true;

        this.writeU32(nwrittenPtr, total);
        return ERRNO.SUCCESS;
      },
      fd_read: (fd, iovs, iovsLen, nreadPtr) => {
        if (fd !== 0) return ERRNO.BADF;
        const bytes = this.bytes();
        const view = this.view();
        let total = 0;
        for (let i = 0; i < iovsLen && this.inputOffset < this.input.length; i++) {
          const base = (iovs >>> 0) + i * 8;
          const ptr = view.getUint32(base, true);
          const len = view.getUint32(base + 4, true);
          const count = Math.min(len, this.input.length - this.inputOffset);
          bytes.set(this.input.subarray(this.inputOffset, this.inputOffset + count), ptr);
          this.inputOffset += count;
          total += count;
        }
        this.writeU32(nreadPtr, total);
        return ERRNO.SUCCESS;
      },
      fd_close: fd => (fd >= 0 && fd <= 2 ? ERRNO.SUCCESS : ERRNO.BADF),
      fd_datasync: fd => (fd >= 0 && fd <= 2 ? ERRNO.SUCCESS : ERRNO.BADF),
      fd_sync: fd => (fd >= 0 && fd <= 2 ? ERRNO.SUCCESS : ERRNO.BADF),
      fd_fdstat_get: (fd, statPtr) => {
        if (fd < 0 || fd > 2) return ERRNO.BADF;
        const view = this.view();
        const p = statPtr >>> 0;
        for (let i = 0; i < 24; i++) view.setUint8(p + i, 0);
        view.setUint8(p, FILETYPE_CHARACTER_DEVICE);
        view.setUint16(p + 2, 0, true);
        u64(view, p + 8, 0xffffffffffffffffn);
        u64(view, p + 16, 0xffffffffffffffffn);
        return ERRNO.SUCCESS;
      },
      fd_fdstat_set_flags: fd => (fd >= 0 && fd <= 2 ? ERRNO.SUCCESS : ERRNO.BADF),
      fd_filestat_get: (fd, statPtr) => {
        if (fd < 0 || fd > 2) return ERRNO.BADF;
        const view = this.view();
        const p = statPtr >>> 0;
        for (let i = 0; i < 64; i++) view.setUint8(p + i, 0);
        view.setUint8(p + 16, FILETYPE_CHARACTER_DEVICE);
        return ERRNO.SUCCESS;
      },
      fd_seek: () => ERRNO.SPIPE,
      fd_tell: () => ERRNO.SPIPE,
      fd_prestat_get: () => ERRNO.BADF,
      fd_prestat_dir_name: () => ERRNO.BADF,
      clock_res_get: (_clockId, resolutionPtr) => {
        u64(this.view(), resolutionPtr >>> 0, 1_000_000n);
        return ERRNO.SUCCESS;
      },
      clock_time_get: (_clockId, _precision, timePtr) => {
        u64(this.view(), timePtr >>> 0, BigInt(Date.now()) * 1_000_000n);
        return ERRNO.SUCCESS;
      },
      random_get: (bufPtr, bufLen) => {
        const target = this.bytes().subarray(bufPtr >>> 0, (bufPtr >>> 0) + (bufLen >>> 0));
        for (let offset = 0; offset < target.length; offset += 65_536) {
          crypto.getRandomValues(target.subarray(offset, Math.min(offset + 65_536, target.length)));
        }
        return ERRNO.SUCCESS;
      },
      sched_yield: () => ERRNO.SUCCESS,
      proc_exit: code => { throw new WasiExit(code); },
      proc_raise: () => ERRNO.NOSYS,
      poll_oneoff: () => ERRNO.NOSYS,
      path_open: () => ERRNO.NOSYS,
      path_create_directory: () => ERRNO.NOSYS,
      path_filestat_get: () => ERRNO.NOSYS,
      path_filestat_set_times: () => ERRNO.NOSYS,
      path_link: () => ERRNO.NOSYS,
      path_readlink: () => ERRNO.NOSYS,
      path_remove_directory: () => ERRNO.NOSYS,
      path_rename: () => ERRNO.NOSYS,
      path_symlink: () => ERRNO.NOSYS,
      path_unlink_file: () => ERRNO.NOSYS,
    };
  }

  text(stream = 'stdout') {
    const chunks = stream === 'stderr' ? this.stderr : this.stdout;
    let total = 0;
    for (const chunk of chunks) total += chunk.length;
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return this.decoder.decode(merged);
  }
}

export async function executeWasi(bytes, input = '') {
  const module = await WebAssembly.compile(bytes);
  const wasi = new TinyWasi({ input });
  const instance = await WebAssembly.instantiate(module, wasi.importObject(module));
  wasi.attach(instance);
  let exitCode = 0;
  try {
    if (typeof instance.exports._start !== 'function') throw new Error('O módulo não exporta _start.');
    instance.exports._start();
  } catch (error) {
    if (error instanceof WasiExit) exitCode = error.code;
    else throw error;
  }
  return { exitCode, stdout: wasi.text('stdout'), stderr: wasi.text('stderr'), outputTruncated: wasi.outputTruncated };
}
