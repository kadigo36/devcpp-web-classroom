const ERRNO = {
  SUCCESS: 0,
  BADF: 8,
  INVAL: 28,
  IO: 29,
  NOENT: 44,
  NOSYS: 52,
  NOTSUP: 58,
  SPIPE: 70,
};

const FILETYPE_CHARACTER_DEVICE = 2;
const FILETYPE_DIRECTORY = 3;
const FILETYPE_REGULAR_FILE = 4;
const PREOPEN_FD = 3;
const DEFAULT_MAX_OUTPUT_BYTES = 1_000_000;
const ALL_RIGHTS = 0xffffffffffffffffn;

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

function safeVirtualPath(path) {
  let value = String(path).replace(/\\/g, '/');
  while (value.startsWith('./')) value = value.slice(2);
  if (!value || value.startsWith('/') || value.includes('../') || value.includes('/')) return null;
  return value;
}

export class TinyWasi {
  constructor({
    input = '',
    args = ['program.wasm'],
    env = {},
    files = {},
    maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
    onStdout = null,
    interactiveInput = null,
    onStdinRequest = null,
  } = {}) {
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
    this.input = this.encoder.encode(String(input));
    this.inputOffset = 0;
    this.args = args.map(String);
    this.env = Object.entries(env).map(([k, v]) => `${k}=${v}`);
    this.stdout = [];
    this.stderr = [];
    this.memory = null;
    this.maxOutputBytes = maxOutputBytes;
    this.outputBytes = 0;
    this.outputTruncated = false;
    this.onStdout = typeof onStdout === 'function' ? onStdout : null;
    this.onStdinRequest = typeof onStdinRequest === 'function' ? onStdinRequest : null;
    this.interactiveControl = interactiveInput instanceof SharedArrayBuffer
      ? new Int32Array(interactiveInput, 0, 2)
      : null;
    this.interactiveBytes = interactiveInput instanceof SharedArrayBuffer
      ? new Uint8Array(interactiveInput, 2 * Int32Array.BYTES_PER_ELEMENT)
      : null;
    this.files = new Map();
    this.openFiles = new Map();
    this.nextFd = PREOPEN_FD + 1;

    for (const [name, source] of Object.entries(files ?? {})) {
      const path = safeVirtualPath(name);
      if (!path || typeof source !== 'string') continue;
      this.files.set(path, this.encoder.encode(source));
    }
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

  readPath(ptr, len) {
    const bytes = this.bytes().subarray(ptr >>> 0, (ptr >>> 0) + (len >>> 0));
    return safeVirtualPath(this.decoder.decode(bytes));
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

  writeFdstat(ptr, filetype, rightsBase = ALL_RIGHTS, rightsInheriting = 0n) {
    const view = this.view();
    const p = ptr >>> 0;
    for (let i = 0; i < 24; i++) view.setUint8(p + i, 0);
    view.setUint8(p, filetype);
    view.setUint16(p + 2, 0, true);
    u64(view, p + 8, rightsBase);
    u64(view, p + 16, rightsInheriting);
  }

  writeFilestat(ptr, filetype, size = 0) {
    const view = this.view();
    const p = ptr >>> 0;
    for (let i = 0; i < 64; i++) view.setUint8(p + i, 0);
    u64(view, p + 0, 0n);
    u64(view, p + 8, 0n);
    view.setUint8(p + 16, filetype);
    u64(view, p + 24, 1n);
    u64(view, p + 32, BigInt(size));
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

  requestInteractiveInput() {
    if (!this.interactiveControl || !this.interactiveBytes || !this.onStdinRequest) return null;

    Atomics.store(this.interactiveControl, 1, 0);
    Atomics.store(this.interactiveControl, 0, 0);
    try { this.onStdinRequest(); } catch { return null; }

    const waitResult = Atomics.wait(this.interactiveControl, 0, 0);
    const state = Atomics.load(this.interactiveControl, 0);
    if (waitResult === 'timed-out' || state === 2) return null;
    if (state !== 1) return null;

    const length = Math.max(0, Math.min(
      Atomics.load(this.interactiveControl, 1),
      this.interactiveBytes.length,
    ));
    return this.interactiveBytes.slice(0, length);
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
          if (fd === 1 && visible.length && this.onStdout) {
            try { this.onStdout(this.decoder.decode(visible)); } catch {}
          }
        }

        if (merged.length > remaining) this.outputTruncated = true;
        this.writeU32(nwrittenPtr, total);
        return ERRNO.SUCCESS;
      },

      fd_read: (fd, iovs, iovsLen, nreadPtr) => {
        const bytes = this.bytes();
        const view = this.view();

        let source;
        let position;
        let setPosition;

        if (fd === 0) {
          if (this.inputOffset >= this.input.length) {
            const interactive = this.requestInteractiveInput();
            if (interactive) {
              this.input = interactive;
              this.inputOffset = 0;
            }
          }
          source = this.input;
          position = this.inputOffset;
          setPosition = value => { this.inputOffset = value; };
        } else {
          const open = this.openFiles.get(fd);
          if (!open) return ERRNO.BADF;
          source = open.data;
          position = open.position;
          setPosition = value => { open.position = value; };
        }

        let total = 0;
        for (let i = 0; i < iovsLen && position < source.length; i++) {
          const base = (iovs >>> 0) + i * 8;
          const ptr = view.getUint32(base, true);
          const len = view.getUint32(base + 4, true);
          const count = Math.min(len, source.length - position);
          bytes.set(source.subarray(position, position + count), ptr);
          position += count;
          total += count;
        }

        setPosition(position);
        this.writeU32(nreadPtr, total);
        return ERRNO.SUCCESS;
      },

      fd_close: fd => {
        if (fd >= 0 && fd <= PREOPEN_FD) return fd <= 2 ? ERRNO.SUCCESS : ERRNO.BADF;
        if (!this.openFiles.has(fd)) return ERRNO.BADF;
        this.openFiles.delete(fd);
        return ERRNO.SUCCESS;
      },

      fd_datasync: fd => (fd >= 0 && (fd <= 2 || this.openFiles.has(fd)) ? ERRNO.SUCCESS : ERRNO.BADF),
      fd_sync: fd => (fd >= 0 && (fd <= 2 || this.openFiles.has(fd)) ? ERRNO.SUCCESS : ERRNO.BADF),

      fd_fdstat_get: (fd, statPtr) => {
        if (fd >= 0 && fd <= 2) {
          this.writeFdstat(statPtr, FILETYPE_CHARACTER_DEVICE);
          return ERRNO.SUCCESS;
        }
        if (fd === PREOPEN_FD) {
          this.writeFdstat(statPtr, FILETYPE_DIRECTORY, ALL_RIGHTS, ALL_RIGHTS);
          return ERRNO.SUCCESS;
        }
        if (this.openFiles.has(fd)) {
          this.writeFdstat(statPtr, FILETYPE_REGULAR_FILE);
          return ERRNO.SUCCESS;
        }
        return ERRNO.BADF;
      },

      fd_fdstat_set_flags: fd => (
        fd >= 0 && (fd <= 2 || fd === PREOPEN_FD || this.openFiles.has(fd))
          ? ERRNO.SUCCESS
          : ERRNO.BADF
      ),

      fd_filestat_get: (fd, statPtr) => {
        if (fd >= 0 && fd <= 2) {
          this.writeFilestat(statPtr, FILETYPE_CHARACTER_DEVICE, 0);
          return ERRNO.SUCCESS;
        }
        if (fd === PREOPEN_FD) {
          this.writeFilestat(statPtr, FILETYPE_DIRECTORY, 0);
          return ERRNO.SUCCESS;
        }
        const open = this.openFiles.get(fd);
        if (!open) return ERRNO.BADF;
        this.writeFilestat(statPtr, FILETYPE_REGULAR_FILE, open.data.length);
        return ERRNO.SUCCESS;
      },

      fd_seek: (fd, offset, whence, newOffsetPtr) => {
        const open = this.openFiles.get(fd);
        if (!open) return ERRNO.SPIPE;

        const delta = BigInt(offset);
        let base;
        if (whence === 0) base = 0n;
        else if (whence === 1) base = BigInt(open.position);
        else if (whence === 2) base = BigInt(open.data.length);
        else return ERRNO.INVAL;

        const next = base + delta;
        if (next < 0n || next > BigInt(Number.MAX_SAFE_INTEGER)) return ERRNO.INVAL;
        open.position = Number(next);
        u64(this.view(), newOffsetPtr >>> 0, next);
        return ERRNO.SUCCESS;
      },

      fd_tell: (fd, newOffsetPtr) => {
        const open = this.openFiles.get(fd);
        if (!open) return ERRNO.SPIPE;
        u64(this.view(), newOffsetPtr >>> 0, BigInt(open.position));
        return ERRNO.SUCCESS;
      },

      fd_prestat_get: (fd, prestatPtr) => {
        if (fd !== PREOPEN_FD) return ERRNO.BADF;
        const view = this.view();
        const p = prestatPtr >>> 0;
        for (let i = 0; i < 8; i++) view.setUint8(p + i, 0);
        view.setUint8(p, 0);
        view.setUint32(p + 4, 1, true);
        return ERRNO.SUCCESS;
      },

      fd_prestat_dir_name: (fd, pathPtr, pathLen) => {
        if (fd !== PREOPEN_FD) return ERRNO.BADF;
        if (pathLen < 1) return ERRNO.INVAL;
        this.bytes()[pathPtr >>> 0] = '.'.charCodeAt(0);
        return ERRNO.SUCCESS;
      },

      path_open: (
        fd,
        _dirFlags,
        pathPtr,
        pathLen,
        oflags,
        _rightsBase,
        _rightsInheriting,
        _fdflags,
        openedFdPtr,
      ) => {
        if (fd !== PREOPEN_FD) return ERRNO.BADF;
        if (oflags !== 0) return ERRNO.NOTSUP;

        const path = this.readPath(pathPtr, pathLen);
        if (!path) return ERRNO.INVAL;
        const data = this.files.get(path);
        if (!data) return ERRNO.NOENT;

        const openedFd = this.nextFd++;
        this.openFiles.set(openedFd, { path, data, position: 0 });
        this.writeU32(openedFdPtr, openedFd);
        return ERRNO.SUCCESS;
      },

      path_filestat_get: (fd, _flags, pathPtr, pathLen, statPtr) => {
        if (fd !== PREOPEN_FD) return ERRNO.BADF;
        const path = this.readPath(pathPtr, pathLen);
        if (!path) return ERRNO.INVAL;
        const data = this.files.get(path);
        if (!data) return ERRNO.NOENT;
        this.writeFilestat(statPtr, FILETYPE_REGULAR_FILE, data.length);
        return ERRNO.SUCCESS;
      },

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

      path_create_directory: () => ERRNO.NOTSUP,
      path_filestat_set_times: () => ERRNO.NOTSUP,
      path_link: () => ERRNO.NOTSUP,
      path_readlink: () => ERRNO.NOTSUP,
      path_remove_directory: () => ERRNO.NOTSUP,
      path_rename: () => ERRNO.NOTSUP,
      path_symlink: () => ERRNO.NOTSUP,
      path_unlink_file: () => ERRNO.NOTSUP,
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

export async function executeWasi(bytes, input = '', options = {}) {
  const module = await WebAssembly.compile(bytes);
  const args = ['program.wasm', ...(Array.isArray(options.args) ? options.args : [])];
  const wasi = new TinyWasi({
    input,
    args,
    files: options.files ?? {},
    onStdout: options.onStdout,
    interactiveInput: options.interactiveInput,
    onStdinRequest: options.onStdinRequest,
  });
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

  return {
    exitCode,
    stdout: wasi.text('stdout'),
    stderr: wasi.text('stderr'),
    outputTruncated: wasi.outputTruncated,
  };
}
