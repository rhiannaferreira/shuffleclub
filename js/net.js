// Shuffle Club online tables.
// Two browsers talk directly (WebRTC data channel via PeerJS); the free PeerJS
// broker only introduces them. The host's device runs the game and sends state;
// the guest sends taps. The API mirrors the small "room" interface the games use:
//   const table = await ShuffleNet.join('speed-abcd', { role: 'host' | 'guest' })
//   table.emit(topic, data) -> Promise
//   table.on(topic, fn({peer, sameTab, data})) -> unsubscribe
//   table.onPeers(fn({peers, joined, left})) -> unsubscribe
//   table.leave() -> Promise
(() => {
  const PREFIX = 'shuffleclub-v1-';
  const CONNECT_TIMEOUT = 15000;

  // Tests (or a self-hosted broker) can set window.SHUFFLE_PEER_OPTS before this loads.
  const peerOpts = () => Object.assign({ debug: 0 }, window.SHUFFLE_PEER_OPTS || {});

  function makeTable(peer, role) {
    const conns = new Map(); // peer id -> DataConnection
    const topicSubs = new Map();
    const peerSubs = new Set();
    let closed = false;

    const info = id => ({ peer: id, sameTab: false, kind: 'viewer' });
    const notifyPeers = (joined, left) => {
      const ch = { peers: [...conns.keys()].map(info), joined: joined.map(info), left: left.map(info) };
      peerSubs.forEach(fn => { try { fn(ch); } catch (e) { console.error(e); } });
    };
    const deliver = (from, raw) => {
      if (!raw || typeof raw !== 'object' || typeof raw.t !== 'string') return;
      const subs = topicSubs.get(raw.t);
      if (subs) subs.forEach(fn => { try { fn({ peer: from, sameTab: false, data: raw.d }); } catch (e) { console.error(e); } });
    };

    function attach(conn) {
      const add = () => {
        if (closed) { conn.close(); return; }
        conns.set(conn.peer, conn);
        notifyPeers([conn.peer], []);
      };
      conn.on('data', d => deliver(conn.peer, d));
      const drop = () => {
        if (conns.get(conn.peer) !== conn) return;
        conns.delete(conn.peer);
        notifyPeers([], [conn.peer]);
      };
      conn.on('close', drop);
      conn.on('error', drop);
      if (conn.open) add(); else conn.on('open', add);
    }

    // Keep the host reachable if the phone briefly loses the broker.
    peer.on('disconnected', () => { if (!closed && !peer.destroyed) { try { peer.reconnect(); } catch (e) {} } });
    if (role === 'host') peer.on('connection', attach);

    return {
      attach,
      emit(topic, data) {
        if (closed) return Promise.reject(new Error('closed'));
        const msg = { t: topic, d: data };
        conns.forEach(c => { if (c.open) { try { c.send(msg); } catch (e) {} } });
        return Promise.resolve();
      },
      on(topic, fn) {
        if (!topicSubs.has(topic)) topicSubs.set(topic, new Set());
        topicSubs.get(topic).add(fn);
        return () => topicSubs.get(topic).delete(fn);
      },
      onPeers(fn) {
        peerSubs.add(fn);
        if (conns.size) fn({ peers: [...conns.keys()].map(info), joined: [...conns.keys()].map(info), left: [] });
        return () => peerSubs.delete(fn);
      },
      leave() {
        closed = true;
        conns.forEach(c => { try { c.close(); } catch (e) {} });
        conns.clear(); topicSubs.clear(); peerSubs.clear();
        try { peer.destroy(); } catch (e) {}
        return Promise.resolve();
      }
    };
  }

  function join(name, opts = {}) {
    if (!window.Peer) return Promise.reject(new Error('Online play could not load.'));
    const role = opts.role === 'host' ? 'host' : 'guest';
    const hostId = PREFIX + String(name).toLowerCase().replace(/[^a-z0-9-]/g, '');

    return new Promise((resolve, reject) => {
      const peer = role === 'host' ? new window.Peer(hostId, peerOpts()) : new window.Peer(peerOpts());
      let settled = false;
      const fail = err => {
        if (settled) return; settled = true; clearTimeout(timer);
        try { peer.destroy(); } catch (e) {}
        reject(err instanceof Error ? err : new Error(String(err)));
      };
      const timer = setTimeout(() => fail(new Error('timeout')), CONNECT_TIMEOUT);
      peer.on('error', err => fail(err));

      peer.on('open', () => {
        const table = makeTable(peer, role);
        if (role === 'host') { settled = true; clearTimeout(timer); resolve(table); return; }
        const conn = peer.connect(hostId, { reliable: true, serialization: 'json' });
        conn.on('open', () => {
          if (settled) return; settled = true; clearTimeout(timer);
          table.attach(conn);
          resolve(table);
        });
        conn.on('error', fail);
      });
    });
  }

  window.ShuffleNet = { join, available: () => !!window.Peer };
})();
