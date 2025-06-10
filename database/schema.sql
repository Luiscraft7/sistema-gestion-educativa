-- ========================================
-- SISTEMA EDUCATIVO - ESQUEMA COMPLETAMENTE LIMPIO
-- Versión: 2.0 - Optimizado para Evaluaciones + Admin Mejorado
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

-- ========================================
-- TABLAS PARA GESTIÓN AVANZADA
-- ========================================

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

-- Tabla de relación Grados-Materias
CREATE TABLE IF NOT EXISTS grade_subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grade_name TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    teacher_name TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(grade_name, subject_name)
);

-- ========================================
-- TABLA DE ESTUDIANTES
-- ========================================

CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER DEFAULT 1,
    cedula TEXT UNIQUE,
    first_surname TEXT NOT NULL,
    second_surname TEXT,
    first_name TEXT NOT NULL,
    student_id TEXT UNIQUE,
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
    FOREIGN KEY (school_id) REFERENCES schools(id)
);

-- ========================================
-- MÓDULO DE EVALUACIONES (OPTIMIZADO)
-- ========================================

-- Tabla de Evaluaciones (assignments - optimizada)
CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

-- Tabla de Calificaciones de Evaluaciones (assignment_grades - optimizada)
CREATE TABLE IF NOT EXISTS assignment_grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE(assignment_id, student_id)
);

-- Índices para Evaluaciones (mejorar rendimiento)
CREATE INDEX IF NOT EXISTS idx_assignments_grade_subject ON assignments(grade_level, subject_area);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_assignments_active ON assignments(is_active);
CREATE INDEX IF NOT EXISTS idx_assignments_type ON assignments(type);
CREATE INDEX IF NOT EXISTS idx_assignment_grades_assignment ON assignment_grades(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_grades_student ON assignment_grades(student_id);
CREATE INDEX IF NOT EXISTS idx_assignment_grades_submitted ON assignment_grades(is_submitted);

-- ========================================
-- MÓDULO DE COTIDIANO
-- ========================================

-- Tabla de Calificaciones Diarias (Cotidiano)
CREATE TABLE IF NOT EXISTS daily_grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

-- Índices para Cotidiano
CREATE INDEX IF NOT EXISTS idx_daily_grades_student_date ON daily_grades(student_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_grades_grade_subject ON daily_grades(grade_level, subject_area);

-- ========================================
-- MÓDULO DE EXÁMENES
-- ========================================

-- Tabla de Exámenes
CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

-- Tabla de Calificaciones de Exámenes
CREATE TABLE IF NOT EXISTS exam_grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    points_earned REAL DEFAULT 0,
    grade REAL DEFAULT 0,
    percentage REAL DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE(exam_id, student_id)
);

-- Índices para Exámenes
CREATE INDEX IF NOT EXISTS idx_exams_grade_subject ON exams(grade_level, subject_area);
CREATE INDEX IF NOT EXISTS idx_exams_date ON exams(exam_date);
CREATE INDEX IF NOT EXISTS idx_exam_grades_exam ON exam_grades(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_grades_student ON exam_grades(student_id);

-- ========================================
-- MÓDULO DE ASISTENCIA
-- ========================================

-- Tabla de Asistencia
CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Tabla de Configuración de Lecciones
CREATE TABLE IF NOT EXISTS lesson_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grade_level TEXT NOT NULL,
    subject_area TEXT NOT NULL,
    lessons_per_week INTEGER DEFAULT 5,
    total_weeks INTEGER DEFAULT 40,
    total_lessons INTEGER DEFAULT 200,
    teacher_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(grade_level, subject_area)
);

-- Tabla de Períodos de Asistencia
CREATE TABLE IF NOT EXISTS attendance_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grade_level TEXT NOT NULL,
    subject_area TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_lessons INTEGER NOT NULL,
    period_name TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para Asistencia
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date_grade ON attendance(date, grade_level, subject_area);
CREATE INDEX IF NOT EXISTS idx_lesson_config_grade_subject ON lesson_config(grade_level, subject_area);

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
-- MÓDULO DE COTIDIANO AVANZADO
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

-- Tabla de Evaluaciones Cotidianas
CREATE TABLE IF NOT EXISTS daily_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE(student_id, grade_level, subject_area, evaluation_date)
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

-- Índices para Cotidiano Avanzado
CREATE INDEX IF NOT EXISTS idx_daily_indicators_grade_subject ON daily_indicators(grade_level, subject_area);
CREATE INDEX IF NOT EXISTS idx_daily_indicators_parent ON daily_indicators(parent_indicator_id);
CREATE INDEX IF NOT EXISTS idx_daily_evaluations_student_date ON daily_evaluations(student_id, evaluation_date);
CREATE INDEX IF NOT EXISTS idx_daily_evaluations_grade_subject_date ON daily_evaluations(grade_level, subject_area, evaluation_date);
CREATE INDEX IF NOT EXISTS idx_daily_indicator_scores_evaluation ON daily_indicator_scores(daily_evaluation_id);
CREATE INDEX IF NOT EXISTS idx_daily_indicator_scores_indicator ON daily_indicator_scores(indicator_id);

-- ========================================
-- NUEVAS TABLAS PARA FUNCIONALIDAD ADMIN
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

-- Índices para sesiones
CREATE INDEX IF NOT EXISTS idx_active_sessions_teacher ON active_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_token ON active_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_active_sessions_activity ON active_sessions(last_activity);

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

-- Índices para log administrativo
CREATE INDEX IF NOT EXISTS idx_admin_log_date ON admin_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_log_admin ON admin_activity_log(admin_user);

-- ========================================
-- DATOS MÍNIMOS ESENCIALES
-- ========================================

-- Escuela de ejemplo (necesaria para funcionamiento)
INSERT OR IGNORE INTO schools (id, name, address, phone, email) 
VALUES (1, 'Mi Escuela', 'Dirección de la Escuela', '0000-0000', 'contacto@miescuela.cr');

-- ========================================
-- TABLA DE ADMINISTRADOR ÚNICO
-- ========================================

CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    is_super_admin INTEGER DEFAULT 1,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insertar administrador único
INSERT OR IGNORE INTO admin_users (username, email, password, is_super_admin) 
VALUES ('admin', 'Luiscraft', 'Naturarte0603', 1);

