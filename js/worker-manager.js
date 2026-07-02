// worker-manager.js — manages Web Worker lifecycle and task dispatch
// Gives every tool async, non-blocking computation

let _worker = null;
let _pending = {};
let _taskId = 0;
let _workerSupported = true;

function getWorker() {
  if (!_workerSupported) return null;
  if (!_worker) {
    try {
      _worker = new Worker('js/bioworker.js');
      _worker.onmessage = handleWorkerMessage;
      _worker.onerror = (e) => {
        console.warn('BioViz worker error:', e.message);
        _workerSupported = false;
        _worker = null;
        // Reject all pending tasks
        Object.values(_pending).forEach(({reject}) => reject(new Error('Worker failed: ' + e.message)));
        _pending = {};
      };
    } catch(e) {
      _workerSupported = false;
      console.warn('Web Workers not supported, falling back to main thread');
      return null;
    }
  }
  return _worker;
}

function handleWorkerMessage(e) {
  const { id, status, result, error, pct, label } = e.data;

  // Progress update
  if (id === 'progress') {
    if (window._progressCallback) window._progressCallback(pct, label);
    return;
  }

  const task = _pending[id];
  if (!task) return;
  delete _pending[id];

  if (status === 'ok') task.resolve(result);
  else task.reject(new Error(error || 'Worker error'));
}

function runInWorker(type, data, onProgress) {
  return new Promise((resolve, reject) => {
    const worker = getWorker();

    // Set progress callback
    if (onProgress) window._progressCallback = onProgress;

    if (!worker) {
      // Fallback: run synchronously on main thread
      try {
        const result = runFallback(type, data);
        resolve(result);
      } catch(e) {
        reject(e);
      }
      return;
    }

    const id = ++_taskId;
    _pending[id] = { resolve, reject };
    worker.postMessage({ id, type, data });
  });
}

// Fallback implementations for when Workers aren't available
function runFallback(type, data) {
  switch(type) {
    case 'orf':   return findORFs(data.seq, data.minAA, data.allFrames);
    case 'phylo': return { tree: neighborJoining(data.taxa, data.seqs.map((_,i)=>data.seqs.map((_,j)=>i===j?0:(data.method==='jc'?jcDist:pDist)(data.seqs[i],data.seqs[j]))), {name:'root',children:[],bl:0}), D:[], meanDist:0 };
    case 'align': return needlemanWunsch(data.a, data.b, data.ms, data.mm, data.gp);
    default: throw new Error('No fallback for: ' + type);
  }
}

// Terminate worker (called on tab switch to free memory)
function terminateWorker() {
  if (_worker) {
    _worker.terminate();
    _worker = null;
  }
  _pending = {};
}
