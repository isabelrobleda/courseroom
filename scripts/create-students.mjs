#!/usr/bin/env node
/**
 * Crea cuentas de alumnos a partir de un CSV (email,nombre) con una contraseña común,
 * y renombra el curso importado a "Modelo Senda".
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-students.mjs import/alumnos.csv Senda541
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*)"?\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}
const url = process.env.VITE_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
const [csvPath, password] = process.argv.slice(2)
if (!url || !key || !csvPath || !password) {
  console.error('Uso: SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-students.mjs <alumnos.csv> <contraseña>')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

// 1. Renombrar el curso (si todavía tiene el nombre antiguo)
const { data: renamed } = await supabase.from('courses')
  .update({ title: 'Modelo Senda', description: 'Modelo Educativo Senda · Colegio Senda · Plataforma Team Meet. Cada parte incluye el material de lectura en PDF, un quiz y una tarea abierta.' })
  .eq('title', 'Colegio Senda · Plataforma Team Meet').select()
if (renamed?.length) console.log('✓ Curso renombrado a "Modelo Senda"')
const { data: course } = await supabase.from('courses').select('id').eq('title', 'Modelo Senda').maybeSingle()
if (course) {
  const { data: mods } = await supabase.from('modules').select('id, title').eq('course_id', course.id).like('title', 'Módulo 4 · %')
  for (const m of mods ?? []) await supabase.from('modules').update({ title: m.title.replace('Módulo 4 · ', '') }).eq('id', m.id)
  if (mods?.length) console.log(`✓ ${mods.length} partes renombradas (sin el prefijo "Módulo 4 · ")`)
}

// 2. Crear alumnos
const rows = readFileSync(csvPath, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean).slice(1)
let created = 0, skipped = 0, failed = 0
for (const line of rows) {
  const [emailRaw, ...rest] = line.split(',')
  const email = emailRaw.trim().toLowerCase(), full_name = rest.join(',').trim() || email.split('@')[0]
  const { error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })
  if (!error) { created++; console.log(`✓ ${email}  (${full_name})`); continue }
  if (/already|registered|exists/i.test(error.message)) { skipped++; console.log(`• ${email} ya existía, se omite`); continue }
  failed++; console.error(`✗ ${email}: ${error.message}`)
}
console.log(`\nListo: ${created} creados, ${skipped} ya existían, ${failed} con error.`)
console.log(`Todos con la contraseña "${password}". Pueden entrar directamente en la app (sin confirmar correo).`)
