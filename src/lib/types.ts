export type Role = 'admin' | 'student'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: Role
  created_at: string
}

export interface Course {
  id: string
  title: string
  description: string | null
  published: boolean
  created_at: string
}

export interface Module {
  id: string
  course_id: string
  title: string
  description: string | null
  position: number
  published: boolean
  created_at: string
}

export type ContentType = 'text' | 'image' | 'pdf' | 'video'

export interface ContentItem {
  id: string
  module_id: string
  type: ContentType
  title: string
  body: string | null // text content or video URL
  file_path: string | null // storage path in "content" bucket
  position: number
}

export interface Quiz {
  id: string
  module_id: string
  title: string
  pass_score: number | null
}

export interface QuizQuestion {
  id: string
  quiz_id: string
  question: string
  options: string[]
  correct_index: number
  position: number
}

export interface Homework {
  id: string
  module_id: string
  title: string
  instructions: string | null
  allow_file: boolean
  allow_text: boolean
}

export interface ModuleView {
  user_id: string
  module_id: string
  viewed_at: string
}

export interface QuizAttempt {
  id: string
  user_id: string
  quiz_id: string
  score: number
  total: number
  answers: number[]
  created_at: string
}

export interface HomeworkSubmission {
  id: string
  user_id: string
  homework_id: string
  text_answer: string | null
  file_path: string | null
  file_name: string | null
  submitted_at: string
}
