-- ========================================
-- SISTEMA EDUCATIVO - ESQUEMA MULTI-ESCUELA COMPLETO
-- Versión: 5.0 - Sistema de Períodos Académicos + Múltiples Escuelas por Profesor
-- ========================================

-- ========================================
-- TABLA DE ESCUELAS (EXPANDIDA)
-- ========================================
CREATE TABLE IF NOT EXISTS schools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    school_code TEXT UNIQUE,
    director_name TEXT,
    region TEXT,
    circuit TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
-- TABLA DE PROFESORES/USUARIOS (MODIFICADA PARA MULTI-ESCUELA)
-- ========================================
CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    cedula TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    -- Datos opcionales
    teacher_type TEXT,
    specialized_type TEXT,
    regional TEXT,
    -- Control administrativo
    is_active INTEGER DEFAULT 0,
    is_paid INTEGER DEFAULT 0,
    payment_date DATETIME,
    registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    activation_date DATETIME,
    last_login DATETIME,
    has_temporary_password INTEGER DEFAULT 0,
    -- Metadatos
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABLA DE RELACIÓN PROFESOR-ESCUELA (NUEVA - MÚLTIPLES ESCUELAS POR PROFESOR)
-- ========================================
CREATE TABLE IF NOT EXISTS teacher_schools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1,
    is_primary_school INTEGER DEFAULT 0, -- Escuela principal del profesor
    assigned_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    UNIQUE(teacher_id, school_id)
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_teachers_email ON teachers(email);
CREATE INDEX IF NOT EXISTS idx_teachers_cedula ON teachers(cedula);
CREATE INDEX IF NOT EXISTS idx_teachers_active ON teachers(is_active);
CREATE INDEX IF NOT EXISTS idx_teacher_schools_teacher ON teacher_schools(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_schools_school ON teacher_schools(school_id);
CREATE INDEX IF NOT EXISTS idx_teacher_schools_active ON teacher_schools(is_active);

-- Tabla de Sesiones Activas de Profesores
CREATE TABLE IF NOT EXISTS active_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    school_id INTEGER, -- Nueva: Para saber en qué escuela está trabajando
    session_token TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL
);

-- Tabla para log de actividad administrativa
CREATE TABLE IF NOT EXISTS admin_activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_user TEXT NOT NULL,
    action_type TEXT NOT NULL,
    action_description TEXT,
    target_teacher_id INTEGER,
    target_school_id INTEGER,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (target_teacher_id) REFERENCES teachers(id),
    FOREIGN KEY (target_school_id) REFERENCES schools(id)
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
-- TABLAS BÁSICAS DEL SISTEMA (MULTI-ESCUELA)
-- ========================================

-- Tabla de Materias del Sistema (básicas) - CON ESCUELA
CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    grade_level TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    UNIQUE(school_id, name, grade_level)
);

-- Tabla de Grados - CON ESCUELA
CREATE TABLE IF NOT EXISTS grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL, -- ✅ REQUERIDO: Debe especificar la escuela
    name TEXT NOT NULL,
    description TEXT,
    usage INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    UNIQUE(teacher_id, school_id, name)
);

-- Tabla de Materias Personalizadas - CON ESCUELA
CREATE TABLE IF NOT EXISTS custom_subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL, -- ✅ NUEVO: Separación por escuela
    name TEXT NOT NULL,
    description TEXT,
    usage INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    UNIQUE(teacher_id, school_id, name)
);

-- Tabla de relación Grados-Materias [CON PERÍODO ACADÉMICO + ESCUELA]
CREATE TABLE IF NOT EXISTS grade_subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_period_id INTEGER DEFAULT 1,
    teacher_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL, -- ✅ NUEVO: Separación por escuela
    grade_name TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    teacher_name TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    UNIQUE(academic_period_id, teacher_id, school_id, grade_name, subject_name)
);

-- ========================================
-- TABLA DE ESTUDIANTES [CON PERÍODO ACADÉMICO + PROFESOR + ESCUELA]
-- ========================================
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_period_id INTEGER DEFAULT 1,
    teacher_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL, -- ✅ REQUERIDO: Debe especificar la escuela
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
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    -- ✅ CÉDULA ÚNICA POR PERÍODO, PROFESOR Y ESCUELA
    UNIQUE(academic_period_id, teacher_id, school_id, cedula)
);

-- ========================================
-- MÓDULO DE COTIDIANO [CON PERÍODO ACADÉMICO + PROFESOR + ESCUELA]
-- ========================================

-- Tabla de Cotidiano [CON PERÍODO ACADÉMICO + PROFESOR + ESCUELA]
CREATE TABLE IF NOT EXISTS daily_grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_period_id INTEGER DEFAULT 1,
    teacher_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL, -- ✅ NUEVO: Separación por escuela
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
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

-- ========================================
-- MÓDULO DE EVALUACIONES [CON PERÍODO ACADÉMICO + PROFESOR + ESCUELA]
-- ========================================

-- Tabla de Evaluaciones (tareas, exámenes, proyectos, quiz) [CON PERÍODO ACADÉMICO + PROFESOR + ESCUELA]
CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_period_id INTEGER DEFAULT 1,
    teacher_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL, -- ✅ NUEVO: Separación por escuela
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
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

-- Tabla de Calificaciones de Evaluaciones [CON PERÍODO ACADÉMICO + PROFESOR + ESCUELA]
CREATE TABLE IF NOT EXISTS assignment_grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_period_id INTEGER DEFAULT 1,
    teacher_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL, -- ✅ NUEVO: Separación por escuela
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
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE(academic_period_id, teacher_id, school_id, assignment_id, student_id)
);

-- ========================================
-- MÓDULO DE ASISTENCIA [CON PERÍODO ACADÉMICO + PROFESOR + ESCUELA]
-- ========================================

-- Tabla de Asistencia [CON PERÍODO ACADÉMICO + PROFESOR + ESCUELA]
CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_period_id INTEGER DEFAULT 1,
    teacher_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL, -- ✅ NUEVO: Separación por escuela
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
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Tabla de Configuración de Lecciones [CON PERÍODO ACADÉMICO + PROFESOR + ESCUELA]
CREATE TABLE IF NOT EXISTS lesson_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_period_id INTEGER DEFAULT 1,
    teacher_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL, -- ✅ NUEVO: Separación por escuela
    grade_level TEXT NOT NULL,
    subject_area TEXT NOT NULL,
    lessons_per_week INTEGER DEFAULT 5,
    total_weeks INTEGER DEFAULT 40,
    total_lessons INTEGER DEFAULT 200,
    teacher_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    UNIQUE(academic_period_id, teacher_id, school_id, grade_level, subject_area)
);

-- ========================================
-- TABLA DE CONFIGURACIÓN DE ESCALAS DE CALIFICACIÓN [MULTI-ESCUELA]
-- ========================================

-- Tabla de Configuración de Escalas de Calificación [CON PERÍODO ACADÉMICO + PROFESOR + ESCUELA]
CREATE TABLE IF NOT EXISTS grade_scale_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_period_id INTEGER DEFAULT 1,
    teacher_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL, -- ✅ NUEVO: Separación por escuela
    grade_level TEXT NOT NULL,
    subject_area TEXT NOT NULL,
    max_scale REAL DEFAULT 5.0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    UNIQUE(academic_period_id, teacher_id, school_id, grade_level, subject_area)
);

-- Tabla de Configuración de Pesos SEA
CREATE TABLE IF NOT EXISTS sea_weight_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_period_id INTEGER DEFAULT 1,
    teacher_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL,
    cotidiano_weight REAL DEFAULT 65,
    attendance_weight REAL DEFAULT 10,
    evaluations_weight REAL DEFAULT 25,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    UNIQUE(academic_period_id, teacher_id, school_id)
);

-- Tabla de Períodos de Asistencia [CON PERÍODO ACADÉMICO + PROFESOR + ESCUELA]
CREATE TABLE IF NOT EXISTS attendance_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_period_id INTEGER DEFAULT 1,
    teacher_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL, -- ✅ NUEVO: Separación por escuela
    grade_level TEXT NOT NULL,
    subject_area TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_lessons INTEGER NOT NULL,
    period_name TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- ========================================
-- MÓDULO DE COTIDIANO AVANZADO [CON PERÍODO ACADÉMICO + PROFESOR + ESCUELA]
-- ========================================

-- Tabla de Indicadores de Cotidiano
CREATE TABLE IF NOT EXISTS daily_indicators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_period_id INTEGER DEFAULT 1,
    teacher_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL, -- ✅ NUEVO: Separación por escuela
    grade_level TEXT NOT NULL,
    subject_area TEXT NOT NULL,
    indicator_name TEXT NOT NULL,
    indicator_description TEXT,
    parent_indicator_id INTEGER,
    max_points REAL DEFAULT 10,
    weight REAL DEFAULT 1.0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_indicator_id) REFERENCES daily_indicators(id) ON DELETE SET NULL,
    UNIQUE(academic_period_id, teacher_id, school_id, grade_level, subject_area, indicator_name)
);

-- Tabla de Evaluaciones de Cotidiano
CREATE TABLE IF NOT EXISTS daily_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_period_id INTEGER DEFAULT 1,
    teacher_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL, -- ✅ NUEVO: Separación por escuela
    student_id INTEGER NOT NULL,
    grade_level TEXT NOT NULL,
    subject_area TEXT NOT NULL,
    evaluation_date DATE NOT NULL,
    total_score REAL DEFAULT 0,
    percentage REAL DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE(academic_period_id, teacher_id, school_id, student_id, evaluation_date, grade_level, subject_area)
);

-- Tabla de Puntuaciones de Indicadores
CREATE TABLE IF NOT EXISTS daily_indicator_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    daily_evaluation_id INTEGER NOT NULL,
    daily_indicator_id INTEGER NOT NULL,
    score REAL DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (daily_evaluation_id) REFERENCES daily_evaluations(id) ON DELETE CASCADE,
    FOREIGN KEY (daily_indicator_id) REFERENCES daily_indicators(id) ON DELETE CASCADE,
    UNIQUE(daily_evaluation_id, daily_indicator_id)
);

-- ========================================
-- ÍNDICES OPTIMIZADOS PARA MULTI-ESCUELA + PERÍODOS ACADÉMICOS + PROFESORES
-- ========================================

-- Índices para Escuelas
CREATE INDEX IF NOT EXISTS idx_schools_active ON schools(is_active);
CREATE INDEX IF NOT EXISTS idx_schools_code ON schools(school_code);

-- Índices para Materias
CREATE INDEX IF NOT EXISTS idx_subjects_school ON subjects(school_id);
CREATE INDEX IF NOT EXISTS idx_subjects_school_grade ON subjects(school_id, grade_level);

-- Índices para Estudiantes
CREATE INDEX IF NOT EXISTS idx_students_period_teacher_school ON students(academic_period_id, teacher_id, school_id);
CREATE INDEX IF NOT EXISTS idx_students_period_teacher_school_grade ON students(academic_period_id, teacher_id, school_id, grade_level);
CREATE INDEX IF NOT EXISTS idx_students_period_teacher_school_status ON students(academic_period_id, teacher_id, school_id, status);
CREATE INDEX IF NOT EXISTS idx_students_teacher_school_cedula ON students(teacher_id, school_id, cedula);

-- Índices para Evaluaciones
CREATE INDEX IF NOT EXISTS idx_assignments_period_teacher_school ON assignments(academic_period_id, teacher_id, school_id);
CREATE INDEX IF NOT EXISTS idx_assignments_period_teacher_school_grade_subject ON assignments(academic_period_id, teacher_id, school_id, grade_level, subject_area);
CREATE INDEX IF NOT EXISTS idx_assignments_period_teacher_school_type ON assignments(academic_period_id, teacher_id, school_id, type);
CREATE INDEX IF NOT EXISTS idx_assignment_grades_period_teacher_school ON assignment_grades(academic_period_id, teacher_id, school_id);
CREATE INDEX IF NOT EXISTS idx_assignment_grades_period_teacher_school_student ON assignment_grades(academic_period_id, teacher_id, school_id, student_id);

-- Índices para Cotidiano
CREATE INDEX IF NOT EXISTS idx_daily_grades_period_teacher_school ON daily_grades(academic_period_id, teacher_id, school_id);
CREATE INDEX IF NOT EXISTS idx_daily_grades_period_teacher_school_student_date ON daily_grades(academic_period_id, teacher_id, school_id, student_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_grades_period_teacher_school_grade_subject ON daily_grades(academic_period_id, teacher_id, school_id, grade_level, subject_area);

-- Índices para Asistencia
CREATE INDEX IF NOT EXISTS idx_attendance_period_teacher_school ON attendance(academic_period_id, teacher_id, school_id);
CREATE INDEX IF NOT EXISTS idx_attendance_period_teacher_school_student_date ON attendance(academic_period_id, teacher_id, school_id, student_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_period_teacher_school_date_grade ON attendance(academic_period_id, teacher_id, school_id, date, grade_level, subject_area);
CREATE INDEX IF NOT EXISTS idx_lesson_config_period_teacher_school_grade_subject ON lesson_config(academic_period_id, teacher_id, school_id, grade_level, subject_area);

-- Índice para Configuración de Escalas
CREATE INDEX IF NOT EXISTS idx_grade_scale_period_teacher_school_grade_subject ON grade_scale_config(academic_period_id, teacher_id, school_id, grade_level, subject_area);
CREATE INDEX IF NOT EXISTS idx_sea_weight_period_teacher_school ON sea_weight_config(academic_period_id, teacher_id, school_id);

-- Índices para Cotidiano Avanzado
CREATE INDEX IF NOT EXISTS idx_daily_indicators_period_teacher_grade_subject ON daily_indicators(academic_period_id, teacher_id, grade_level, subject_area);
CREATE INDEX IF NOT EXISTS idx_daily_indicators_parent ON daily_indicators(parent_indicator_id);
CREATE INDEX IF NOT EXISTS idx_daily_evaluations_period_teacher_school_student_date ON daily_evaluations(academic_period_id, teacher_id, school_id, student_id, evaluation_date);
CREATE INDEX IF NOT EXISTS idx_daily_evaluations_period_teacher_school_grade_subject_date ON daily_evaluations(academic_period_id, teacher_id, school_id, grade_level, subject_area, evaluation_date);
CREATE INDEX IF NOT EXISTS idx_daily_indicator_scores_evaluation ON daily_indicator_scores(daily_evaluation_id);

-- Índices para Grados y Asignación de Materias
CREATE INDEX IF NOT EXISTS idx_grades_teacher_school ON grades(teacher_id, school_id);
CREATE INDEX IF NOT EXISTS idx_grade_subjects_teacher_school ON grade_subjects(teacher_id, school_id);
CREATE INDEX IF NOT EXISTS idx_custom_subjects_teacher_school ON custom_subjects(teacher_id, school_id);

-- Índices para Sesiones y Admin
CREATE INDEX IF NOT EXISTS idx_active_sessions_teacher_school ON active_sessions(teacher_id, school_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_token ON active_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_active_sessions_activity ON active_sessions(last_activity);
CREATE INDEX IF NOT EXISTS idx_admin_log_date ON admin_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_log_admin ON admin_activity_log(admin_user);

-- ========================================
-- DATOS INICIALES ESENCIALES (SOLO LO MÍNIMO)
-- ========================================

-- Insertar períodos iniciales para 2025
INSERT OR IGNORE INTO academic_periods (year, period_type, period_number, name, is_active, is_current) VALUES 
(2025, 'semester', 1, '2025 - Primer Semestre', 1, 1),
(2025, 'semester', 2, '2025 - Segundo Semestre', 1, 0);

-- ✅ Tabla de escuelas vacía - El usuario configurará sus escuelas

-- Insertar administrador único
-- El administrador se creará al iniciar la aplicación usando variables de entorno

-- ========================================
-- TRIGGERS PARA MANTENER CONSISTENCIA (OPCIONAL)
-- ========================================

-- Trigger para asegurar que el teacher_id y school_id estén relacionados en teacher_schools
CREATE TRIGGER IF NOT EXISTS check_teacher_school_relation
BEFORE INSERT ON students
FOR EACH ROW
WHEN NOT EXISTS (
    SELECT 1 FROM teacher_schools 
    WHERE teacher_id = NEW.teacher_id 
    AND school_id = NEW.school_id 
    AND is_active = 1
)
BEGIN
    SELECT RAISE(ABORT, 'Teacher is not assigned to this school');
END;

-- Tabla de solicitudes de cambio de contraseña
CREATE TABLE IF NOT EXISTS password_change_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    teacher_email TEXT NOT NULL,
    teacher_name TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    processed_by TEXT,
    ip_address TEXT,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);
