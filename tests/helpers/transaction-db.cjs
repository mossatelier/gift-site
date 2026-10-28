const assert = require('node:assert/strict');
module.exports = function fixture(seed, failWrite) {
 let state = structuredClone(seed), revision = 0, sequence = 0;
 function collection(rows, name, transactional) {
  rows[name] ||= [];
  let where = {}, limit = 100, skip = 0, sorting;
  return {
   where(value) { where = value; return this; }, limit(value) { limit = value; return this; }, skip(value) { skip = value; return this; },
   orderBy(key, direction) { sorting = [key, direction]; return this; },
   async get() {
    let values = rows[name].filter(r => Object.entries(where).every(([k,v]) => r[k] === v));
    if (sorting) values.sort((a,b) => (a[sorting[0]] > b[sorting[0]] ? 1 : a[sorting[0]] < b[sorting[0]] ? -1 : 0) * (sorting[1] === 'desc' ? -1 : 1));
    return { data: structuredClone(values.slice(skip, skip + limit)) };
   },
   doc(id) { return {
    async get() { return { data: structuredClone(rows[name].find(r => r._id === id)) }; },
    async update({data}) {
     if (transactional && failWrite === name) throw Error('simulated failure');
     const row = rows[name].find(r => r._id === id); assert.ok(row);
     for (const [k,v] of Object.entries(data)) row[k] = v && v.inc !== undefined ? (row[k] || 0) + v.inc : structuredClone(v);
    },
    async remove() {
     if (transactional && failWrite === name) throw Error('simulated failure');
     rows[name] = rows[name].filter(r => r._id !== id);
    }
   }; },
   async add({data}) {
    if (transactional && failWrite === name) throw Error('simulated failure');
    const id = data._id || 'new-' + sequence++;
    assert.ok(!rows[name].some(r => r._id === id));
    rows[name].push({...structuredClone(data), _id: id}); return {_id: id};
   }
  };
 }
 const db = { command: {inc: n => ({inc:n})}, collection: n => collection(state,n,false), async runTransaction(fn) {
  for (let i=0;i<50;i++) {
   const start = revision, copy = structuredClone(state);
   const result = await fn({collection: n => collection(copy,n,true)});
   if (start !== revision) continue;
   state = copy; revision++; return result;
  }
  throw Error('conflict');
 }};
 return { db, snapshot: () => structuredClone(state), mutate(fn) { fn(state); revision++; } };
};
