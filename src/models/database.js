const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
    constructor() {
        this.db = null;
        this.isInitialized = false;
    }

    // ========================================
    // INICIALIZACIÓN CON VERIFICACIÓN
    // ========================================
    async initialize() {
        if (this.isInitialized && this.db) {
            console.log('✅ Base de datos ya inicializada');
            return;
        }

        return new Promise((resolve, reject) => {
            try {
                // Crear directorio data si no existe
                const dataDir = path.join(__dirname, '../../data');
                if (!fs.existsSync(dataDir)) {
                    fs.mkdirSync(dataDir, { recursive: true });
                    console.log('📁 Directorio data creado');
                }

                const dbPath = path.join(dataDir, 'sistema_educativo.db');
                console.log('🔗 Conectando a base de datos:', dbPath);
                
                this.db = new sqlite3.Database(dbPath, (err) => {
                    if (err) {
                        console.error('❌ Error conectando a SQLite:', err);
                        reject(err);
                    } else {
                        console.log('✅ Conectado a la base de datos SQLite');
                        this.createTables()
                            .then(() => this.applyMigrations())
                            .then(() => {
                                this.isInitialized = true;
                                resolve();
                            })
                            .catch(reject);
                    }
                });
            } catch (error) {
                console.error('❌ Error en initialize:', error);
                reject(error);
            }
        });
    }

  // ========================================
// FUNCIÓN createTables CORREGIDA
// ========================================

async createTables() {
    try {
        console.log('🔄 Verificando/creando tablas...');
        
        // ✅ VERIFICAR PRIMERO SI LAS TABLAS YA EXISTEN CON EL ESQUEMA CORRECTO
        const schemaCheck = await this.checkSchemaVersion();
        
        if (schemaCheck.isCorrect) {
            console.log('✅ Tablas ya existen con esquema correcto');
            return;
        }
        
        if (schemaCheck.needsMigration) {
            console.log('⚠️ Esquema antiguo detectado, necesita migración');
            await this.handleSchemaMigration();
            return;
        }
        
        // Solo crear tablas si no existen
        console.log('📝 Creando tablas con esquema multi-escuela...');
        
        const schema = this.getMultiSchoolSchema();
        
        return new Promise((resolve, reject) => {
            this.db.exec(schema, (err) => {
                if (err) {
                    console.error('❌ Error creando tablas:', err);
                    reject(err);
                } else {
                    console.log('✅ Tablas creadas/verificadas correctamente');
                    resolve();
                }
            });
        });
        
    } catch (error) {
        console.error('❌ Error en createTables:', error);
        throw error;
    }
}

// ========================================
// FUNCIÓN PARA VERIFICAR VERSIÓN DEL ESQUEMA
// ========================================

async checkSchemaVersion() {
    return new Promise((resolve) => {
        // Verificar si existe la tabla teacher_schools (indicador de esquema multi-escuela)
        this.db.get(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='teacher_schools'
        `, (err, result) => {
            if (err) {
                resolve({ isCorrect: false, needsMigration: false });
                return;
            }
            
            if (!result) {
                // No existe teacher_schools, verificar si hay tablas del esquema antiguo
                this.db.get(`
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name='teachers'
                `, (err, teachersTable) => {
                    if (teachersTable) {
                        resolve({ isCorrect: false, needsMigration: true });
                    } else {
                        resolve({ isCorrect: false, needsMigration: false });
                    }
                });
            } else {
                // Existe teacher_schools, verificar si students tiene school_id
                this.db.all(`PRAGMA table_info(students)`, (err, columns) => {
                    if (err) {
                        resolve({ isCorrect: false, needsMigration: true });
                        return;
                    }
                    
                    const hasSchoolId = columns && columns.some(col => col.name === 'school_id');
                    
                    if (hasSchoolId) {
                        resolve({ isCorrect: true, needsMigration: false });
                    } else {
                        resolve({ isCorrect: false, needsMigration: true });
                    }
                });
            }
        });
    });
}

// ========================================
// FUNCIÓN PARA MANEJAR MIGRACIÓN DE ESQUEMA
// ========================================

async handleSchemaMigration() {
    console.log('🔄 Iniciando migración automática de esquema...');
    
    return new Promise((resolve, reject) => {
        // En desarrollo, simplemente recrear la base de datos
        console.log('⚠️ Modo desarrollo: Recreando base de datos con nuevo esquema');
        console.log('💡 Los datos existentes se perderán (esto es normal en desarrollo)');
        
        // Obtener lista de todas las tablas
        this.db.all(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
        `, (err, tables) => {
            if (err) {
                reject(err);
                return;
            }
            
            // Eliminar todas las tablas existentes
            const dropPromises = tables.map(table => {
                return new Promise((res, rej) => {
                    this.db.run(`DROP TABLE IF EXISTS ${table.name}`, (err) => {
                        if (err) {
                            console.error(`❌ Error eliminando tabla ${table.name}:`, err);
                            rej(err);
                        } else {
                            console.log(`🗑️ Tabla ${table.name} eliminada`);
                            res();
                        }
                    });
                });
            });
            
            Promise.all(dropPromises)
                .then(() => {
                    console.log('✅ Todas las tablas antiguas eliminadas');
                    
                    // Crear nuevas tablas con esquema correcto
                    const schema = this.getMultiSchoolSchema();
                    
                    this.db.exec(schema, (err) => {
                        if (err) {
                            console.error('❌ Error creando nuevas tablas:', err);
                            reject(err);
                        } else {
                            console.log('✅ Nuevas tablas creadas con esquema multi-escuela');
                            resolve();
                        }
                    });
                })
                .catch(reject);
        });
    });
}

// ========================================
// FUNCIÓN PARA OBTENER ESQUEMA MULTI-ESCUELA
// ========================================

getMultiSchoolSchema() {
    // Leer el archivo schema.sql
    const fs = require('fs');
    const path = require('path');
    
    try {
        const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
        
        if (fs.existsSync(schemaPath)) {
            return fs.readFileSync(schemaPath, 'utf8');
        } else {
            // Fallback: esquema básico multi-escuela
            return this.getBasicMultiSchoolSchema();
        }
    } catch (error) {
        console.error('⚠️ Error leyendo schema.sql, usando esquema básico');
        return this.getBasicMultiSchoolSchema();
    }
}

getBasicMultiSchoolSchema() {
    return `
        -- Esquema básico multi-escuela
        CREATE TABLE IF NOT EXISTS schools (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            address TEXT,
            phone TEXT,
            email TEXT,
            school_code TEXT UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS teachers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            cedula TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            teacher_type TEXT,
            specialized_type TEXT,
            regional TEXT,
            is_active INTEGER DEFAULT 0,
            is_paid INTEGER DEFAULT 0,
            registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS teacher_schools (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id INTEGER NOT NULL,
            school_id INTEGER NOT NULL,
            is_active INTEGER DEFAULT 1,
            is_primary_school INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
            FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
            UNIQUE(teacher_id, school_id)
        );
        
        -- Insertar datos básicos
        INSERT OR IGNORE INTO admin_users (username, email, password, is_super_admin) 
        VALUES ('admin', 'Luiscraft', 'Naturarte0603', 1);
    `;
}

    async applyMigrations() {
        const tableInfo = (table) => new Promise((resolve, reject) => {
            this.db.all(`PRAGMA table_info(${table});`, (err, rows) => err ? reject(err) : resolve(rows));
        });

        const run = (sql) => new Promise((resolve, reject) => {
            this.db.run(sql, (err) => err ? reject(err) : resolve());
        });

        try {
            const gradeInfo = await tableInfo('grades');
            if (!gradeInfo.some(r => r.name === 'teacher_id')) {
                await run('ALTER TABLE grades ADD COLUMN teacher_id INTEGER DEFAULT 0');
                await run('CREATE INDEX IF NOT EXISTS idx_grades_teacher ON grades(teacher_id)');
            }

            const subjectInfo = await tableInfo('custom_subjects');
            if (!subjectInfo.some(r => r.name === 'teacher_id')) {
                await run('ALTER TABLE custom_subjects ADD COLUMN teacher_id INTEGER DEFAULT 0');
                await run('CREATE INDEX IF NOT EXISTS idx_custom_subjects_teacher ON custom_subjects(teacher_id)');
            }

            const subjectIndexes = await new Promise((resolve, reject) => {
                this.db.all('PRAGMA index_list(custom_subjects);', (err, rows) => err ? reject(err) : resolve(rows));
            });
            const hasTeacherNameIndex = subjectIndexes.some(i => i.name === 'idx_custom_subjects_teacher_name' && i.unique);
            const hasNameOnlyUnique = subjectIndexes.some(i => i.name === 'sqlite_autoindex_custom_subjects_1');

            if (hasNameOnlyUnique && !hasTeacherNameIndex) {
                await run('ALTER TABLE custom_subjects RENAME TO tmp_custom_subjects');
                await run(`CREATE TABLE custom_subjects (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    teacher_id INTEGER DEFAULT 0,
                    name TEXT NOT NULL,
                    description TEXT,
                    usage INTEGER DEFAULT 0,
                    priority INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
                    UNIQUE(teacher_id, name)
                )`);
                await run(`INSERT INTO custom_subjects (id, teacher_id, name, description, usage, priority, created_at)
                            SELECT id, teacher_id, name, description, usage, priority, created_at FROM tmp_custom_subjects`);
                await run('DROP TABLE tmp_custom_subjects');
                await run('CREATE INDEX IF NOT EXISTS idx_custom_subjects_teacher ON custom_subjects(teacher_id)');
            } else if (!hasTeacherNameIndex) {
                await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_subjects_teacher_name ON custom_subjects(teacher_id, name)');
            }

            // Ensure daily_indicators table has academic_period_id, teacher_id and parent_indicator_id
            const dailyInfo = await tableInfo('daily_indicators');
            if (!dailyInfo.some(r => r.name === 'academic_period_id')) {
                await run('ALTER TABLE daily_indicators ADD COLUMN academic_period_id INTEGER DEFAULT 1');
            }
            if (!dailyInfo.some(r => r.name === 'teacher_id')) {
                await run('ALTER TABLE daily_indicators ADD COLUMN teacher_id INTEGER DEFAULT 0');
            }
            if (!dailyInfo.some(r => r.name === 'parent_indicator_id')) {
                await run('ALTER TABLE daily_indicators ADD COLUMN parent_indicator_id INTEGER');
            }
            // Index for faster lookups by period and teacher
            await run('CREATE INDEX IF NOT EXISTS idx_daily_indicators_period_teacher_grade_subject ON daily_indicators(academic_period_id, teacher_id, grade_level, subject_area)');
            await run('CREATE INDEX IF NOT EXISTS idx_daily_indicators_parent ON daily_indicators(parent_indicator_id)');
        } catch (err) {
            throw err;
        }
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('❌ Error cerrando base de datos:', err);
                } else {
                    console.log('✅ Base de datos cerrada');
                    this.isInitialized = false;
                }
            });
        }
    }

    // ========================================
    // MÉTODO PARA VERIFICAR CONEXIÓN
    // ========================================
    ensureConnection() {
        if (!this.db || !this.isInitialized) {
            throw new Error('Base de datos no inicializada. Llame a initialize() primero.');
        }
    }

    // ========================================
    // FUNCIONES DE ESTUDIANTES
    // ========================================

    async getAllStudents(academicPeriodId = null, teacherId = null, schoolId = null) {
        this.ensureConnection();

        return new Promise((resolve, reject) => {
            let query = `
                SELECT s.*, sc.name as school_name, ap.name as period_name
                FROM students s
                LEFT JOIN schools sc ON s.school_id = sc.id
                LEFT JOIN academic_periods ap ON s.academic_period_id = ap.id
                WHERE s.status = 'active'
            `;
            const params = [];

            if (teacherId !== null) {
                query += ' AND s.teacher_id = ?';
                params.push(teacherId);
            }

            if (schoolId !== null) {
                query += ' AND s.school_id = ?';
                params.push(schoolId);
            }

            if (academicPeriodId !== null) {
                query += ' AND s.academic_period_id = ?';
                params.push(academicPeriodId);
            }

            query += ' ORDER BY s.academic_period_id DESC, s.first_surname, s.first_name';

            this.db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('❌ Error en getAllStudents:', err);
                    reject(err);
                } else {
                    console.log(`✅ Estudiantes encontrados: ${rows.length}`);
                    resolve(rows || []);
                }
            });
        });
    }

    async getStudentById(id) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM students WHERE id = ?';
            
            this.db.get(query, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // ========================================
// ✅ REEMPLAZAR tu función addStudent() con esta versión
// ========================================

async addStudent(studentData, teacherId) {
    this.ensureConnection();
    
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO students (
                academic_period_id, teacher_id, school_id, cedula, first_surname, second_surname, first_name,
                student_id, email, phone, grade_level, subject_area, section,
                birth_date, address, parent_name, parent_phone, parent_email,
                notes, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            studentData.academic_period_id || 1,
            teacherId, // ✅ NUEVO: teacher_id obligatorio
            studentData.school_id || 1,
            studentData.cedula,
            studentData.first_surname,
            studentData.second_surname,
            studentData.first_name,
            studentData.student_id,
            studentData.email,
            studentData.phone,
            studentData.grade_level,
            studentData.subject_area,
            studentData.section,
            studentData.birth_date,
            studentData.address,
            studentData.parent_name,
            studentData.parent_phone,
            studentData.parent_email,
            studentData.notes,
            studentData.status || 'active'
        ];
        
        this.db.run(query, values, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: this.lastID, changes: this.changes });
            }
        });
    });
}

   async updateStudent(id, studentData, teacherId = null, schoolId = null) {
        this.ensureConnection();

        return new Promise((resolve, reject) => {
            let query, values;

            if (teacherId) {
                // Verificar que el estudiante pertenezca al profesor y escuela
                query = `
                    UPDATE students SET
                        academic_period_id = ?, cedula = ?, first_surname = ?, second_surname = ?, first_name = ?,
                        student_id = ?, email = ?, phone = ?, grade_level = ?, subject_area = ?,
                        section = ?, birth_date = ?, address = ?, parent_name = ?,
                        parent_phone = ?, parent_email = ?, notes = ?, status = ?
                    WHERE id = ? AND teacher_id = ?`;

                values = [
                    studentData.academic_period_id || 1,
                    studentData.cedula,
                    studentData.first_surname,
                    studentData.second_surname,
                    studentData.first_name,
                    studentData.student_id,
                    studentData.email,
                    studentData.phone,
                    studentData.grade_level,
                    studentData.subject_area,
                    studentData.section,
                    studentData.birth_date,
                    studentData.address,
                    studentData.parent_name,
                    studentData.parent_phone,
                    studentData.parent_email,
                    studentData.notes,
                    studentData.status,
                    id,
                    teacherId
                ];

                if (schoolId) {
                    query += ' AND school_id = ?';
                    values.push(schoolId);
                }
            } else {
                // Modo admin - puede actualizar cualquier estudiante
                query = `
                    UPDATE students SET 
                        academic_period_id = ?, teacher_id = ?, cedula = ?, first_surname = ?, second_surname = ?, first_name = ?,
                        student_id = ?, email = ?, phone = ?, grade_level = ?, subject_area = ?,
                        section = ?, birth_date = ?, address = ?, parent_name = ?,
                        parent_phone = ?, parent_email = ?, notes = ?, status = ?
                    WHERE id = ?
                `;
                
                values = [
                    studentData.academic_period_id || 1,
                    studentData.teacher_id,
                    studentData.cedula,
                    studentData.first_surname,
                    studentData.second_surname,
                    studentData.first_name,
                    studentData.student_id,
                    studentData.email,
                    studentData.phone,
                    studentData.grade_level,
                    studentData.subject_area,
                    studentData.section,
                    studentData.birth_date,
                    studentData.address,
                    studentData.parent_name,
                    studentData.parent_phone,
                    studentData.parent_email,
                    studentData.notes,
                    studentData.status,
                    id
                ];
            }
            
            this.db.run(query, values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: id, changes: this.changes });
                }
            });
        });
    }

    // Eliminar estudiantes por período académico

    async deleteStudentsByPeriod(academicPeriodId, teacherId = null) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            let query, params;
            
            if (teacherId) {
                // Solo eliminar estudiantes del profesor específico en ese período
                query = 'DELETE FROM students WHERE academic_period_id = ? AND teacher_id = ?';
                params = [academicPeriodId, teacherId];
            } else {
                // Modo admin - eliminar TODOS los estudiantes del período
                query = 'DELETE FROM students WHERE academic_period_id = ?';
                params = [academicPeriodId];
            }
            
            this.db.run(query, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    const message = teacherId 
                        ? `${this.changes} estudiantes del profesor eliminados del período ${academicPeriodId}`
                        : `${this.changes} estudiantes eliminados del período ${academicPeriodId}`;
                        
                    resolve({
                        deletedCount: this.changes,
                        message: message,
                        academicPeriodId: academicPeriodId,
                        teacherId: teacherId
                    });
                }
            });
        });
    }
async deleteStudent(id, teacherId = null, schoolId = null) {
    this.ensureConnection();
    
    return new Promise((resolve, reject) => {
        let query, params;
        
        if (teacherId) {
            // Solo puede eliminar sus propios estudiantes
            query = 'UPDATE students SET status = ? WHERE id = ? AND teacher_id = ?';
            params = ['deleted', id, teacherId];
            if (schoolId) {
                query += ' AND school_id = ?';
                params.push(schoolId);
            }
        } else {
            // Modo admin - puede eliminar cualquier estudiante
            query = 'UPDATE students SET status = ? WHERE id = ?';
            params = ['deleted', id];
        }
        
        this.db.run(query, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: id, changes: this.changes });
            }
        });
    });
}
    // Función para limpiar datos relacionados cuando se cambia de período
    async cleanPeriodData(academicPeriodId) {
        this.ensureConnection();
        
        return new Promise(async (resolve, reject) => {
            try {
                // Eliminar asistencias del período
                await new Promise((res, rej) => {
                    this.db.run('DELETE FROM attendance WHERE academic_period_id = ?', [academicPeriodId], (err) => {
                        if (err) rej(err);
                        else res();
                    });
                });
                
                // Eliminar evaluaciones del período
                await new Promise((res, rej) => {
                    this.db.run('DELETE FROM assignment_grades WHERE academic_period_id = ?', [academicPeriodId], (err) => {
                        if (err) rej(err);
                        else res();
                    });
                });
                
                // Eliminar configuraciones de lecciones del período
                await new Promise((res, rej) => {
                    this.db.run('DELETE FROM lesson_config WHERE academic_period_id = ?', [academicPeriodId], (err) => {
                        if (err) rej(err);
                        else res();
                    });
                });
                
                resolve({
                    success: true,
                    message: 'Datos del período limpiados correctamente'
                });
                
            } catch (error) {
                reject(error);
            }
        });
    }



    async getNextStudentId() {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = 'SELECT MAX(CAST(SUBSTR(student_id, 5) AS INTEGER)) as max_id FROM students WHERE student_id LIKE "EST-%"';
            
            this.db.get(query, [], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    const nextId = (row.max_id || 0) + 1;
                    const paddedId = nextId.toString().padStart(3, '0');
                    resolve(`EST-${paddedId}`);
                }
            });
        });
    }

    // ========================================
    // FUNCIONES DE MATERIAS (BD REAL)
    // ========================================
    async getAllSubjects() {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM subjects ORDER BY name';
            
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // ========================================
    // FUNCIONES DE GRADOS (BD REAL)
    // ========================================
    async getAllGrades(teacherId = null, schoolId = null) {
        this.ensureConnection();

        return new Promise((resolve, reject) => {
            let query;
            let params = [];

            if (teacherId !== null && teacherId !== undefined) {
                query = `
                    SELECT g.*,\n                           COUNT(s.id) as usage
                    FROM grades g
                    LEFT JOIN students s ON g.name = s.grade_level
                        AND s.status = 'active'
                        AND s.teacher_id = ?`;
                params = [teacherId];
                if (schoolId !== null && schoolId !== undefined) {
                    query += ' AND s.school_id = ?';
                    params.push(schoolId);
                }
                query += ' WHERE g.teacher_id = ?';
                params.push(teacherId);
                if (schoolId !== null && schoolId !== undefined) {
                    query += ' AND g.school_id = ?';
                    params.push(schoolId);
                }
                query += `
                    GROUP BY g.id, g.name, g.description, g.priority, g.created_at
                    ORDER BY g.priority DESC, g.name
                `;
            } else {
                query = `
                    SELECT g.*,\n                           COUNT(s.id) as usage
                    FROM grades g
                    LEFT JOIN students s ON g.name = s.grade_level
                        AND s.status = 'active'`;
                if (schoolId !== null && schoolId !== undefined) {
                    query += ' AND s.school_id = ?';
                    params.push(schoolId);
                }
                query += `
                    GROUP BY g.id, g.name, g.description, g.priority, g.created_at
                    ORDER BY g.priority DESC, g.name
                `;
            }

            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async addGrade(gradeData) {
        this.ensureConnection();

        return new Promise((resolve, reject) => {
            const query = 'INSERT INTO grades (teacher_id, school_id, name, description, priority) VALUES (?, ?, ?, ?, ?)';

            this.db.run(query, [
                gradeData.teacher_id,
                gradeData.school_id,
                gradeData.name,
                gradeData.description || null,
                gradeData.priority || 0
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, name: gradeData.name, changes: this.changes });
                }
            });
        });
    }

    async deleteGrade(gradeId, teacherId) {
        this.ensureConnection();

        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM grades WHERE id = ? AND teacher_id = ?', [gradeId, teacherId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        id: gradeId,
                        changes: this.changes,
                        message: 'Grado eliminado correctamente'
                    });
                }
            });
        });
    }

    async checkGradeUsage(gradeId, teacherId) {
        this.ensureConnection();

        return new Promise((resolve, reject) => {
            // Primero obtener el nombre del grado
            this.db.get('SELECT name FROM grades WHERE id = ? AND teacher_id = ?', [gradeId, teacherId], (err, gradeRow) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!gradeRow) {
                    resolve({ inUse: false, gradeName: 'Desconocido', studentCount: 0 });
                    return;
                }

                // Verificar cuántos estudiantes usan este grado
                this.db.get(
                    'SELECT COUNT(*) as count FROM students WHERE grade_level = ? AND teacher_id = ? AND status = "active"',
                    [gradeRow.name, teacherId],
                    (err, row) => {
                        if (err) {
                            reject(err);
                        } else {
                            const studentCount = row.count || 0;
                            resolve({
                                inUse: studentCount > 0,
                                gradeName: gradeRow.name,
                                studentCount: studentCount
                            });
                        }
                    }
                );
            });
        });
    }

    // Eliminar múltiples grados
    async deleteMultipleGrades(gradeIds, teacherId) {
        this.ensureConnection();

        return new Promise((resolve, reject) => {
            const placeholders = gradeIds.map(() => '?').join(',');
            const query = `DELETE FROM grades WHERE id IN (${placeholders}) AND teacher_id = ?`;

            this.db.run(query, [...gradeIds, teacherId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        deletedCount: this.changes,
                        message: `${this.changes} grados eliminados correctamente`
                    });
                }
            });
        });
    }

    // ========================================
    // FUNCIONES DE MATERIAS PERSONALIZADAS (BD REAL)
    // ========================================
    async getAllCustomSubjects(teacherId = null, schoolId = null) {
        this.ensureConnection();

        return new Promise((resolve, reject) => {
            let query = `
                SELECT cs.*, COUNT(s.id) as usage
                FROM custom_subjects cs
                LEFT JOIN students s ON cs.name = s.subject_area
                    AND s.status = 'active'`;
            const params = [];

            if (teacherId !== null) {
                query += ' AND s.teacher_id = ?';
                params.push(teacherId);
            }

            if (schoolId !== null) {
                query += ' AND s.school_id = ?';
                params.push(schoolId);
            }

            const conditions = [];
            if (teacherId !== null) {
                conditions.push('cs.teacher_id = ?');
                params.push(teacherId);
            }
            if (schoolId !== null) {
                conditions.push('cs.school_id = ?');
                params.push(schoolId);
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += `
                GROUP BY cs.id, cs.name, cs.description, cs.priority, cs.created_at
                ORDER BY cs.priority DESC, cs.name`;

            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async addCustomSubject(subjectData, teacherId, schoolId) {
        this.ensureConnection();

        return new Promise((resolve, reject) => {
            const query = 'INSERT INTO custom_subjects (teacher_id, school_id, name, description, priority) VALUES (?, ?, ?, ?, ?)';

            this.db.run(query, [
                teacherId,
                schoolId,
                subjectData.name,
                subjectData.description || null,
                subjectData.priority || 0
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, name: subjectData.name, changes: this.changes });
                }
            });
        });
    }

    async deleteCustomSubject(subjectId, teacherId, schoolId) {
        this.ensureConnection();

        return new Promise((resolve, reject) => {
            let query = 'DELETE FROM custom_subjects WHERE id = ? AND teacher_id = ?';
            const params = [subjectId, teacherId];
            if (schoolId !== undefined && schoolId !== null) {
                query += ' AND school_id = ?';
                params.push(schoolId);
            }
            this.db.run(query, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        id: subjectId,
                        changes: this.changes,
                        message: 'Materia eliminada correctamente'
                    });
                }
            });
        });
    }

    async checkSubjectUsage(subjectId, teacherId, schoolId) {
        this.ensureConnection();

        return new Promise((resolve, reject) => {
            // Primero obtener el nombre de la materia
            let subjectQuery = 'SELECT name FROM custom_subjects WHERE id = ? AND teacher_id = ?';
            const subjectParams = [subjectId, teacherId];
            if (schoolId !== undefined && schoolId !== null) {
                subjectQuery += ' AND school_id = ?';
                subjectParams.push(schoolId);
            }
            this.db.get(subjectQuery, subjectParams, (err, subjectRow) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!subjectRow) {
                    resolve({ inUse: false, subjectName: 'Desconocida', studentCount: 0 });
                    return;
                }

                // Verificar cuántos estudiantes usan esta materia
                let countQuery = 'SELECT COUNT(*) as count FROM students WHERE subject_area = ? AND status = "active" AND teacher_id = ?';
                const countParams = [subjectRow.name, teacherId];
                if (schoolId !== undefined && schoolId !== null) {
                    countQuery += ' AND school_id = ?';
                    countParams.push(schoolId);
                }
                this.db.get(
                    countQuery,
                    countParams,
                    (err, row) => {
                        if (err) {
                            reject(err);
                        } else {
                            const studentCount = row.count || 0;
                            resolve({
                                inUse: studentCount > 0,
                                subjectName: subjectRow.name,
                                studentCount: studentCount
                            });
                        }
                    }
                );
            });
        });
    }

    // Eliminar múltiples materias
    async deleteMultipleSubjects(subjectIds, teacherId, schoolId) {
        this.ensureConnection();

        return new Promise((resolve, reject) => {
            if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
                reject(new Error('subjectIds debe ser un array no vacío'));
                return;
            }
            
            console.log('🗑️ Database: Eliminando materias con IDs:', subjectIds);
            
            // Crear placeholders para la consulta (?, ?, ?, ...)
            const placeholders = subjectIds.map(() => '?').join(',');
            let query = `DELETE FROM custom_subjects WHERE id IN (${placeholders}) AND teacher_id = ?`;
            const params = [...subjectIds, teacherId];
            if (schoolId !== undefined && schoolId !== null) {
                query += ' AND school_id = ?';
                params.push(schoolId);
            }
            
            console.log('📝 Query SQL:', query);
            console.log('📝 Parámetros:', subjectIds);
            
            this.db.run(query, params, function(err) {
                if (err) {
                    console.error('❌ Error SQL eliminando materias:', err);
                    reject(err);
                } else {
                    const result = {
                        deletedCount: this.changes,
                        requestedCount: subjectIds.length,
                        message: `${this.changes} materias eliminadas correctamente`,
                        deletedIds: subjectIds
                    };
                    
                    console.log('✅ Database: Materias eliminadas exitosamente:', result);
                    resolve(result);
                }
            });
        });
    }

    // ========================================
    // FUNCIONES DE GRADOS-MATERIAS
    // ========================================

    // Asignar múltiples materias a un grado
    async assignSubjectsToGrade(gradeData) {
        this.ensureConnection();

        return new Promise((resolve, reject) => {
            const { gradeName, subjects, teacherId, academicPeriodId, teacherName, schoolId } = gradeData;
            
            // ✅ CAPTURAR LA REFERENCIA A this.db ANTES DE LOS CALLBACKS
            const db = this.db;
            
            // Usar transacción para asegurar consistencia
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                let successCount = 0;
                let errorCount = 0;
                const errors = [];
                let completed = 0;

                subjects.forEach((subject) => {
                    db.run(
                        `INSERT OR REPLACE INTO grade_subjects (
                            academic_period_id, teacher_id, school_id, grade_name, subject_name, teacher_name, is_active
                        ) VALUES (?, ?, ?, ?, ?, ?, 1)`,
                        [academicPeriodId || 1, teacherId, schoolId, gradeName, subject, teacherName || null],

                        function(err) {
                            if (err) {
                                errorCount++;
                                errors.push(`Error con ${subject}: ${err.message}`);
                            } else {
                                successCount++;
                            }

                            completed++;

                            // Si hemos procesado todos los subjects
                            if (completed === subjects.length) {
                                if (errorCount === 0) {
                                    db.run('COMMIT', (err) => {  // ✅ USAR db EN LUGAR DE this.db
                                        if (err) {
                                            reject(err);
                                        } else {
                                            resolve({
                                                success: true,
                                                successCount,
                                                errorCount,
                                                message: `${successCount} materias asignadas a ${gradeName}`
                                            });
                                        }
                                    });
                                } else {
                                    db.run('ROLLBACK', () => {  // ✅ USAR db EN LUGAR DE this.db
                                        reject(new Error(`Errores en la asignación: ${errors.join(', ')}`));
                                    });
                                }
                            }
                        }
                    );
                });
            });
        });
    }

    // Asignar materias a múltiples grados
    async assignSubjectsToMultipleGrades(assignmentData) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const { grades, subjects, teacherId, academicPeriodId, teacherName, schoolId } = assignmentData;
            
            // ✅ CAPTURAR LA REFERENCIA A this.db ANTES DE LOS CALLBACKS
            const db = this.db;
            
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                let totalSuccessCount = 0;
                let totalErrorCount = 0;
                const errors = [];
                let completedOperations = 0;
                const totalOperations = grades.length * subjects.length;

                grades.forEach((gradeName) => {
                    subjects.forEach((subject) => {
                        db.run(
                            `INSERT OR REPLACE INTO grade_subjects (
                                academic_period_id, teacher_id, school_id, grade_name, subject_name, teacher_name, is_active
                            ) VALUES (?, ?, ?, ?, ?, ?, 1)`,
                            [academicPeriodId || 1, teacherId, schoolId, gradeName, subject, teacherName || null],

                            function(err) {
                                if (err) {
                                    totalErrorCount++;
                                    errors.push(`Error con ${gradeName} - ${subject}: ${err.message}`);
                                } else {
                                    totalSuccessCount++;
                                }

                                completedOperations++;
                                
                                // Verificar si hemos procesado todo
                                if (completedOperations === totalOperations) {
                                    // Finalizar transacción
                                    if (totalErrorCount === 0) {
                                        db.run('COMMIT', (err) => {  // ✅ USAR db EN LUGAR DE this.db
                                            if (err) {
                                                reject(err);
                                            } else {
                                                resolve({
                                                    success: true,
                                                    totalSuccessCount,
                                                    totalErrorCount,
                                                    affectedGrades: grades.length,
                                                    message: `${totalSuccessCount} asignaciones completadas en ${grades.length} grados`
                                                });
                                            }
                                        });
                                    } else {
                                        db.run('ROLLBACK', () => {  // ✅ USAR db EN LUGAR DE this.db
                                            reject(new Error(`Errores en la asignación: ${errors.slice(0, 5).join(', ')}${errors.length > 5 ? '...' : ''}`));
                                        });
                                    }
                                }
                            }
                        );
                    });
                });
            });
        });
    }

    // Obtener materias asignadas a un grado
    async getSubjectsByGrade(gradeName, teacherId = null, academicPeriodId = null, schoolId = null) {
        this.ensureConnection();

        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM grade_subjects WHERE grade_name = ?';
            const params = [gradeName];

            if (teacherId !== null) {
                query += ' AND teacher_id = ?';
                params.push(teacherId);
            }

            if (academicPeriodId !== null) {
                query += ' AND academic_period_id = ?';
                params.push(academicPeriodId);
            }

            if (schoolId !== null) {
                query += ' AND school_id = ?';
                params.push(schoolId);
            }

            query += ' AND is_active = 1 ORDER BY subject_name';

            this.db.all(
                query,
                params,
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows || []);
                    }
                }
            );
        });
    }


    // Obtener todos los grados con sus materias (FORMATO CORREGIDO)
  async getAllGradesWithSubjects(teacherId = null, academicPeriodId = null, schoolId = null) {
        this.ensureConnection();

        return new Promise((resolve, reject) => {
            let query = `SELECT g.name as grade_name,
                                GROUP_CONCAT(gs.subject_name) as subjects,
                                COUNT(gs.subject_name) as subject_count
                         FROM grades g
                         LEFT JOIN grade_subjects gs ON g.name = gs.grade_name AND gs.is_active = 1`;
            const params = [];
            const conditions = [];

            if (teacherId !== null) {
                conditions.push('g.teacher_id = ?');
                params.push(teacherId);
                conditions.push('gs.teacher_id = ?');
                params.push(teacherId);
            }

            if (schoolId !== null) {
                conditions.push('g.school_id = ?');
                params.push(schoolId);
                conditions.push('gs.school_id = ?');
                params.push(schoolId);
            }

            if (academicPeriodId !== null) {
                conditions.push('gs.academic_period_id = ?');
                params.push(academicPeriodId);
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' GROUP BY g.name ORDER BY g.name';

            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const result = rows.map(row => ({
                        gradeName: row.grade_name,
                        subjects: row.subjects ? row.subjects.split(',') : [],
                        subjectCount: row.subject_count || 0
                    }));
                    resolve(result);
                }
            });
        });
    }

    // Eliminar asignación de materia a grado
    async removeSubjectFromGrade(gradeName, subjectName, teacherId = null, academicPeriodId = null, schoolId = null) {
        this.ensureConnection();

        return new Promise((resolve, reject) => {
            let query = 'DELETE FROM grade_subjects WHERE grade_name = ? AND subject_name = ?';
            const params = [gradeName, subjectName];

            if (teacherId !== null) {
                query += ' AND teacher_id = ?';
                params.push(teacherId);
            }

            if (academicPeriodId !== null) {
                query += ' AND academic_period_id = ?';
                params.push(academicPeriodId);
            }

            if (schoolId !== null) {
                query += ' AND school_id = ?';
                params.push(schoolId);
            }

            this.db.run(
                query,
                params,
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            gradeName,
                            subjectName,
                            changes: this.changes,
                            message: `Materia ${subjectName} eliminada del grado ${gradeName}`
                        });
                    }
                }
            );
        });
    }

    // ========================================
    // FUNCIONES DE ASISTENCIA
    // ========================================
    async getAttendanceByDate(date, grade, teacherId = null, academicPeriodId = null, subject = null, schoolId = null) {
        this.ensureConnection();

        return new Promise((resolve, reject) => {
            let query = `
                SELECT a.*, s.first_name, s.first_surname, s.second_surname, s.student_id as student_code
                FROM attendance a
                INNER JOIN students s ON a.student_id = s.id
                WHERE a.date = ? AND a.grade_level = ? AND s.status = 'active'
            `;

            const params = [date, grade];

            if (teacherId) {
                query += ' AND a.teacher_id = ?';
                params.push(teacherId);
            }

            if (academicPeriodId) {
                query += ' AND a.academic_period_id = ?';
                params.push(academicPeriodId);
            }

            if (subject) {
                query += ' AND a.subject_area = ?';
                params.push(subject);
            }

            if (schoolId) {
                query += ' AND a.school_id = ?';
                params.push(schoolId);
            }
            
            query += ' ORDER BY s.first_surname, s.second_surname, s.first_name';
            
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async saveAttendance(attendanceData) {
        this.ensureConnection();

        return new Promise((resolve, reject) => {
            const checkQuery = `
                SELECT id FROM attendance
                WHERE student_id = ? AND date = ? AND grade_level = ? AND subject_area = ?
                    AND teacher_id = ? AND academic_period_id = ? AND school_id = ?
            `;

            const checkParams = [
                attendanceData.student_id,
                attendanceData.date,
                attendanceData.grade_level,
                attendanceData.subject_area,
                attendanceData.teacher_id,
                attendanceData.academic_period_id,
                attendanceData.school_id
            ];
            
            this.db.get(checkQuery, checkParams, (err, existingRecord) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (existingRecord) {
                    // Actualizar registro existente
                    const updateQuery = `
                        UPDATE attendance SET 
                            status = ?, arrival_time = ?, justification = ?, 
                            notes = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `;
                    
                    const updateParams = [
                        attendanceData.status,
                        attendanceData.arrival_time,
                        attendanceData.justification,
                        attendanceData.notes,
                        existingRecord.id
                    ];
                    
                    this.db.run(updateQuery, updateParams, function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve({ id: existingRecord.id, changes: this.changes, action: 'updated' });
                        }
                    });
                } else {
                    // Crear nuevo registro
                    const insertQuery = `
                        INSERT INTO attendance (
                            academic_period_id, teacher_id, school_id, student_id, date,
                            status, arrival_time, justification,
                            notes, lesson_number, grade_level, subject_area
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    const insertParams = [
                        attendanceData.academic_period_id,
                        attendanceData.teacher_id,
                        attendanceData.school_id,
                        attendanceData.student_id,
                        attendanceData.date,
                        attendanceData.status,
                        attendanceData.arrival_time,
                        attendanceData.justification,
                        attendanceData.notes,
                        attendanceData.lesson_number || 1,
                        attendanceData.grade_level,
                        attendanceData.subject_area
                    ];
                    
                    this.db.run(insertQuery, insertParams, function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve({ id: this.lastID, changes: this.changes, action: 'created' });
                        }
                    });
                }
            });
        });
    }

    async deleteAttendanceByDate(date, grade, teacherId = null, academicPeriodId = null, subject = null, schoolId = null) {
        this.ensureConnection();

        return new Promise((resolve, reject) => {
            let query = 'DELETE FROM attendance WHERE date = ? AND grade_level = ?';
            const params = [date, grade];

            if (teacherId) {
                query += ' AND teacher_id = ?';
                params.push(teacherId);
            }

            if (academicPeriodId) {
                query += ' AND academic_period_id = ?';
                params.push(academicPeriodId);
            }

            if (subject) {
                query += ' AND subject_area = ?';
                params.push(subject);
            }

            if (schoolId) {
                query += ' AND school_id = ?';
                params.push(schoolId);
            }
            
            this.db.run(query, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    // ========================================
    // FUNCIONES DE CONFIGURACIÓN DE LECCIONES
    // ========================================
    async getLessonConfig(grade, subject = 'general') {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM lesson_config 
                WHERE grade_level = ? AND subject_area = ?
                ORDER BY created_at DESC LIMIT 1
            `;
            
            this.db.get(query, [grade, subject], (err, row) => {
                if (err) {
                    reject(err);
                } else if (row) {
                    resolve(row);
                } else {
                    // Devolver configuración por defecto
                    resolve({
                        grade_level: grade,
                        subject_area: subject,
                        lessons_per_week: 5,
                        total_weeks: 40,
                        total_lessons: 200,
                        teacher_name: null
                    });
                }
            });
        });
    }

    async saveLessonConfig(configData) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const checkQuery = `
                SELECT id FROM lesson_config 
                WHERE grade_level = ? AND subject_area = ?
            `;
            
            this.db.get(checkQuery, [configData.grade_level, configData.subject_area], (err, existing) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (existing) {
                    // Actualizar existente
                    const updateQuery = `
                        UPDATE lesson_config SET 
                            lessons_per_week = ?, total_weeks = ?, total_lessons = ?,
                            teacher_name = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `;
                    
                    this.db.run(updateQuery, [
                        configData.lessons_per_week,
                        configData.total_weeks,
                        configData.total_lessons,
                        configData.teacher_name,
                        existing.id
                    ], function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve({ id: existing.id, changes: this.changes });
                        }
                    });
                } else {
                    // Crear nuevo
                    const insertQuery = `
                        INSERT INTO lesson_config (
                            grade_level, subject_area, lessons_per_week, total_weeks,
                            total_lessons, teacher_name
                        ) VALUES (?, ?, ?, ?, ?, ?)
                    `;
                    
                    this.db.run(insertQuery, [
                        configData.grade_level,
                        configData.subject_area,
                        configData.lessons_per_week,
                        configData.total_weeks,
                        configData.total_lessons,
                        configData.teacher_name
                    ], function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve({ id: this.lastID, changes: this.changes });
                        }
                    });
                }
            });
        });
    }

    // ========================================
    // FUNCIONES DEL MÓDULO DE EVALUACIONES - CORREGIDAS ✅
    // ========================================

    // Obtener evaluaciones por grado y materia
    async getEvaluationsByGradeAndSubject(gradeLevel, subjectArea) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    a.*,
                    COUNT(ag.id) as total_grades,
                    AVG(CASE 
                        WHEN ag.points_earned IS NOT NULL AND a.max_points > 0 
                        THEN (ag.points_earned * 100.0 / a.max_points) 
                        ELSE NULL 
                    END) as avg_grade,
                    (SELECT COUNT(*) 
                    FROM students s 
                    WHERE s.status = 'active' 
                    AND s.grade_level = a.grade_level 
                    AND (s.subject_area = a.subject_area OR s.subject_area IS NULL OR s.subject_area = '')
                    ) as total_students
                FROM assignments a
                LEFT JOIN assignment_grades ag ON a.id = ag.assignment_id
                WHERE a.grade_level = ? AND a.subject_area = ? AND a.is_active = 1
                GROUP BY a.id
                ORDER BY a.created_at DESC
            `;
            
            this.db.all(query, [gradeLevel, subjectArea], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    // Obtener evaluaciones por grado, materia y período académico
    async getEvaluationsByGradeSubjectAndPeriod(gradeLevel, subjectArea, academicPeriodId, teacherId) {
        this.ensureConnection();

        return new Promise((resolve, reject) => {
            let query = `
                SELECT
                    a.*,
                    COUNT(ag.id) as total_grades,
                    AVG(CASE
                        WHEN ag.points_earned IS NOT NULL AND a.max_points > 0
                        THEN (ag.points_earned * 100.0 / a.max_points)
                        ELSE NULL
                    END) as avg_grade,
                    (SELECT COUNT(*)
                     FROM students s
                     WHERE s.status = 'active'
                       AND s.grade_level = a.grade_level
                       AND (s.subject_area = a.subject_area OR s.subject_area IS NULL OR s.subject_area = '')
                       AND s.academic_period_id = a.academic_period_id
                       AND s.teacher_id = a.teacher_id
                    ) as total_students
                FROM assignments a
                LEFT JOIN assignment_grades ag ON a.id = ag.assignment_id
                WHERE a.grade_level = ? AND a.subject_area = ? AND a.is_active = 1`;

            const params = [gradeLevel, subjectArea];

            if (academicPeriodId) {
                query += ' AND a.academic_period_id = ?';
                params.push(academicPeriodId);
            }

            if (teacherId) {
                query += ' AND a.teacher_id = ?';
                params.push(teacherId);
            }

            query += ' GROUP BY a.id ORDER BY a.created_at DESC';

            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    // Crear nueva evaluación
    async createEvaluation(evaluationData) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO assignments (
                    academic_period_id,
                    teacher_id,
                    title,
                    description,
                    due_date,
                    max_points,
                    percentage,
                    grade_level,
                    subject_area,
                    teacher_name,
                    type
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const values = [
                evaluationData.academic_period_id || 1,
                evaluationData.teacher_id,
                evaluationData.title,
                evaluationData.description || null,
                evaluationData.due_date || null,
                evaluationData.max_points,
                evaluationData.percentage,
                evaluationData.grade_level,
                evaluationData.subject_area,
                evaluationData.teacher_name || 'Sistema',
                evaluationData.type || 'tarea'
            ];
            
            this.db.run(query, values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ 
                        id: this.lastID, 
                        changes: this.changes 
                    });
                }
            });
        });
    }

    // Actualizar evaluación
    async updateEvaluation(evaluationId, evaluationData) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE assignments 
                SET title = ?, description = ?, due_date = ?, max_points = ?, 
                    percentage = ?, type = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            
            const values = [
                evaluationData.title,
                evaluationData.description || null,
                evaluationData.due_date || null,
                evaluationData.max_points,
                evaluationData.percentage,
                evaluationData.type || 'tarea',
                evaluationId
            ];
            
            this.db.run(query, values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ 
                        id: evaluationId, 
                        changes: this.changes 
                    });
                }
            });
        });
    }

    // Eliminar evaluación (soft delete)
    async deleteEvaluation(evaluationId) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = 'UPDATE assignments SET is_active = 0 WHERE id = ?';
            
            this.db.run(query, [evaluationId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ 
                        id: evaluationId, 
                        changes: this.changes 
                    });
                }
            });
        });
    }

    // ========================================
    // FUNCIONES DE CALIFICACIONES DE EVALUACIONES - CORREGIDAS ✅
    // ========================================

    // Obtener calificaciones de una evaluación específica filtradas por profesor
    async getEvaluationGrades(evaluationId, teacherId = null) {
        this.ensureConnection();

        return new Promise((resolve, reject) => {
            // Primero obtener información de la evaluación
            const evaluationQuery = 'SELECT academic_period_id, grade_level, subject_area, teacher_id, title, max_points, percentage FROM assignments WHERE id = ?';
            
            this.db.get(evaluationQuery, [evaluationId], (err, evaluation) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (!evaluation) {
                    resolve([]);
                    return;
                }

                const teacherFilter = teacherId || evaluation.teacher_id;
                // Obtener solo los estudiantes del profesor y período correspondientes con sus calificaciones (si las tienen)
                const query = `
                    SELECT
                        s.id as student_id,
                        s.first_name,
                        s.first_surname,
                        s.second_surname,
                        s.student_id as student_code,
                        ag.id as grade_id,
                        ag.points_earned,
                        ag.grade,
                        ag.percentage,
                        ag.is_submitted,
                        ag.is_late,
                        ag.notes,
                        ag.feedback,
                        ag.submitted_at,
                        ? as assignment_id,
                        ? as task_title,
                        ? as max_points,
                        ? as task_percentage
                    FROM students s
                    LEFT JOIN assignment_grades ag ON s.id = ag.student_id AND ag.assignment_id = ?
                    WHERE s.status = 'active'
                        AND s.teacher_id = ?
                        AND s.academic_period_id = ?
                        AND s.grade_level = ?
                        AND (s.subject_area = ? OR s.subject_area IS NULL OR s.subject_area = '')
                    ORDER BY s.first_surname, s.second_surname, s.first_name
                `;

                this.db.all(query, [
                    evaluationId, evaluation.title, evaluation.max_points, evaluation.percentage, // Para los campos SELECT
                    evaluationId, // Para el LEFT JOIN
                    teacherFilter, // Para filtrar por profesor
                    evaluation.academic_period_id, // Filtrar por período
                    evaluation.grade_level, // Para el WHERE
                    evaluation.subject_area // Para el WHERE
                ], (err, rows) => {
                    if (err) {
                        console.error('❌ Error en getEvaluationGrades:', err);
                        reject(err);
                    } else {
                        console.log(`👥 Estudiantes encontrados para evaluación ${evaluationId} (${evaluation.title}):`, rows.length);
                        resolve(rows || []);
                    }
                });
            });
        });
    }

    // Guardar calificaciones de evaluaciones (corregido)
    async saveEvaluationGrades(grades) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            if (!grades || grades.length === 0) {
                resolve({ savedCount: 0, errorCount: 0 });
                return;
            }

            // ✅ CAPTURAR LA REFERENCIA A this.db ANTES DE LOS CALLBACKS
            const db = this.db;

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                let savedCount = 0;
                let errorCount = 0;
                let completedOperations = 0;
                
                console.log(`💾 Iniciando guardado de ${grades.length} calificaciones...`);
                
                grades.forEach((grade, index) => {
                    // Obtener información de la evaluación para agregar datos faltantes
                    db.get('SELECT academic_period_id, teacher_id, max_points FROM assignments WHERE id = ?', [grade.assignment_id], (err, row) => {
                        if (err || !row) {
                            console.error(`❌ Error obteniendo datos de la evaluación ${grade.assignment_id}:`, err ? err.message : 'no encontrada');
                            completedOperations++;
                            errorCount++;
                            if (completedOperations === grades.length) finalize();
                            return;
                        }

                        const query = `
                            INSERT OR REPLACE INTO assignment_grades (
                                academic_period_id, teacher_id, assignment_id, student_id,
                                points_earned, grade, percentage, is_submitted, is_late,
                                notes, feedback, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                        `;

                        const percentage = row.max_points && row.max_points > 0
                            ? ((grade.points_earned || 0) / row.max_points) * 100
                            : 0;

                        const values = [
                            row.academic_period_id,
                            row.teacher_id,
                            grade.assignment_id,
                            grade.student_id,
                            grade.points_earned || 0,
                            grade.grade || percentage,
                            percentage,
                            grade.is_submitted !== undefined ? grade.is_submitted : 1,
                            grade.is_late || 0,
                            grade.notes || null,
                            grade.feedback || null
                        ];

                        db.run(query, values, function(err) {
                            completedOperations++;

                            if (err) {
                                console.error(`❌ Error guardando calificación ${index + 1}:`, err.message);
                                errorCount++;
                            } else {
                                console.log(`✅ Calificación ${index + 1} guardada exitosamente`);
                                savedCount++;
                            }

                            if (completedOperations === grades.length) finalize();
                        });
                    });
                });

                function finalize() {
                    if (errorCount === 0) {
                        db.run('COMMIT', (err) => {
                            if (err) {
                                console.error('❌ Error en commit:', err);
                                reject(err);
                            } else {
                                console.log(`✅ Transacción completada: ${savedCount} guardadas, ${errorCount} errores`);
                                resolve({ savedCount, errorCount });
                            }
                        });
                    } else {
                        db.run('ROLLBACK', (err) => {
                            console.log(`⚠️ Rollback ejecutado: ${savedCount} intentos, ${errorCount} errores`);
                            reject(new Error(`${errorCount} errores al guardar calificaciones`));
                        });
                    }
                }
            });
        });
    }

    // Obtener estadísticas de evaluaciones por estudiante
    async getStudentEvaluationStats(studentId, gradeLevel, subjectArea) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    COUNT(DISTINCT a.id) as total_evaluations,
                    COUNT(ag.id) as completed_evaluations,
                    AVG(CASE WHEN ag.percentage IS NOT NULL THEN ag.percentage ELSE 0 END) as avg_percentage,
                    SUM(a.percentage) as total_weight,
                    SUM(CASE WHEN ag.is_late = 1 THEN 1 ELSE 0 END) as late_submissions,
                    SUM(CASE WHEN ag.percentage >= 70 THEN 1 ELSE 0 END) as good_grades,
                    MIN(ag.percentage) as min_grade,
                    MAX(ag.percentage) as max_grade
                FROM assignments a
                LEFT JOIN assignment_grades ag ON a.id = ag.assignment_id AND ag.student_id = ?
                WHERE a.grade_level = ? AND a.subject_area = ? AND a.is_active = 1
            `;
            
            this.db.get(query, [studentId, gradeLevel, subjectArea], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    const stats = row || {
                        total_evaluations: 0,
                        completed_evaluations: 0,
                        avg_percentage: 0,
                        total_weight: 0,
                        late_submissions: 0,
                        good_grades: 0,
                        min_grade: 0,
                        max_grade: 0
                    };
                    
                    // Calcular estadísticas adicionales
                    const completionRate = stats.total_evaluations > 0 
                        ? (stats.completed_evaluations / stats.total_evaluations) * 100 
                        : 0;
                    
                    resolve({
                        student_id: studentId,
                        grade_level: gradeLevel,
                        subject_area: subjectArea,
                        total_evaluations: stats.total_evaluations,
                        completed_evaluations: stats.completed_evaluations,
                        pending_evaluations: stats.total_evaluations - stats.completed_evaluations,
                        completion_rate: completionRate,
                        avg_percentage: stats.avg_percentage || 0,
                        total_weight: stats.total_weight || 0,
                        late_submissions: stats.late_submissions || 0,
                        good_grades: stats.good_grades || 0,
                        min_grade: stats.min_grade || 0,
                        max_grade: stats.max_grade || 0,
                        calculated_at: new Date().toISOString()
                    });
                }
            });
        });
    }

    // Obtener resumen de evaluaciones por grado y materia
    async getEvaluationsSummary(gradeLevel, subjectArea) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    COUNT(DISTINCT a.id) as total_evaluations,
                    COUNT(ag.id) as total_submissions,
                    AVG(ag.percentage) as avg_class_percentage,
                    SUM(a.percentage) as total_weight_configured,
                    COUNT(DISTINCT ag.student_id) as students_with_grades
                FROM assignments a
                LEFT JOIN assignment_grades ag ON a.id = ag.assignment_id
                WHERE a.grade_level = ? AND a.subject_area = ? AND a.is_active = 1
            `;
            
            this.db.get(query, [gradeLevel, subjectArea], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row || {
                        total_evaluations: 0,
                        total_submissions: 0,
                        avg_class_percentage: 0,
                        total_weight_configured: 0,
                        students_with_grades: 0
                    });
                }
            });
        });
    }

    // Obtener resumen general de evaluaciones
    async getEvaluationsSummary() {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    a.grade_level,
                    a.subject_area,
                    a.type,
                    COUNT(DISTINCT a.id) as total_evaluations,
                    COUNT(ag.id) as total_grades,
                    ROUND(AVG(ag.percentage), 1) as avg_percentage,
                    COUNT(DISTINCT ag.student_id) as students_graded,
                    (SELECT COUNT(*) FROM students s
                     WHERE s.status = 'active'
                       AND s.grade_level = a.grade_level
                       AND (s.subject_area = a.subject_area OR s.subject_area IS NULL OR s.subject_area = '')
                       AND s.academic_period_id = a.academic_period_id
                       AND s.teacher_id = a.teacher_id
                    ) as total_students
                FROM assignments a
                LEFT JOIN assignment_grades ag ON a.id = ag.assignment_id
                WHERE a.is_active = 1
                GROUP BY a.grade_level, a.subject_area, a.type
                ORDER BY a.grade_level, a.subject_area, a.type
            `;
            
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    async getEvaluationTypeStats() {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    a.type,
                    COUNT(DISTINCT a.id) as total_evaluations,
                    COUNT(ag.id) as total_submissions,
                    ROUND(AVG(ag.percentage), 1) as avg_percentage,
                    COUNT(DISTINCT a.grade_level || '-' || a.subject_area) as courses_using
                FROM assignments a
                LEFT JOIN assignment_grades ag ON a.id = ag.assignment_id
                WHERE a.is_active = 1
                GROUP BY a.type
                ORDER BY total_evaluations DESC
            `;
            
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    // Obtener estadísticas por grado
    async getEvaluationGradeStats() {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    a.grade_level,
                    COUNT(DISTINCT a.id) as total_evaluations,
                    COUNT(DISTINCT a.subject_area) as subjects_count,
                    COUNT(ag.id) as total_grades,
                    ROUND(AVG(ag.percentage), 1) as avg_percentage,
                    COUNT(DISTINCT ag.student_id) as students_graded
                FROM assignments a
                LEFT JOIN assignment_grades ag ON a.id = ag.assignment_id
                WHERE a.is_active = 1
                GROUP BY a.grade_level
                ORDER BY a.grade_level
            `;
            
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    // Obtener progreso de evaluaciones
    async getEvaluationProgress() {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    a.grade_level,
                    a.subject_area,
                    COUNT(DISTINCT a.id) as total_evaluations,
                    COUNT(ag.id) as total_grades,
                    (SELECT COUNT(*) FROM students s
                    WHERE s.status = 'active'
                    AND s.grade_level = a.grade_level
                    AND (s.subject_area = a.subject_area OR s.subject_area IS NULL OR s.subject_area = '')
                    AND s.academic_period_id = a.academic_period_id
                    AND s.teacher_id = a.teacher_id
                    ) as total_students,
                    ROUND(
                        (COUNT(ag.id) * 100.0) / 
                        NULLIF(COUNT(DISTINCT a.id) * (SELECT COUNT(*) FROM students s
                        WHERE s.status = 'active'
                        AND s.grade_level = a.grade_level
                        AND (s.subject_area = a.subject_area OR s.subject_area IS NULL OR s.subject_area = '')
                        AND s.academic_period_id = a.academic_period_id
                        AND s.teacher_id = a.teacher_id), 0),
                        1
                    ) as completion_percentage
                FROM assignments a
                LEFT JOIN assignment_grades ag ON a.id = ag.assignment_id
                WHERE a.is_active = 1
                GROUP BY a.grade_level, a.subject_area
                HAVING total_evaluations > 0
                ORDER BY completion_percentage DESC, a.grade_level, a.subject_area
            `;
            
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }
    // ========================================
    // FUNCIONES PARA EL MÓDULO DE COTIDIANO
    // ========================================

    // Función genérica para ejecutar queries
    runQuery(query, params, callback) {
        this.ensureConnection();
        return this.db.all(query, params, callback);
    }

    // Obtener indicadores por grado y materia
    async getIndicatorsByGradeAndSubject(grade, subject, academicPeriodId = 1, teacherId, schoolId) {
        this.ensureConnection();

        return new Promise((resolve, reject) => {
            let query = `
                SELECT * FROM daily_indicators
                WHERE grade_level = ? AND subject_area = ? AND academic_period_id = ?
            `;
            const params = [grade, subject, academicPeriodId];
            if (teacherId) {
                query += ' AND teacher_id = ?';
                params.push(teacherId);
            }
            if (schoolId) {
                query += ' AND school_id = ?';
                params.push(schoolId);
            }
            query += ' AND is_active = 1 ORDER BY parent_indicator_id IS NULL DESC, parent_indicator_id ASC, id ASC';

            this.db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('Error fetching indicators:', err);
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    // Crear nuevo indicador
    async createIndicator(indicatorData) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const { academic_period_id = 1, teacher_id, school_id, grade_level, subject_area, indicator_name, parent_indicator_id } = indicatorData;

            const query = `
                INSERT INTO daily_indicators (academic_period_id, teacher_id, school_id, grade_level, subject_area, indicator_name, parent_indicator_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(query, [academic_period_id, teacher_id, school_id, grade_level, subject_area, indicator_name, parent_indicator_id || null], function(err) {
                if (err) {
                    console.error('Error creating indicator:', err);
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            });
        });
    }

    // Crear múltiples indicadores
    async createBulkIndicators(bulkData) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const { academic_period_id = 1, teacher_id, school_id, grade_level, subject_area, indicators } = bulkData;
            
            if (!indicators || !Array.isArray(indicators)) {
                reject(new Error('Indicadores debe ser un array'));
                return;
            }
            
            const results = [];
            let successCount = 0;
            let errorCount = 0;
            
            // Procesar cada indicador
            const processIndicator = (index) => {
                if (index >= indicators.length) {
                    // Terminamos - devolver resultados
                    resolve({
                        results: results,
                        summary: {
                            total: indicators.length,
                            success: successCount,
                            errors: errorCount
                        }
                    });
                    return;
                }
                
                const indicatorData = indicators[index];
                const { indicator_name, parent_indicator_id } = indicatorData;
                
                if (!indicator_name || indicator_name.trim() === '') {
                    results.push({
                        indicator_name: indicator_name || 'VACIO',
                        success: false,
                        error: 'Nombre vacío'
                    });
                    errorCount++;
                    processIndicator(index + 1);
                    return;
                }
                
                const query = `
                    INSERT INTO daily_indicators (academic_period_id, teacher_id, school_id, grade_level, subject_area, indicator_name, parent_indicator_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;

                this.db.run(query, [academic_period_id, teacher_id, school_id, grade_level, subject_area, indicator_name.trim(), parent_indicator_id || null], function(err) {
                    if (err) {
                        results.push({
                            indicator_name: indicator_name,
                            success: false,
                            error: err.message
                        });
                        errorCount++;
                    } else {
                        results.push({
                            indicator_name: indicator_name,
                            success: true,
                            id: this.lastID
                        });
                        successCount++;
                    }
                    
                    processIndicator(index + 1);
                });
            };
            
            processIndicator(0);
        });
    }

    // Eliminar indicador
    async deleteIndicator(indicatorId) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = 'DELETE FROM daily_indicators WHERE id = ?';
            
            this.db.run(query, [indicatorId], function(err) {
                if (err) {
                    console.error('Error deleting indicator:', err);
                    reject(err);
                } else {
                    resolve({ deleted: this.changes });
                }
            });
        });
    }

    // Obtener evaluación por fecha
    async getEvaluationByDate(grade, subject, date, teacherId, schoolId) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            let query = `
                SELECT de.*, dis.daily_indicator_id AS indicator_id, dis.score, dis.notes as score_notes
                FROM daily_evaluations de
                LEFT JOIN daily_indicator_scores dis ON de.id = dis.daily_evaluation_id
                WHERE de.grade_level = ? AND de.subject_area = ? AND de.evaluation_date = ?
            `;
            const params = [grade, subject, date];
            if (teacherId) {
                query += ' AND de.teacher_id = ?';
                params.push(teacherId);
            }
            if (schoolId) {
                query += ' AND de.school_id = ?';
                params.push(schoolId);
            }

            this.db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('Error fetching evaluation:', err);
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    // Obtener historial de evaluaciones CORREGIDO
    async getCotidianoHistory(grade, subject, academicPeriodId = 1, teacherId, schoolId) {
        this.ensureConnection();

        return new Promise((resolve, reject) => {
            let query = `
                SELECT
                    de.evaluation_date,
                    de.grade_level,
                    de.subject_area,
                    s.first_surname,
                    s.second_surname,
                    s.first_name,
                    di.indicator_name,
                    dis.score,
                    dis.notes
                FROM daily_evaluations de
                LEFT JOIN students s ON de.student_id = s.id
                LEFT JOIN daily_indicator_scores dis ON de.id = dis.daily_evaluation_id
                LEFT JOIN daily_indicators di ON dis.daily_indicator_id = di.id
                WHERE de.grade_level = ? AND de.subject_area = ? AND de.academic_period_id = ?
            `;

            const params = [grade, subject, academicPeriodId];
            if (teacherId) {
                query += ' AND de.teacher_id = ?';
                params.push(teacherId);
            }
            if (schoolId) {
                query += ' AND de.school_id = ?';
                params.push(schoolId);
            }
            query += ' ORDER BY de.evaluation_date DESC, s.first_surname, di.indicator_name';

            this.db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('❌ Error obteniendo historial cotidiano:', err);
                    reject(err);
                } else {
                    // Procesar filas para agregar student_name
                    const processedRows = rows.map(row => ({
                        ...row,
                        student_name: row.first_surname ? 
                            `${row.first_surname} ${row.second_surname || ''} ${row.first_name}`.trim() : 
                            null
                    }));
                    
                    console.log(`📚 Historial obtenido: ${processedRows.length} registros para ${grade} - ${subject}`);
                    if (processedRows.length > 0) {
                        console.log('📝 Ejemplo de registro:', processedRows[0]);
                    }
                    resolve(processedRows);
                }
            });
        });
    }

    // Guardar escala máxima para grado/materia
    // Guardar escala máxima para grado/materia con separación por profesor y período
    saveGradeScale(gradeLevel, subjectArea, maxScale, teacherId, academicPeriodId = 1) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT OR REPLACE INTO grade_scale_config
                (academic_period_id, teacher_id, grade_level, subject_area, max_scale, updated_at)
                VALUES (?, ?, ?, ?, ?, datetime('now'))
            `;

            this.db.run(query, [academicPeriodId, teacherId, gradeLevel, subjectArea, maxScale], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ success: true, max_scale: maxScale });
                }
            });
        });
    }

    // Obtener escala máxima considerando profesor y período
    getGradeScale(gradeLevel, subjectArea, teacherId, academicPeriodId = 1) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT max_scale
                FROM grade_scale_config
                WHERE academic_period_id = ? AND teacher_id = ? AND grade_level = ? AND subject_area = ?
            `;

            this.db.get(query, [academicPeriodId, teacherId, gradeLevel, subjectArea], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row ? row.max_scale : 5.0); // Default 5.0 si no existe
                }
            });
        });
    }

    // ========================================
    // CÁLCULOS DE ESTADÍSTICAS MEP
    // ========================================
    async calculateMEPAttendanceGrade(studentId, grade, subject = 'general', totalLessons = 200, academicPeriodId = null, teacherId = null) {
        this.ensureConnection();
        
        return new Promise(async (resolve, reject) => {  // ✅ Agregar async aquí
            try {
                let query = `
                    SELECT
                        status,
                        COUNT(*) as count
                    FROM attendance
                    WHERE student_id = ? AND grade_level = ? AND subject_area = ?`;
                const params = [studentId, grade, subject];

                if (academicPeriodId) {
                    query += ' AND academic_period_id = ?';
                    params.push(academicPeriodId);
                }

                query += ' GROUP BY status';

                this.db.all(query, params, async (err, rows) => {  // ✅ Agregar async aquí también
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    try {
                        // Inicializar contadores
                        const stats = {
                            present: 0,
                            late_justified: 0,
                            late_unjustified: 0,
                            absent_justified: 0,
                            absent_unjustified: 0
                        };
                        
                        // Procesar resultados
                        rows.forEach(row => {
                            stats[row.status] = row.count;
                        });
                        
                        // Calcular ausencias según fórmula MEP
                        const totalAbsences = stats.absent_unjustified + 
                                        (stats.late_unjustified * 0.5) + 
                                        (stats.late_justified * 0.5);
                        
                        // Calcular porcentaje de ausencias
                        const absencePercentage = (totalAbsences / totalLessons) * 100;
                        const attendancePercentage = 100 - absencePercentage;
                        
                        // Convertir porcentaje de ausencias a nota MEP (escala 0-10)
                        let nota0_10;
                        if (absencePercentage <= 5) nota0_10 = 10;
                        else if (absencePercentage <= 10) nota0_10 = 9;
                        else if (absencePercentage <= 15) nota0_10 = 8;
                        else if (absencePercentage <= 20) nota0_10 = 7;
                        else if (absencePercentage <= 25) nota0_10 = 6;
                        else if (absencePercentage <= 30) nota0_10 = 5;
                        else if (absencePercentage <= 35) nota0_10 = 4;
                        else if (absencePercentage <= 40) nota0_10 = 3;
                        else if (absencePercentage <= 45) nota0_10 = 2;
                        else if (absencePercentage <= 50) nota0_10 = 1;
                        else nota0_10 = 0;
                        
                        // ✅ AQUÍ USAS AWAIT PARA OBTENER LA ESCALA
                        const maxScale = await this.getGradeScale(
                            grade,
                            subject || 'general',
                            teacherId,
                            academicPeriodId || 1
                        );
                        const notaAsistencia = (nota0_10 / 10) * maxScale;
                        
                        const result = {
                            student_id: studentId,
                            grade_level: grade,
                            subject_area: subject,
                            total_lessons: totalLessons,
                            stats: stats,
                            total_records: Object.values(stats).reduce((sum, count) => sum + count, 0),
                            total_absences: totalAbsences,
                            absence_percentage: absencePercentage,
                            attendance_percentage: attendancePercentage,
                            nota_0_10: nota0_10,
                            nota_asistencia: notaAsistencia,
                            max_scale: maxScale,  // ✅ Incluir la escala usada
                            calculated_at: new Date().toISOString()
                        };
                        
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }


// ========================================
// MÉTODOS PARA PROFESORES
// ========================================

async createTeacher(teacherData) {
    this.ensureConnection();
    
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO teachers (
                full_name, cedula, school_name, email, password,
                teacher_type, specialized_type, school_code, 
                circuit_code, regional
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            teacherData.full_name,
            teacherData.cedula,
            teacherData.school_name,
            teacherData.email,
            teacherData.password, // En producción, hash this
            teacherData.teacher_type,
            teacherData.specialized_type,
            teacherData.school_code,
            teacherData.circuit_code,
            teacherData.regional
        ];
        
        this.db.run(query, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({
                    id: this.lastID,
                    message: 'Profesor creado exitosamente'
                });
            }
        });
    });
}

// ========================================
// FUNCIÓN COMPLETAMENTE CORREGIDA - SIN FUNCIONES AUXILIARES
// ========================================

async createTeacherMultiSchool(teacherData, schools) {
    this.ensureConnection();
    
    // ✅ GUARDAR REFERENCIA A this.db
    const db = this.db;
    
    return new Promise((resolve, reject) => {
        console.log('🔄 Iniciando registro de profesor multi-escuela...');
        
        // Iniciar transacción
        db.serialize(() => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) {
                    console.error('❌ Error iniciando transacción:', err);
                    reject(err);
                    return;
                }
                
                // 1. Crear profesor
                const teacherQuery = `
                    INSERT INTO teachers (
                        full_name, cedula, email, password,
                        teacher_type, specialized_type, regional
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `;
                
                const teacherParams = [
                    teacherData.full_name,
                    teacherData.cedula,
                    teacherData.email,
                    teacherData.password,
                    teacherData.teacher_type,
                    teacherData.specialized_type,
                    teacherData.regional
                ];
                
                db.run(teacherQuery, teacherParams, function(err) {
                    if (err) {
                        console.error('❌ Error creando profesor:', err);
                        db.run('ROLLBACK');
                        reject(err);
                        return;
                    }
                    
                    const teacherId = this.lastID;
                    console.log(`✅ Profesor creado con ID: ${teacherId}`);
                    
                    // 2. Procesar escuelas - TODO INLINE
                    let schoolsProcessed = 0;
                    let schoolResults = [];
                    const totalSchools = schools.length;
                    
                    console.log(`🏫 Procesando ${totalSchools} escuelas...`);
                    
                    // Función para finalizar el proceso
                    const finishProcess = () => {
                        if (schoolsProcessed === totalSchools) {
                            db.run('COMMIT', (err) => {
                                if (err) {
                                    console.error('❌ Error en commit:', err);
                                    reject(err);
                                } else {
                                    console.log('🎉 Registro completado exitosamente');
                                    resolve({
                                        teacherId: teacherId,
                                        schools: schoolResults,
                                        totalSchools: totalSchools,
                                        message: 'Profesor y escuelas creados exitosamente'
                                    });
                                }
                            });
                        }
                    };
                    
                    // Procesar cada escuela
                    schools.forEach((schoolData, index) => {
                        console.log(`🔍 Procesando escuela ${index + 1}: ${schoolData.name}`);
                        
                        // Buscar si escuela ya existe
                        let findSchoolQuery, findParams;
                        
                        if (schoolData.school_code && schoolData.school_code.trim()) {
                            // Si tiene código MEP, buscar por código
                            findSchoolQuery = `SELECT id, name FROM schools WHERE school_code = ?`;
                            findParams = [schoolData.school_code.trim()];
                            console.log(`🔍 Buscando por código MEP: ${schoolData.school_code}`);
                        } else {
                            // Si no tiene código, buscar por nombre exacto
                            findSchoolQuery = `SELECT id, name FROM schools WHERE name = ?`;
                            findParams = [schoolData.name.trim()];
                            console.log(`🔍 Buscando por nombre: ${schoolData.name}`);
                        }
                        
                        db.get(findSchoolQuery, findParams, (err, existingSchool) => {
                            if (err) {
                                console.error('❌ Error buscando escuela:', err);
                                db.run('ROLLBACK');
                                reject(err);
                                return;
                            }
                            
                            // Función para crear la relación profesor-escuela
                            const createRelation = (schoolId, schoolName) => {
                                console.log(`🔗 Creando relación profesor-escuela: ${teacherId} -> ${schoolId}`);
                                
                                const relationQuery = `
                                    INSERT INTO teacher_schools (teacher_id, school_id, is_primary_school)
                                    VALUES (?, ?, ?)
                                `;
                                
                                const isPrimary = index === 0 ? 1 : 0; // Primera escuela es principal
                                
                                db.run(relationQuery, [teacherId, schoolId, isPrimary], (err) => {
                                    if (err) {
                                        console.error('❌ Error creando relación profesor-escuela:', err);
                                        db.run('ROLLBACK');
                                        reject(err);
                                        return;
                                    }
                                    
                                    schoolResults.push({
                                        schoolId: schoolId,
                                        name: schoolName,
                                        isPrimary: isPrimary === 1
                                    });
                                    
                                    schoolsProcessed++;
                                    console.log(`✅ Escuela ${index + 1} procesada. Total: ${schoolsProcessed}/${totalSchools}`);
                                    
                                    // Verificar si terminamos
                                    finishProcess();
                                });
                            };
                            
                            if (existingSchool) {
                                // Usar escuela existente
                                console.log(`✅ Escuela encontrada, usando ID: ${existingSchool.id}`);
                                createRelation(existingSchool.id, existingSchool.name);
                            } else {
                                // Crear nueva escuela
                                console.log(`🆕 Creando nueva escuela: ${schoolData.name}`);
                                
                                const createSchoolQuery = `
                                    INSERT INTO schools (name, address, phone, school_code)
                                    VALUES (?, ?, ?, ?)
                                `;
                                
                                const schoolParams = [
                                    schoolData.name.trim(),
                                    schoolData.address ? schoolData.address.trim() : null,
                                    schoolData.phone ? schoolData.phone.trim() : null,
                                    schoolData.school_code ? schoolData.school_code.trim() : null
                                ];
                                
                                db.run(createSchoolQuery, schoolParams, function(err) {
                                    if (err) {
                                        console.error('❌ Error creando escuela:', err);
                                        db.run('ROLLBACK');
                                        reject(err);
                                        return;
                                    }
                                    
                                    const newSchoolId = this.lastID;
                                    console.log(`✅ Nueva escuela creada con ID: ${newSchoolId}`);
                                    createRelation(newSchoolId, schoolData.name.trim());
                                });
                            }
                        });
                    });
                });
            });
        });
    });
}

// ========================================
// FUNCIÓN PARA VERIFICAR CÉDULA
// ========================================

async getTeacherByCedula(cedula) {
    this.ensureConnection();
    
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM teachers WHERE cedula = ?`;
        
        this.db.get(query, [cedula], (err, row) => {
            if (err) {
                console.error('❌ Error buscando profesor por cédula:', err);
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}


// ========================================
// FUNCIÓN ACTUALIZADA PARA MULTI-ESCUELA
// ========================================

async getAllTeachers() {
    this.ensureConnection();
    
    return new Promise((resolve, reject) => {
        // Consulta principal para obtener profesores
        const teachersQuery = `
            SELECT 
                t.id, t.full_name, t.cedula, t.email,
                t.teacher_type, t.specialized_type, t.regional,
                t.is_active, t.is_paid,
                t.registration_date, t.activation_date, t.last_login,
                t.created_at, t.updated_at
            FROM teachers t 
            ORDER BY t.registration_date DESC
        `;
        
        this.db.all(teachersQuery, [], (err, teachers) => {
            if (err) {
                console.error('❌ Error obteniendo profesores:', err);
                reject(err);
            } else if (!teachers || teachers.length === 0) {
                console.log('ℹ️ No se encontraron profesores registrados');
                resolve([]);
            } else {
                console.log(`✅ Encontrados ${teachers.length} profesores, obteniendo escuelas...`);
                
                // Para cada profesor, obtener sus escuelas
                let processedTeachers = 0;
                const teachersWithSchools = [];
                
                teachers.forEach((teacher, index) => {
                    // Consulta para obtener escuelas del profesor
                    const schoolsQuery = `
                        SELECT 
                            s.id as school_id,
                            s.name as school_name,
                            s.address,
                            s.phone,
                            s.school_code,
                            ts.is_primary_school,
                            ts.is_active as relation_active
                        FROM teacher_schools ts
                        JOIN schools s ON ts.school_id = s.id
                        WHERE ts.teacher_id = ? AND ts.is_active = 1
                        ORDER BY ts.is_primary_school DESC, s.name ASC
                    `;
                    
                    this.db.all(schoolsQuery, [teacher.id], (err, schools) => {
                        if (err) {
                            console.error(`❌ Error obteniendo escuelas para profesor ${teacher.id}:`, err);
                            // Incluir profesor sin escuelas si hay error
                            teachersWithSchools[index] = {
                                ...teacher,
                                schools: [],
                                primary_school: null,
                                schools_count: 0,
                                schools_names: 'Sin escuelas asignadas'
                            };
                        } else {
                            // Procesar escuelas del profesor
                            const primarySchool = schools.find(s => s.is_primary_school === 1);
                            const schoolNames = schools.map(s => s.school_name).join(', ');
                            
                            teachersWithSchools[index] = {
                                ...teacher,
                                schools: schools || [],
                                primary_school: primarySchool ? primarySchool.school_name : null,
                                schools_count: schools ? schools.length : 0,
                                schools_names: schoolNames || 'Sin escuelas asignadas'
                            };
                            
                            console.log(`✅ Profesor ${teacher.full_name}: ${schools ? schools.length : 0} escuelas`);
                        }
                        
                        processedTeachers++;
                        
                        // Cuando terminemos de procesar todos los profesores
                        if (processedTeachers === teachers.length) {
                            console.log(`🎉 Procesamiento completo: ${teachersWithSchools.length} profesores con escuelas`);
                            resolve(teachersWithSchools);
                        }
                    });
                });
            }
        });
    });
}

// ========================================
// FUNCIÓN AUXILIAR PARA OBTENER ESTADÍSTICAS DE ADMIN
// ========================================

async getAdminStats() {
    this.ensureConnection();
    
    return new Promise((resolve, reject) => {
        const statsQuery = `
            SELECT 
                COUNT(*) as total_teachers,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_teachers,
                SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as pending_teachers,
                SUM(CASE WHEN is_paid = 1 THEN 1 ELSE 0 END) as paid_teachers,
                SUM(CASE WHEN is_paid = 0 THEN 1 ELSE 0 END) as unpaid_teachers
            FROM teachers
        `;
        
        this.db.get(statsQuery, [], (err, stats) => {
            if (err) {
                console.error('❌ Error obteniendo estadísticas de admin:', err);
                reject(err);
            } else {
                // También obtener número de escuelas
                const schoolsQuery = `SELECT COUNT(*) as total_schools FROM schools`;
                
                this.db.get(schoolsQuery, [], (err, schoolStats) => {
                    if (err) {
                        console.error('❌ Error obteniendo estadísticas de escuelas:', err);
                        resolve({
                            ...stats,
                            total_schools: 0
                        });
                    } else {
                        resolve({
                            ...stats,
                            total_schools: schoolStats.total_schools
                        });
                    }
                });
            }
        });
    });
}

async getTeacherByEmail(email) {
    this.ensureConnection();
    
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM teachers WHERE email = ?`;
        
        this.db.get(query, [email], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}


async toggleTeacherStatus(teacherId, action) {
    this.ensureConnection();
    
    return new Promise((resolve, reject) => {
        const isActive = action === 'activate' ? 1 : 0;
        const activationDate = action === 'activate' ? 'CURRENT_TIMESTAMP' : 'NULL';
        
        const query = `
            UPDATE teachers 
            SET is_active = ?, 
                activation_date = ${action === 'activate' ? 'CURRENT_TIMESTAMP' : 'NULL'},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        
        this.db.run(query, [isActive, teacherId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({
                    id: teacherId,
                    changes: this.changes,
                    action: action
                });
            }
        });
    });
}

async updateTeacherPayment(teacherId, isPaid) {
    this.ensureConnection();
    
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE teachers 
            SET is_paid = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        
        this.db.run(query, [isPaid ? 1 : 0, teacherId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({
                    id: teacherId,
                    changes: this.changes
                });
            }
        });
    });
}




// ========================================
// MÉTODOS PARA ADMINISTRADOR
// ========================================

async updateAdminLastLogin() {
    this.ensureConnection();
    
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE admin_users 
            SET last_login = CURRENT_TIMESTAMP
            WHERE email = 'Luiscraft'
        `;
        
        this.db.run(query, [], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({
                    changes: this.changes,
                    lastLogin: new Date().toISOString()
                });
            }
        });
    });
}

async getAdminUser() {
    this.ensureConnection();
    
    return new Promise((resolve, reject) => {
        const query = `
            SELECT username, email, last_login, created_at 
            FROM admin_users 
            WHERE email = 'Luiscraft'
        `;
        
        this.db.get(query, [], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}



// Función para cambiar la escuela activa de un profesor
async switchTeacherActiveSchool(teacherId, schoolId, sessionToken) {
    this.ensureConnection();
    
    return new Promise((resolve, reject) => {
        // Primero verificar que el profesor tenga acceso a esa escuela
        const checkQuery = `
            SELECT COUNT(*) as count 
            FROM teacher_schools 
            WHERE teacher_id = ? AND school_id = ? AND is_active = 1
        `;
        
        this.db.get(checkQuery, [teacherId, schoolId], (err, result) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (result.count === 0) {
                reject(new Error('Profesor no tiene acceso a esta escuela'));
                return;
            }
            
            // Actualizar la sesión activa
            const updateQuery = `
                UPDATE active_sessions 
                SET school_id = ?, last_activity = CURRENT_TIMESTAMP
                WHERE teacher_id = ? AND session_token = ?
            `;
            
            this.db.run(updateQuery, [schoolId, teacherId, sessionToken], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        teacherId: teacherId,
                        schoolId: schoolId,
                        changes: this.changes
                    });
                }
            });
        });
    });
}


// ========================================
// FUNCIÓN PARA OBTENER ESCUELA POR ID
// ========================================

async getSchoolById(schoolId) {
    this.ensureConnection();
    
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                id, name, address, phone, school_code,
                created_at, updated_at
            FROM schools 
            WHERE id = ?
        `;
        
        this.db.get(query, [schoolId], (err, row) => {
            if (err) {
                console.error('❌ Error obteniendo escuela por ID:', err);
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// Actualizar último login del profesor
async updateTeacherLastLogin(teacherId) {
    this.ensureConnection();
    
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE teachers 
            SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        
        this.db.run(query, [teacherId], function(err) {
            if (err) {
                console.error('❌ Error actualizando último login:', err);
                reject(err);
            } else {
                resolve({ teacherId: teacherId, changes: this.changes });
            }
        });
    });
}
// Actualizar estado de pago de profesor
async updateTeacherPayment(teacherId, isPaid) {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE teachers SET is_paid = ?, payment_date = ? WHERE id = ?`;
        const paymentDate = isPaid ? new Date().toISOString() : null;
        
        this.db.run(sql, [isPaid ? 1 : 0, paymentDate, teacherId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({
                    id: teacherId,
                    is_paid: isPaid,
                    changes: this.changes
                });
            }
        });
    });
}

// Actualizar último login (ya existe pero asegúrate que esté)
async updateTeacherLastLogin(teacherId) {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE teachers SET last_login = ? WHERE id = ?`;
        
        this.db.run(sql, [new Date().toISOString(), teacherId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: teacherId, last_login: new Date().toISOString() });
            }
        });
    });
}




// ========================================
// FUNCIONES DE GESTIÓN DE SESIONES ACTIVAS
// ========================================
async getActiveSessions() {
    this.ensureConnection();
    
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                s.id,
                s.teacher_id,
                s.session_token,
                s.ip_address as ip,
                s.last_activity,
                s.created_at,
                t.full_name as teacher_name,
                t.email,
                CASE 
                    WHEN datetime(s.last_activity) > datetime('now', '-30 minutes') 
                    THEN 'active' 
                    ELSE 'inactive' 
                END as status
            FROM active_sessions s
            INNER JOIN teachers t ON s.teacher_id = t.id
            WHERE datetime(s.last_activity) > datetime('now', '-24 hours')
            ORDER BY s.last_activity DESC
        `;
        
        this.db.all(query, [], (err, rows) => {
            if (err) {
                console.error('❌ Error obteniendo sesiones activas:', err);
                reject(err);
            } else {
                console.log(`✅ Sesiones activas encontradas: ${rows.length}`);
                resolve(rows || []);
            }
        });
    });
}

// Obtener escuelas de un profesor específico
async getTeacherSchools(teacherId) {
    this.ensureConnection();
    
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                s.id as school_id,
                s.name as school_name,
                s.address,
                s.phone,
                s.school_code,
                ts.is_primary_school,
                ts.is_active as relation_active,
                ts.assigned_date
            FROM teacher_schools ts
            JOIN schools s ON ts.school_id = s.id
            WHERE ts.teacher_id = ? AND ts.is_active = 1
            ORDER BY ts.is_primary_school DESC, s.name ASC
        `;
        
        this.db.all(query, [teacherId], (err, rows) => {
            if (err) {
                console.error('❌ Error obteniendo escuelas del profesor:', err);
                reject(err);
            } else {
                console.log(`✅ Escuelas encontradas para profesor ${teacherId}:`, rows ? rows.length : 0);
                resolve(rows || []);
            }
        });
    });
}


// Actualizar createActiveSession para incluir school_id
async createActiveSession(teacherId, sessionToken, ipAddress, userAgent, schoolId = null) {
    this.ensureConnection();
    
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO active_sessions (
                teacher_id, school_id, session_token, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?)
        `;
        
        this.db.run(query, [teacherId, schoolId, sessionToken, ipAddress, userAgent], function(err) {
            if (err) {
                console.error('❌ Error creando sesión activa:', err);
                reject(err);
            } else {
                resolve({
                    sessionId: this.lastID,
                    teacherId: teacherId,
                    schoolId: schoolId,
                    sessionToken: sessionToken
                });
            }
        });
    });
}







async updateSessionActivity(sessionToken) {
    this.ensureConnection();
    
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE active_sessions 
            SET last_activity = CURRENT_TIMESTAMP 
            WHERE session_token = ?
        `;
        
        this.db.run(query, [sessionToken], function(err) {
            if (err) {
                console.error('❌ Error actualizando actividad de sesión:', err);
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
}

// Cambiar escuela activa en la sesión
async updateSessionSchool(sessionToken, schoolId) {
    this.ensureConnection();

    return new Promise((resolve, reject) => {
        const query = `
            UPDATE active_sessions
            SET school_id = ?, last_activity = CURRENT_TIMESTAMP
            WHERE session_token = ?
        `;

        this.db.run(query, [schoolId, sessionToken], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
}

async deleteActiveSession(sessionToken) {
    this.ensureConnection();
    
    return new Promise((resolve, reject) => {
        const query = `DELETE FROM active_sessions WHERE session_token = ?`;
        
        this.db.run(query, [sessionToken], function(err) {
            if (err) {
                console.error('❌ Error eliminando sesión activa:', err);
                reject(err);
            } else {
                console.log('✅ Sesión eliminada, cambios:', this.changes);
                resolve({ changes: this.changes });
            }
        });
    });
}

// Limpiar sesiones anteriores del usuario
async clearUserPreviousSessions(teacherId) {
    this.ensureConnection();
    
    return new Promise((resolve, reject) => {
        const query = `DELETE FROM active_sessions WHERE teacher_id = ?`;
        
        this.db.run(query, [teacherId], function(err) {
            if (err) {
                console.error('❌ Error limpiando sesiones anteriores:', err);
                reject(err);
            } else {
                console.log(`🧹 ${this.changes} sesiones anteriores eliminadas para profesor ${teacherId}`);
                resolve({ deletedSessions: this.changes });
            }
        });
    });
}

// NUEVA FUNCIÓN: Actualizar perfil del profesor
    async updateTeacherProfile(teacherId, profileData) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE teachers 
                SET full_name = ?, school_name = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `;
            
            const values = [
                profileData.full_name,
                profileData.school_name,
                teacherId
            ];
            
            this.db.run(query, values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ 
                        id: teacherId, 
                        changes: this.changes,
                        full_name: profileData.full_name,
                        school_name: profileData.school_name
                    });
                }
            });
        });
    }


// NUEVA FUNCIÓN: Actualizar perfil del profesor
    async updateTeacherProfile(teacherId, profileData) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE teachers 
                SET full_name = ?, school_name = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `;
            
            const values = [
                profileData.full_name,
                profileData.school_name,
                teacherId
            ];
            
            this.db.run(query, values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ 
                        id: teacherId, 
                        changes: this.changes,
                        full_name: profileData.full_name,
                        school_name: profileData.school_name
                    });
                }
            });
        });
    }


// Copiar estudiantes de un período a otro
async copyStudentsBetweenPeriods(fromPeriodId, toPeriodId) {
    this.ensureConnection();
    
    return new Promise((resolve, reject) => {
        // Verificar que no existan estudiantes en el período destino
        const checkQuery = 'SELECT COUNT(*) as count FROM students WHERE academic_period_id = ? AND status = "active"';
        
        this.db.get(checkQuery, [toPeriodId], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (row.count > 0) {
                resolve({
                    copied: 0,
                    message: `El período destino ya tiene ${row.count} estudiantes. No se realizó la copia.`,
                    skipped: true
                });
                return;
            }
            
            // Obtener estudiantes del período origen
            const selectQuery = `
                SELECT * FROM students 
                WHERE academic_period_id = ? AND status = 'active'
                ORDER BY first_surname, first_name
            `;
            
            this.db.all(selectQuery, [fromPeriodId], (err, students) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (students.length === 0) {
                    resolve({
                        copied: 0,
                        message: 'No hay estudiantes activos en el período origen.',
                        skipped: true
                    });
                    return;
                }
                
                console.log(`📋 Copiando ${students.length} estudiantes...`);
                
                // Insertar estudiantes uno por uno con IDs únicos
                let insertedCount = 0;
                let lastStudentIndex = 0;
                
                // Obtener el último número de estudiante para generar IDs únicos
                this.db.get(
                    "SELECT MAX(CAST(SUBSTR(student_id, 5) AS INTEGER)) as maxId FROM students WHERE student_id LIKE 'EST-%'",
                    [],
                    (err, result) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        lastStudentIndex = (result.maxId || 0);
                        
                        // Función para insertar cada estudiante
                        const insertStudent = (student, index) => {
                            const newStudentId = `EST-${String(lastStudentIndex + index + 1).padStart(3, '0')}`;
                            const newCedula = student.cedula ? `${student.cedula}_P${toPeriodId}` : null;
                                                        
                            const insertQuery = `
                                INSERT INTO students (
                                    academic_period_id, teacher_id, school_id, cedula, first_surname, second_surname, 
                                    first_name, student_id, email, phone, grade_level, subject_area, 
                                    section, birth_date, address, parent_name, parent_phone, parent_email, 
                                    notes, status
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `;
                            
                            const values = [
                                toPeriodId,
                                student.teacher_id,
                                student.school_id || 1,
                                newCedula,
                                student.first_surname,
                                student.second_surname,
                                student.first_name,
                                newStudentId,
                                student.email,
                                student.phone,
                                student.grade_level,
                                student.subject_area,
                                student.section,
                                student.birth_date,
                                student.address,
                                student.parent_name,
                                student.parent_phone,
                                student.parent_email,
                                student.notes,
                                'active'
                            ];
                            
                            this.db.run(insertQuery, values, function(err) {
                                if (err) {
                                    console.error(`❌ Error insertando estudiante ${index + 1}:`, err);
                                } else {
                                    insertedCount++;
                                    console.log(`✅ Estudiante ${index + 1}/${students.length} copiado: ${student.first_name} ${student.first_surname}`);
                                }
                                
                                // Si es el último estudiante, resolver la promesa
                                if (index === students.length - 1) {
                                    if (insertedCount > 0) {
                                        resolve({
                                            copied: insertedCount,
                                            message: `${insertedCount} estudiantes copiados exitosamente al nuevo período`,
                                            skipped: false
                                        });
                                    } else {
                                        reject(new Error('No se pudo copiar ningún estudiante'));
                                    }
                                }
                            });
                        };
                        
                        // Insertar todos los estudiantes
                        students.forEach((student, index) => {
                            insertStudent(student, index);
                        });
                    }
                );
            });
        });
    });
}



    
}





// Crear instancia única
const database = new Database();

module.exports = database;