-- ========================================
-- SISTEMA EDUCATIVO - ESQUEMA COMPLETAMENTE LIMPIO
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
-- TABLAS DE EVALUACIONES
-- ========================================

-- Tabla de Cotidiano
CREATE TABLE IF NOT EXISTS daily_grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    subject_id INTEGER,
    date DATE,
    participation REAL,
    behavior REAL,
    homework REAL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

-- Tabla de Tareas (CORREGIDA)
CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    max_points REAL DEFAULT 100,
    percentage REAL DEFAULT 10,
    grade_level TEXT NOT NULL,
    subject_area TEXT NOT NULL,
    teacher_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Calificaciones de Tareas
CREATE TABLE IF NOT EXISTS assignment_grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER,
    student_id INTEGER,
    grade REAL,
    submitted_at DATETIME,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assignment_id) REFERENCES assignments(id),
    FOREIGN KEY (student_id) REFERENCES students(id)
);

-- Tabla de Exámenes
CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER,
    title TEXT NOT NULL,
    exam_date DATE,
    max_points REAL DEFAULT 100,
    exam_type TEXT DEFAULT 'regular',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

-- Tabla de Calificaciones de Exámenes
CREATE TABLE IF NOT EXISTS exam_grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER,
    student_id INTEGER,
    grade REAL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams(id),
    FOREIGN KEY (student_id) REFERENCES students(id)
);

-- ========================================
-- TABLA DE ASISTENCIA
-- ========================================

CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent_justified', 'absent_unjustified', 'late_justified', 'late_unjustified')),
    arrival_time TIME,
    justification TEXT,
    notes TEXT,
    lesson_number INTEGER DEFAULT 1,
    grade_level TEXT,
    subject_area TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id)
);

-- Tabla de Configuración de Lecciones
CREATE TABLE IF NOT EXISTS lesson_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grade_level TEXT NOT NULL,
    subject_area TEXT,
    lessons_per_week INTEGER DEFAULT 5,
    total_weeks INTEGER DEFAULT 40,
    total_lessons INTEGER DEFAULT 200,
    teacher_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Períodos de Asistencia
CREATE TABLE IF NOT EXISTS attendance_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grade_level TEXT NOT NULL,
    subject_area TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_lessons INTEGER NOT NULL,
    period_name TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- SOLO DATOS MÍNIMOS ESENCIALES
-- ========================================

-- Escuela de ejemplo (necesaria para funcionamiento)
INSERT OR IGNORE INTO schools (id, name, address, phone, email) 
VALUES (1, 'Mi Escuela', 'Dirección', '0000-0000', 'contacto@miescuela.cr');

-- ✅ SISTEMA COMPLETAMENTE LIMPIO
-- ✅ Sin grados precargados
-- ✅ Sin materias precargadas  
-- ✅ Solo estructura de tablas
-- ✅ Usuario agrega sus propios datos