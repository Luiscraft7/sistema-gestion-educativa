-- ========================================
-- SISTEMA EDUCATIVO - ESQUEMA COMPLETAMENTE LIMPIO
-- Versión: 3.0 - Sistema de Períodos Académicos Integrado
-- ========================================

-- Tabla de Escuelas
CREATE TABLE IF NOT EXISTS schools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABLA DE PERÍODOS ACADÉMICOS
-- ========================================

CREATE TABLE IF NOT EXISTS academic_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    period_type TEXT NOT NULL DEFAULT 'semester' CHECK (period_type IN ('semester', 'trimester')),
    period_number INTEGER NOT NULL CHECK (period_number BETWEEN 1 AND 3),
    name TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    is_active INTEGER DEFAULT 0,
    is_current INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(year, period_type, period_number)
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_academic_periods_active ON academic_periods(is_active);
CREATE INDEX IF NOT EXISTS idx_academic_periods_current ON academic_periods(is_current);
CREATE INDEX IF NOT EXISTS idx_academic_periods_year ON academic_periods(year);

-- ========================================
-- TABLA DE PROFESORES/USUARIOS
-- ========================================

CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    cedula TEXT UNIQUE NOT NULL,
    school_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    -- Datos opcionales
    teacher_type TEXT,
    specialized_type TEXT,
    school_code TEXT,
    circuit_code TEXT,
    regional TEXT,
    -- Control administrativo
    is_active INTEGER DEFAULT 0,
    is_paid INTEGER DEFAULT 0,
    payment_date DATETIME,
    registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    activation_date DATETIME,
    last_login DATETIME,
    -- Metadatos
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_teachers_email ON teachers(email);
CREATE INDEX IF NOT EXISTS idx_teachers_cedula ON teachers(cedula);
CREATE INDEX IF NOT EXISTS idx_teachers_active ON teachers(is_active);
CREATE INDEX IF NOT EXISTS idx_teachers_school ON teachers(school_name);

-- ========================================
-- TABLAS BÁSICAS DEL SISTEMA
-- ========================================

-- Tabla de Materias del Sistema (básicas)
CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    grade_level TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id)
);

-- Tabla de Grados
CREATE TABLE IF NOT EXISTS grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    usage INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Materias Personalizadas
CREATE TABLE IF NOT EXISTS custom_subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    usage INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de relación Grados-Materias [CON PERÍODO ACADÉMICO]
CREATE TABLE IF NOT EXISTS grade_subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_period_id INTEGER DEFAULT 1,
    grade_name TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    teacher_name TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id),
    UNIQUE(academic_period_id, grade_name, subject_name)
);

-- ========================================
-- TABLA DE ESTUDIANTES [CON PERÍODO ACADÉMICO]
-- ========================================

CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_period_id INTEGER DEFAULT 1,
    school_id INTEGER DEFAULT 1,
    cedula TEXT,
    first_surname TEXT NOT NULL,
    second_surname TEXT,
    first_name TEXT NOT NULL,
    student_id TEXT,
    email TEXT,
    phone TEXT,
    grade_level TEXT,
    subject_area TEXT,
    section TEXT,
    birth_date DATE,
    address TEXT,
    parent_name TEXT,
    parent_phone TEXT,
    parent_email TEXT,
    notes TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id),
    FOREIGN KEY (school_id) REFERENCES schools(id),
    UNIQUE(academic_period_id, cedula),
    UNIQUE(academic_period_id, student_id)
);

-- ========================================
-- MÓDULO DE EVALUACIONES [CON PERÍODO ACADÉMICO]
-- ========================================

-- Tabla de Evaluaciones (assignments) [CON PERÍODO ACADÉMICO]
CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_period_id INTEGER DEFAULT 1,
    subject_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    max_points REAL DEFAULT 100,
    percentage REAL DEFAULT 0,
    grade_level TEXT NOT NULL,
    subject_area TEXT NOT NULL,
    teacher_name TEXT,
    type TEXT DEFAULT 'tarea' CHECK (type IN ('tarea', 'examen', 'proyecto', 'quiz')),
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id),
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

-- Tabla de Calificaciones de Evaluaciones [CON PERÍODO ACADÉMICO]
CREATE TABLE IF NOT EXISTS assignment_grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_period_id INTEGER DEFAULT 1,
    assignment_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    points_earned REAL DEFAULT 0,
    grade REAL DEFAULT 0,
    percentage REAL DEFAULT 0,
    submitted_at DATETIME,
    is_submitted INTEGER DEFAULT 0,
    is_late INTEGER DEFAULT 0,
    notes TEXT,
    feedback TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id),
    FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE(academic_period_id, assignment_id, student_id)
);

-- ========================================
-- MÓDULO DE COTIDIANO [CON PERÍODO ACADÉMICO]
-- ========================================

-- Tabla de Calificaciones Diarias (Cotidiano) [CON PERÍODO ACADÉMICO]
CREATE TABLE IF NOT EXISTS daily_grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_period_id INTEGER DEFAULT 1,
    student_id INTEGER NOT NULL,
    subject_id INTEGER,
    date DATE NOT NULL,
    participation REAL,
    behavior REAL,
    homework REAL,
    notes TEXT,
    grade_level TEXT,
    subject_area TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

-- ========================================
-- MÓDULO DE EXÁMENES [CON PERÍODO ACADÉMICO]
-- ========================================

-- Tabla de Exámenes [CON PERÍODO ACADÉMICO]
CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_period_id INTEGER DEFAULT 1,
    subject_id INTEGER,
    title TEXT NOT NULL,
    exam_date DATE,
    max_points REAL DEFAULT 100,
    percentage REAL DEFAULT 0,
    exam_type TEXT DEFAULT 'regular' CHECK (exam_type IN ('regular', 'parcial', 'final', 'extraordinario')),
    grade_level TEXT NOT NULL,
    subject_area TEXT NOT NULL,
    teacher_name TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id),
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

-- Tabla de Calificaciones de Exámenes [CON PERÍODO ACADÉMICO]
CREATE TABLE IF NOT EXISTS exam_grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_period_id INTEGER DEFAULT 1,
    exam_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    points_earned REAL DEFAULT 0,
    grade REAL DEFAULT 0,
    percentage REAL DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id),
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE(academic_period_id, exam_id, student_id)
);

-- ========================================
-- MÓDULO DE ASISTENCIA [CON PERÍODO ACADÉMICO]
-- ========================================

-- Tabla de Asistencia [CON PERÍODO ACADÉMICO]
CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_period_id INTEGER DEFAULT 1,
    student_id INTEGER NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent_justified', 'absent_unjustified', 'late_justified', 'late_unjustified')),
    arrival_time TIME,
    justification TEXT,
    notes TEXT,
    lesson_number INTEGER DEFAULT 1,
    grade_level TEXT NOT NULL,
    subject_area TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Tabla de Configuración de Lecciones [CON PERÍODO ACADÉMICO]
CREATE TABLE IF NOT EXISTS lesson_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_period_id INTEGER DEFAULT 1,
    grade_level TEXT NOT NULL,
    subject_area TEXT NOT NULL,
    lessons_per_week INTEGER DEFAULT 5,
    total_weeks INTEGER DEFAULT 40,
    total_lessons INTEGER DEFAULT 200,
    teacher_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id),
    UNIQUE(academic_period_id, grade_level, subject_area)
);

-- Tabla de Períodos de Asistencia [CON PERÍODO ACADÉMICO]
CREATE TABLE IF NOT EXISTS attendance_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_period_id INTEGER DEFAULT 1,
    grade_level TEXT NOT NULL,
    subject_area TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_lessons INTEGER NOT NULL,
    period_name TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id)
);

-- ========================================
-- MÓDULO DE COTIDIANO AVANZADO [CON PERÍODO ACADÉMICO]
-- ========================================

-- Tabla de Indicadores de Cotidiano
CREATE TABLE IF NOT EXISTS daily_indicators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grade_level TEXT NOT NULL,
    subject_area TEXT NOT NULL,
    indicator_name TEXT NOT NULL,
    parent_indicator_id INTEGER NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_indicator_id) REFERENCES daily_indicators(id) ON DELETE CASCADE
);

-- Tabla de Evaluaciones Cotidianas [CON PERÍODO ACADÉMICO]
CREATE TABLE IF NOT EXISTS daily_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_period_id INTEGER DEFAULT 1,
    student_id INTEGER NOT NULL,
    grade_level TEXT NOT NULL,
    subject_area TEXT NOT NULL,
    evaluation_date DATE NOT NULL,
    total_points INTEGER DEFAULT 0,
    final_grade REAL DEFAULT 0,
    grade_weight INTEGER DEFAULT 100,
    teacher_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE(academic_period_id, student_id, grade_level, subject_area, evaluation_date)
);

-- Tabla de Calificaciones por Indicador
CREATE TABLE IF NOT EXISTS daily_indicator_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    daily_evaluation_id INTEGER NOT NULL,
    indicator_id INTEGER NOT NULL,
    score INTEGER DEFAULT 0 CHECK (score IN (0, 1, 2, 3)),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (daily_evaluation_id) REFERENCES daily_evaluations(id) ON DELETE CASCADE,
    FOREIGN KEY (indicator_id) REFERENCES daily_indicators(id) ON DELETE CASCADE,
    UNIQUE(daily_evaluation_id, indicator_id)
);

-- Tabla para configurar escala máxima de notas por grado/materia
CREATE TABLE IF NOT EXISTS grade_scale_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grade_level TEXT NOT NULL,
    subject_area TEXT NOT NULL,
    max_scale REAL DEFAULT 5.0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(grade_level, subject_area)
);

-- ========================================
-- TABLAS PARA FUNCIONALIDAD ADMIN
-- ========================================

-- Tabla para tracking de sesiones activas
CREATE TABLE IF NOT EXISTS active_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

-- Tabla para log de actividad administrativa
CREATE TABLE IF NOT EXISTS admin_activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_user TEXT NOT NULL,
    action_type TEXT NOT NULL,
    action_description TEXT,
    target_teacher_id INTEGER,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (target_teacher_id) REFERENCES teachers(id)
);

-- Tabla de Administrador Único
CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    is_super_admin INTEGER DEFAULT 1,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- ÍNDICES OPTIMIZADOS PARA PERÍODOS ACADÉMICOS
-- ========================================

-- Índices para Evaluaciones
CREATE INDEX IF NOT EXISTS idx_assignments_period_grade_subject ON assignments(academic_period_id, grade_level, subject_area);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_assignments_active ON assignments(is_active);
CREATE INDEX IF NOT EXISTS idx_assignment_grades_period_assignment ON assignment_grades(academic_period_id, assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_grades_period_student ON assignment_grades(academic_period_id, student_id);

-- Índices para Cotidiano
CREATE INDEX IF NOT EXISTS idx_daily_grades_period_student_date ON daily_grades(academic_period_id, student_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_grades_period_grade_subject ON daily_grades(academic_period_id, grade_level, subject_area);

-- Índices para Exámenes
CREATE INDEX IF NOT EXISTS idx_exams_period_grade_subject ON exams(academic_period_id, grade_level, subject_area);
CREATE INDEX IF NOT EXISTS idx_exam_grades_period_exam ON exam_grades(academic_period_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_grades_period_student ON exam_grades(academic_period_id, student_id);

-- Índices para Asistencia
CREATE INDEX IF NOT EXISTS idx_attendance_period_student_date ON attendance(academic_period_id, student_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_period_date_grade ON attendance(academic_period_id, date, grade_level, subject_area);
CREATE INDEX IF NOT EXISTS idx_lesson_config_period_grade_subject ON lesson_config(academic_period_id, grade_level, subject_area);

-- Índices para Cotidiano Avanzado
CREATE INDEX IF NOT EXISTS idx_daily_indicators_grade_subject ON daily_indicators(grade_level, subject_area);
CREATE INDEX IF NOT EXISTS idx_daily_evaluations_period_student_date ON daily_evaluations(academic_period_id, student_id, evaluation_date);
CREATE INDEX IF NOT EXISTS idx_daily_evaluations_period_grade_subject_date ON daily_evaluations(academic_period_id, grade_level, subject_area, evaluation_date);
CREATE INDEX IF NOT EXISTS idx_daily_indicator_scores_evaluation ON daily_indicator_scores(daily_evaluation_id);

-- Índices para Sesiones y Admin
CREATE INDEX IF NOT EXISTS idx_active_sessions_teacher ON active_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_token ON active_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_active_sessions_activity ON active_sessions(last_activity);
CREATE INDEX IF NOT EXISTS idx_admin_log_date ON admin_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_log_admin ON admin_activity_log(admin_user);

-- Índices para Estudiantes
CREATE INDEX IF NOT EXISTS idx_students_period_grade_subject ON students(academic_period_id, grade_level, subject_area);
CREATE INDEX IF NOT EXISTS idx_students_period_school ON students(academic_period_id, school_id);

-- ========================================
-- DATOS INICIALES ESENCIALES
-- ========================================

-- Insertar períodos iniciales para 2025
INSERT OR IGNORE INTO academic_periods (year, period_type, period_number, name, is_active, is_current) VALUES 
(2025, 'semester', 1, '2025 - Primer Semestre', 1, 1),
(2025, 'semester', 2, '2025 - Segundo Semestre', 1, 0);

-- Escuela de ejemplo (necesaria para funcionamiento)
INSERT OR IGNORE INTO schools (id, name, address, phone, email) 
VALUES (1, 'Mi Escuela', 'Dirección de la Escuela', '0000-0000', 'contacto@miescuela.cr');

-- Insertar administrador único
INSERT OR IGNORE INTO admin_users (username, email, password, is_super_admin) 
VALUES ('admin', 'Luiscraft', 'Naturarte0603', 1);