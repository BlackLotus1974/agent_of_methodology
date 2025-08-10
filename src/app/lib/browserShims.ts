// Browser compatibility shims for OpenAI Agents SDK
// This fixes the "Cannot read properties of undefined (reading 'bind')" error

// Ensure Function.prototype.bind exists FIRST
if (typeof Function.prototype.bind === 'undefined') {
  Function.prototype.bind = function(thisArg: any, ...args: any[]) {
    const fn = this;
    return function(...innerArgs: any[]) {
      return fn.apply(thisArg, args.concat(innerArgs));
    };
  };
}

// Polyfill for Node.js process object
if (typeof window !== 'undefined' && typeof (window as any).process === 'undefined') {
  (window as any).process = {
    env: {},
    nextTick: (callback: () => void) => setTimeout(callback, 0),
    version: 'v18.0.0',
    versions: { node: '18.0.0' },
    platform: 'browser',
    browser: true,
    argv: [],
    binding: () => ({}),
    cwd: () => '/',
    chdir: () => {},
    umask: () => 0,
    hrtime: () => [0, 0],
    memoryUsage: () => ({ rss: 0, heapTotal: 0, heapUsed: 0, external: 0 }),
    uptime: () => 0,
    exit: () => {},
    kill: () => {},
    pid: 1,
    ppid: 1,
    arch: 'x64',
    title: 'browser',
    execPath: '/usr/bin/node',
    execArgv: [],
    stdout: { 
      write: (...args: any[]) => console.log(...args),
      on: () => {},
      once: () => {},
      emit: () => {},
      bind: () => {},
    },
    stderr: { 
      write: (...args: any[]) => console.error(...args),
      on: () => {},
      once: () => {},
      emit: () => {},
      bind: () => {},
    },
    stdin: { 
      read: () => null,
      on: () => {},
      once: () => {},
      emit: () => {},
    },
    on: () => {},
    once: () => {},
    emit: () => {},
    removeListener: () => {},
    removeAllListeners: () => {},
  };
}

// Polyfill for Buffer if not available
if (typeof window !== 'undefined' && typeof (window as any).Buffer === 'undefined') {
  (window as any).Buffer = {
    from: (data: any) => new TextEncoder().encode(data),
    isBuffer: () => false,
    alloc: (size: number) => new Uint8Array(size),
    allocUnsafe: (size: number) => new Uint8Array(size),
  };
}

// Polyfill for global if not available
if (typeof window !== 'undefined' && typeof (window as any).global === 'undefined') {
  (window as any).global = window;
}



// Polyfill for EventEmitter-like functionality
if (typeof window !== 'undefined') {
  const EventEmitter = class {
    private events: { [key: string]: ((...args: any[]) => void)[] } = {};
    
    on(event: string, listener: (...args: any[]) => void) {
      if (!this.events[event]) this.events[event] = [];
      this.events[event].push(listener);
      return this;
    }
    
    once(event: string, listener: (...args: any[]) => void) {
      const onceWrapper = (...args: any[]) => {
        this.removeListener(event, onceWrapper);
        listener.apply(this, args);
      };
      return this.on(event, onceWrapper);
    }
    
    emit(event: string, ...args: any[]) {
      if (!this.events[event]) return false;
      this.events[event].forEach(listener => listener.apply(this, args));
      return true;
    }
    
    removeListener(event: string, listener: (...args: any[]) => void) {
      if (!this.events[event]) return this;
      this.events[event] = this.events[event].filter(l => l !== listener);
      return this;
    }
    
    removeAllListeners(event?: string) {
      if (event) {
        delete this.events[event];
      } else {
        this.events = {};
      }
      return this;
    }
  };
  
  (window as any).EventEmitter = EventEmitter;
}

export {};