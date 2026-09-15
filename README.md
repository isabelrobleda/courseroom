# Courseroom

A tiny Teachable-style course platform. You (the teacher) build courses out of modules; each module holds content (text, images, PDFs, video links), an optional auto-graded multiple-choice quiz and optional homework (file upload and/or written answer). Students sign in with email + password, work through the modules, and you get a Reports page with CSV export plus a Homework inbox.

Stack: React + Vite + Tailwind v4 (frontend, deploy on Vercel) · Supabase (Postgres, Auth, Storage).

---

## 1. Create the Supabase project (~5 min)

1. Go to <https://supabase.com>, create a project (free tier is fine). Pick a region close to you (e.g. Frankfurt).
2. Open **SQL Editor → New query**, paste the entire contents of `supabase/schema.sql`, and click **Run**.
   - Before running, check the line with `isabel.robleda@auto1.com` in the `handle_new_user` function: whoever signs up with that email becomes the teacher (admin) automatically. Change it if you want a different login. You can always promote someone later from the **Students** page in the app, or with SQL:
     `update public.profiles set role = 'admin' where email = 'you@example.com';`
3. **Authentication → Providers → Email**: leave Email enabled. Decide about *Confirm email*:
   - ON (default): students must click a confirmation link before signing in.
   - OFF: students can sign in immediately after creating an account. Simpler for a small private group.
4. **Authentication → URL Configuration**: after you deploy, add your Vercel URL to *Site URL* and *Redirect URLs* (only matters if email confirmation is on).
5. **Project Settings → API**: copy the **Project URL** and the **anon public** key.

The SQL script also creates two storage buckets: `content` (public, for your images/PDFs) and `homework` (private; students can only see their own files, you can see all).

## 2. Run locally

```bash
npm install
cp .env.example .env      # paste the URL and anon key from step 1.5
npm run dev
```

Open <http://localhost:5173>, click **Create account**, sign up with the admin email. You land in the teacher area.

## 3. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel: **Add New Project → import the repo**. Framework preset: *Vite*. Build command `npm run build`, output `dist` (auto-detected).
3. Under **Environment Variables** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy. `vercel.json` is included so client-side routes (e.g. `/module/…`) work on refresh.
5. Go back to Supabase → Authentication → URL Configuration and set the Site URL to your Vercel domain.

Send students the URL; they create their own account (no invite step). If you'd rather control who joins, turn off sign-ups in Supabase Auth settings and create users manually under **Authentication → Users**.

---

## Using it

**Teacher (admin) area**

- **Courses** → create a course, then modules inside it. Reorder with the arrows. Courses start as *Draft*; click the eye icon to publish so students can see them. Individual modules can be hidden too.
- **Module editor** has three tabs:
  - *Content*: add text (blank line = new paragraph, `# Heading`, `- bullet`), upload an image or PDF, or paste a YouTube / Vimeo / Loom / Google Drive video link.
  - *Quiz*: multiple choice, pick the correct option with the radio button. Optional pass score. Students see their result immediately and can retake; reports show best score and number of attempts.
  - *Homework*: instructions plus whether students may upload a file, write text, or both.
  - "Preview as student" opens the module the way students see it (teacher previews don't count as "read" and can't submit).
- **Reports** → pick a course. *Matrix* view shows one row per student and one column per module: ✓ read, best quiz score, HW badge if handed in. *Detail* view is one row per student × module. Two CSV downloads:
  - **Summary CSV** — one row per student: modules read / total, quizzes done, total correct answers / total questions, homework submitted / total.
  - **Detailed CSV** — one row per student per module: read yes/no + timestamp, quiz done, best score, attempts, homework submitted + timestamp.
- **Homework** → every submission, newest first, filterable by module and student. Click the attachment to open it (secure link, valid 1 hour).
- **Students** → everyone with an account; change roles here.

**Student area**

Course cards with a progress bar → module list with read / quiz / homework status → module page. Opening a module marks it as read. Quiz and homework blocks sit at the bottom of the module page.

---

## Project layout

```
supabase/schema.sql          tables, row-level security, storage buckets, report view
src/lib/                     supabase client, auth context, storage helpers, CSV, types
src/components/              layout, small UI bits, ContentViewer (renders text/image/pdf/video)
src/pages/Login.tsx
src/pages/admin/             AdminCourses, AdminCourse, AdminModule, AdminReports, AdminHomework, AdminStudents
src/pages/student/           StudentHome, StudentCourse, StudentModule
```

## Notes & limits

- Quizzes are graded in the browser, and students can technically read the correct answers via the API. Fine for learning/homework use; if you ever need proper exams, move grading into a Postgres function.
- Supabase free tier: 500 MB database, 1 GB file storage, 50k monthly active users. Plenty for a small course; PDFs and images count against storage, videos are links so they cost nothing.
- Default upload limit per file is 50 MB (Supabase setting under Storage).
- Deleting a course/module cascades: content, quizzes, homework and all student progress for it are removed.
# courseroom
