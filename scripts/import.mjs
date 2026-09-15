#!/usr/bin/env node
/**
 * Imports a course definition (JSON + PDFs) into Courseroom.
 *
 *   node scripts/import.mjs import/modulo4/modulo4.json
 *
 * Needs two environment variables (put them in .env or pass inline):
 *   VITE_SUPABASE_URL           – same as the app
 *   SUPABASE_SERVICE_ROLE_KEY   – Supabase → Project Settings → API → service_role (secret!)
 *
 * The service_role key bypasses row-level security, so never put it in the frontend
 * or commit it. It only lives on your machine for the duration of this script.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

// --- tiny .env loader (no extra dependency) ---
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*)"?\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const file = process.argv[2]
if (!url || !key || !file) {
  console.error('Usage: SUPABASE_SERVICE_ROLE_KEY=... node scripts/import.mjs <path/to/course.json>')
  console.error('VITE_SUPABASE_URL is read from .env; SUPABASE_SERVICE_ROLE_KEY can go in .env too.')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })
const def = JSON.parse(readFileSync(file, 'utf8'))
const baseDir = dirname(resolve(file))
const die = (msg, err) => { console.error(`✗ ${msg}:`, err?.message ?? err); process.exit(1) }

// 1. Course (reuse if a course with the same title already exists)
let { data: course } = await supabase.from('courses').select('*').eq('title', def.course.title).maybeSingle()
if (course) {
  console.log(`• Course already exists, adding modules to it: ${course.title}`)
} else {
  const { data, error } = await supabase.from('courses').insert(def.course).select().single()
  if (error) die('creating course', error)
  course = data
  console.log(`✓ Course created: ${course.title}`)
}

// Continue numbering after any existing modules
const { count } = await supabase.from('modules').select('*', { count: 'exact', head: true }).eq('course_id', course.id)
let position = count ?? 0

for (const m of def.modules) {
  const { data: existing } = await supabase.from('modules').select('id').eq('course_id', course.id).eq('title', m.title).maybeSingle()
  if (existing) { console.log(`• Skipping (already imported): ${m.title}`); continue }

  const { data: mod, error: mErr } = await supabase.from('modules')
    .insert({ course_id: course.id, title: m.title, description: m.description ?? null, position: position++, published: true })
    .select().single()
  if (mErr) die(`creating module ${m.title}`, mErr)
  console.log(`✓ Module: ${mod.title}`)

  // 2. Content items
  let itemPos = 0
  if (m.intro) {
    await supabase.from('content_items').insert({ module_id: mod.id, type: 'text', title: 'Introducción', body: m.intro, position: itemPos++ })
  }
  if (m.pdf) {
    const pdfPath = join(baseDir, m.pdf)
    if (!existsSync(pdfPath)) die('PDF not found', pdfPath)
    const storagePath = `${mod.id}/${m.pdf.replace(/[^\w.-]+/g, '_')}`
    const { error: upErr } = await supabase.storage.from('content')
      .upload(storagePath, readFileSync(pdfPath), { contentType: 'application/pdf', upsert: true })
    if (upErr) die(`uploading ${m.pdf}`, upErr)
    const { error } = await supabase.from('content_items')
      .insert({ module_id: mod.id, type: 'pdf', title: m.pdfTitle ?? m.pdf, file_path: storagePath, position: itemPos++ })
    if (error) die('creating pdf item', error)
    console.log(`  ↳ PDF uploaded: ${m.pdf}`)
  }
  for (const v of m.videos ?? []) {
    await supabase.from('content_items').insert({ module_id: mod.id, type: 'video', title: v.title, body: v.url, position: itemPos++ })
    console.log(`  ↳ Video: ${v.title}`)
  }

  // 3. Quiz
  if (m.quiz) {
    const { data: quiz, error } = await supabase.from('quizzes')
      .insert({ module_id: mod.id, title: m.quiz.title ?? 'Quiz', pass_score: m.quiz.passScore ?? null }).select().single()
    if (error) die('creating quiz', error)
    const rows = m.quiz.questions.map((q, i) => ({ quiz_id: quiz.id, question: q.q, options: q.options, correct_index: q.correct, position: i }))
    const { error: qErr } = await supabase.from('quiz_questions').insert(rows)
    if (qErr) die('creating questions', qErr)
    console.log(`  ↳ Quiz: ${rows.length} questions`)
  }

  // 4. Homework
  if (m.homework) {
    const { error } = await supabase.from('homework').insert({
      module_id: mod.id, title: m.homework.title ?? 'Tarea', instructions: m.homework.instructions ?? null,
      allow_file: m.homework.allowFile ?? true, allow_text: m.homework.allowText ?? true,
    })
    if (error) die('creating homework', error)
    console.log(`  ↳ Homework: ${m.homework.title}`)
  }
}

console.log('\nDone. Open the app → Courses to review.')
