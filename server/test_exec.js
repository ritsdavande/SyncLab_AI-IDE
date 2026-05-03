fetch('https://wandbox.org/api/compile.json', { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({ 
        compiler: 'swift-5.10.1', 
        code: 'print("Hello Wandbox")' 
    }) 
}).then(r => r.json()).then(console.log).catch(console.error);
