// Pure Node.js Vercel Serverless Function — no Express
// Reads the member roster from Supabase (shared, persistent, real database).

const { supabase, configError } = require('./_supabase');

function toClientShape(row) {
  return {
    memberId: row.member_id,
    nama: row.nama,
    usia: row.usia,
    gameId: row.game_id,
    username: row.username,
    alasan: row.alasan,
    avatar: row.avatar,
    posisi: row.posisi,
    status: row.status,
    joinedAt: row.joined_at,
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
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

  const { data, error } = await supabase
    .from('members')
    .select('*')
    .order('joined_at', { ascending: true });

  if (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Gagal mengambil data anggota' }));
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ ok: true, members: data.map(toClientShape) }));
};
