// Pure Node.js Vercel Serverless Function — no Express
// Writes new members to Supabase (shared, persistent, real database).

const { supabase, configError } = require('./_supabase');

const POSITIONS = ['ST', 'CM', 'WF', 'CB'];

function nextMemberId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return 'FP-' + code;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return;
  }

  if (configError) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: configError }));
    return;
  }

  let payload;
  try {
    payload = await readBody(req);
  } catch (e) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
    return;
  }

  const nama = (payload?.nama || '').trim();
  const usia = parseInt(payload?.usia, 10);
  const gameId = (payload?.gameId || '').trim();
  const username = (payload?.username || '').trim();
  const alasan = (payload?.alasan || '').trim();
  const avatar = (payload?.avatar || 'avatar1.svg').trim();
  const posisi = (payload?.posisi || '').trim().toUpperCase();

  const errors = {};
  if (!nama || nama.length < 3) errors.nama = 'Nama minimal 3 karakter';
  if (!usia || usia < 10 || usia > 80) errors.usia = 'Usia tidak valid';
  if (!gameId) errors.gameId = 'ID Game wajib diisi';
  if (!username || username.length < 3) errors.username = 'Username minimal 3 karakter';
  if (!alasan || alasan.length < 10) errors.alasan = 'Ceritakan alasanmu (min. 10 karakter)';
  if (!POSITIONS.includes(posisi)) errors.posisi = 'Pilih posisi (ST, CM, WF, atau CB)';

  if (Object.keys(errors).length === 0) {
    // Duplicate check against Supabase (case-insensitive)
    const { data: existing, error: lookupError } = await supabase
      .from('members')
      .select('game_id, username')
      .or(`game_id.ilike.${gameId},username.ilike.${username}`);

    if (lookupError) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Gagal memeriksa data, coba lagi' }));
      return;
    }

    const gameIdTaken = existing.some((r) => r.game_id.toLowerCase() === gameId.toLowerCase());
    const usernameTaken = existing.some((r) => r.username.toLowerCase() === username.toLowerCase());
    if (gameIdTaken) errors.gameId = 'ID Game sudah terdaftar';
    if (usernameTaken) errors.username = 'Username sudah dipakai lord lain';
  }

  if (Object.keys(errors).length > 0) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, errors }));
    return;
  }

  // Retry a couple of times in the rare case of a memberId collision
  // (unique constraint on member_id would reject a duplicate insert).
  let inserted = null;
  let insertError = null;
  for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
    const memberId = nextMemberId();
    const { data, error } = await supabase
      .from('members')
      .insert({
        member_id: memberId,
        nama, usia, game_id: gameId, username, alasan, avatar, posisi,
        status: 'succeed',
      })
      .select()
      .single();

    if (!error) { inserted = data; break; }
    insertError = error;
    // 23505 = unique_violation. Only worth retrying if it's the member_id
    // that collided, not game_id/username (which we already validated above
    // but could still race with a concurrent request).
    if (error.code !== '23505') break;
  }

  if (!inserted) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    if (insertError && insertError.code === '23505') {
      res.end(JSON.stringify({ ok: false, errors: { username: 'ID Game atau username baru saja dipakai orang lain, coba lagi' } }));
    } else {
      res.end(JSON.stringify({ ok: false, errors: { nama: 'Gagal menyimpan data, coba lagi' } }));
    }
    return;
  }

  const member = {
    memberId: inserted.member_id,
    nama: inserted.nama,
    usia: inserted.usia,
    gameId: inserted.game_id,
    username: inserted.username,
    alasan: inserted.alasan,
    avatar: inserted.avatar,
    posisi: inserted.posisi,
    status: inserted.status,
    joinedAt: inserted.joined_at,
  };

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ ok: true, member }));
};
