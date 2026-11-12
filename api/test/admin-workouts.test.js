import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = crypto.randomBytes(32).toString('hex');
function mintSession(uid) {
  const payload = `${uid}:${Date.now() + 86400000}:0`;
  return payload + '.' + crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}
const ADMIN = 'u_adm_1', STUDENT = 'u_stu_1';
const adminHeaders = { Cookie: `gymsid=${mintSession(ADMIN)}`, 'Content-Type': 'application/json', Origin: 'http://localhost:8080' };
const studentHeaders = { Cookie: `gymsid=${mintSession(STUDENT)}`, 'Content-Type': 'application/json', Origin: 'http://localhost:8080' };

async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-adm-wk-'));
  fs.writeFileSync(path.join(dataDir, 'secret'), SECRET, { mode: 0o600 });
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({
    users: [
      { id: ADMIN, name: 'Admin', created: new Date().toISOString(), admin: true },
      { id: STUDENT, name: 'Aluno', created: new Date().toISOString() }
    ], creds: [], subs: [], invites: [], templates: []
  }));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost' }
  });
  const h = { log: '', dataDir };
  child.stdout.on('data', d => h.log += d);
  child.stderr.on('data', d => h.log += d);
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(dataDir, { recursive: true, force: true }); });
  h.port = await boundPort(child, () => h.log);
  h.api = `http://127.0.0.1:${h.port}`;
  return h;
}

test('admin can create/delete workout templates and assign routines to registered students', async (t) => {
  const h = await startServer(t);

  // Non-admin is forbidden
  const denied = await fetch(`${h.api}/api/admin/templates`, { headers: studentHeaders });
  assert.equal(denied.status, 403);

  // Create template
  const created = await fetch(`${h.api}/api/admin/templates`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'Treino A - Peito',
      emoji: '💪',
      ex: [{ id: '0025', name: 'Supino reto com barra', sets: 4, reps: '8-10', weight: 60, rest: 90, note: 'Cadência 3-1-1' }]
    })
  });
  assert.equal(created.status, 200);
  const { template } = await created.json();
  assert.ok(template.id.startsWith('tpl_'));

  // List templates
  const listRes = await fetch(`${h.api}/api/admin/templates`, { headers: adminHeaders });
  const listData = await listRes.json();
  assert.equal(listData.templates.length, 1);
  assert.equal(listData.templates[0].name, 'Treino A - Peito');

  // Assign template to student on Monday (1) and Wednesday (3)
  const assignRes = await fetch(`${h.api}/api/admin/user/routines`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ templateId: template.id, userIds: [STUDENT], mode: 'add', weekdays: ['1', '3'] })
  });
  assert.equal(assignRes.status, 200);
  const assignData = await assignRes.json();
  assert.equal(assignData.assigned.length, 1);

  // Student sees assigned routine when syncing GET /api/data
  const stuDataRes = await fetch(`${h.api}/api/data`, { headers: studentHeaders });
  assert.equal(stuDataRes.status, 200);
  const stuData = await stuDataRes.json();
  assert.equal(stuData.state.routines.length, 1);
  assert.equal(stuData.state.routines[0].name, 'Treino A - Peito');
  assert.equal(stuData.state.routines[0].assignedByAdmin, true);
  assert.deepEqual(stuData.state.week['1'], [stuData.state.routines[0].id]);
  assert.deepEqual(stuData.state.week['3'], [stuData.state.routines[0].id]);

  // Admin drill-down shows the assigned routine
  const detailRes = await fetch(`${h.api}/api/admin/user?id=${STUDENT}`, { headers: adminHeaders });
  const detail = await detailRes.json();
  assert.equal(detail.routines.length, 1);
  assert.equal(detail.routines[0].assignedByAdmin, true);

  // Delete template
  const delRes = await fetch(`${h.api}/api/admin/templates/delete`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ id: template.id })
  });
  assert.equal(delRes.status, 200);
});

