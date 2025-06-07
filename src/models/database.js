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
                        this.createTables().then(() => {
                            this.isInitialized = true;
                            resolve();
                        }).catch(reject);
                    }
                });
            } catch (error) {
                console.error('❌ Error en initialize:', error);
                reject(error);
            }
        });
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            const schemaPath = path.join(__dirname, '../../database/schema.sql');
            
            if (!fs.existsSync(schemaPath)) {
                console.error('❌ Archivo schema.sql no encontrado en:', schemaPath);
                reject(new Error('❌ Archivo schema.sql no encontrado'));
                return;
            }

            const schema = fs.readFileSync(schemaPath, 'utf8');
            
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
    async getAllStudents() {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM students 
                WHERE status = 'active' 
                ORDER BY first_surname, second_surname, first_name
            `;
            
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
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

    async addStudent(studentData) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO students (
                    school_id, cedula, first_surname, second_surname, first_name,
                    student_id, email, phone, grade_level, subject_area, section,
                    birth_date, address, parent_name, parent_phone, parent_email,
                    notes, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const values = [
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

    async updateStudent(id, studentData) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE students SET 
                    cedula = ?, first_surname = ?, second_surname = ?, first_name = ?,
                    student_id = ?, email = ?, phone = ?, grade_level = ?, subject_area = ?,
                    section = ?, birth_date = ?, address = ?, parent_name = ?,
                    parent_phone = ?, parent_email = ?, notes = ?, status = ?
                WHERE id = ?
            `;
            
            const values = [
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
            
            this.db.run(query, values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: id, changes: this.changes });
                }
            });
        });
    }

    async deleteStudent(id) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = 'UPDATE students SET status = ? WHERE id = ?';
            
            this.db.run(query, ['inactive', id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: id, changes: this.changes });
                }
            });
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
    async getAllGrades() {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = `
                SELECT g.*, 
                       COUNT(s.id) as usage 
                FROM grades g 
                LEFT JOIN students s ON g.name = s.grade_level AND s.status = 'active'
                GROUP BY g.id, g.name, g.description, g.priority, g.created_at
                ORDER BY g.priority DESC, g.name
            `;
            
            this.db.all(query, [], (err, rows) => {
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
            const query = 'INSERT INTO grades (name, description, priority) VALUES (?, ?, ?)';
            
            this.db.run(query, [
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

    async deleteGrade(gradeId) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM grades WHERE id = ?', [gradeId], function(err) {
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

    async checkGradeUsage(gradeId) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            // Primero obtener el nombre del grado
            this.db.get('SELECT name FROM grades WHERE id = ?', [gradeId], (err, gradeRow) => {
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
                    'SELECT COUNT(*) as count FROM students WHERE grade_level = ? AND status = "active"',
                    [gradeRow.name],
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
    async deleteMultipleGrades(gradeIds) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const placeholders = gradeIds.map(() => '?').join(',');
            const query = `DELETE FROM grades WHERE id IN (${placeholders})`;
            
            this.db.run(query, gradeIds, function(err) {
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
    async getAllCustomSubjects() {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = `
                SELECT cs.*, 
                       COUNT(s.id) as usage 
                FROM custom_subjects cs 
                LEFT JOIN students s ON cs.name = s.subject_area AND s.status = 'active'
                GROUP BY cs.id, cs.name, cs.description, cs.priority, cs.created_at
                ORDER BY cs.priority DESC, cs.name
            `;
            
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async addCustomSubject(subjectData) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = 'INSERT INTO custom_subjects (name, description, priority) VALUES (?, ?, ?)';
            
            this.db.run(query, [
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

    async deleteCustomSubject(subjectId) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM custom_subjects WHERE id = ?', [subjectId], function(err) {
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

    async checkSubjectUsage(subjectId) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            // Primero obtener el nombre de la materia
            this.db.get('SELECT name FROM custom_subjects WHERE id = ?', [subjectId], (err, subjectRow) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!subjectRow) {
                    resolve({ inUse: false, subjectName: 'Desconocida', studentCount: 0 });
                    return;
                }

                // Verificar cuántos estudiantes usan esta materia
                this.db.get(
                    'SELECT COUNT(*) as count FROM students WHERE subject_area = ? AND status = "active"',
                    [subjectRow.name],
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
    async deleteMultipleSubjects(subjectIds) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
                reject(new Error('subjectIds debe ser un array no vacío'));
                return;
            }
            
            console.log('🗑️ Database: Eliminando materias con IDs:', subjectIds);
            
            // Crear placeholders para la consulta (?, ?, ?, ...)
            const placeholders = subjectIds.map(() => '?').join(',');
            const query = `DELETE FROM custom_subjects WHERE id IN (${placeholders})`;
            
            console.log('📝 Query SQL:', query);
            console.log('📝 Parámetros:', subjectIds);
            
            this.db.run(query, subjectIds, function(err) {
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
    // Asignar múltiples materias a un grado
    async assignSubjectsToGrade(gradeData) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const { gradeName, subjects, teacherName } = gradeData;
            
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
                        `INSERT OR REPLACE INTO grade_subjects (grade_name, subject_name, teacher_name, is_active) 
                        VALUES (?, ?, ?, 1)`,
                        [gradeName, subject, teacherName || null],
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
    // Asignar materias a múltiples grados
    async assignSubjectsToMultipleGrades(assignmentData) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const { grades, subjects, teacherName } = assignmentData;
            
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
                            `INSERT OR REPLACE INTO grade_subjects (grade_name, subject_name, teacher_name, is_active) 
                            VALUES (?, ?, ?, 1)`,
                            [gradeName, subject, teacherName || null],
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
    async getSubjectsByGrade(gradeName) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM grade_subjects WHERE grade_name = ? AND is_active = 1 ORDER BY subject_name',
                [gradeName],
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

    // Obtener todos los grados con sus materias
    async getAllGradesWithSubjects() {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT g.name as grade_name, 
                        GROUP_CONCAT(gs.subject_name) as subjects,
                        COUNT(gs.subject_name) as subject_count
                 FROM grades g
                 LEFT JOIN grade_subjects gs ON g.name = gs.grade_name AND gs.is_active = 1
                 GROUP BY g.name
                 ORDER BY g.name`,
                [],
                (err, rows) => {
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
                }
            );
        });
    }

    // Eliminar asignación de materia a grado
    async removeSubjectFromGrade(gradeName, subjectName) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM grade_subjects WHERE grade_name = ? AND subject_name = ?',
                [gradeName, subjectName],
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
    async getAttendanceByDate(date, grade, subject = null) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            let query = `
                SELECT a.*, s.first_name, s.first_surname, s.second_surname, s.student_id as student_code
                FROM attendance a
                INNER JOIN students s ON a.student_id = s.id
                WHERE a.date = ? AND a.grade_level = ? AND s.status = 'active'
            `;
            
            const params = [date, grade];
            
            if (subject) {
                query += ' AND a.subject_area = ?';
                params.push(subject);
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
            `;
            
            const checkParams = [
                attendanceData.student_id,
                attendanceData.date,
                attendanceData.grade_level,
                attendanceData.subject_area
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
                            student_id, date, status, arrival_time, justification,
                            notes, lesson_number, grade_level, subject_area
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    
                    const insertParams = [
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

    async deleteAttendanceByDate(date, grade, subject = null) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            let query = 'DELETE FROM attendance WHERE date = ? AND grade_level = ?';
            const params = [date, grade];
            
            if (subject) {
                query += ' AND subject_area = ?';
                params.push(subject);
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
    // FUNCIONES DE TAREAS (CORREGIDAS)
    // ========================================
    async getTasksByGradeAndSubject(grade, subject) {
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
                    END) as avg_grade
                FROM assignments a
                LEFT JOIN assignment_grades ag ON a.id = ag.assignment_id
                WHERE a.grade_level = ? AND a.subject_area = ?
                GROUP BY a.id, a.title, a.description, a.due_date, a.max_points, a.percentage, a.grade_level, a.subject_area, a.created_at
                ORDER BY a.created_at DESC
            `;
            
            console.log('🔍 Query tareas:', { grade, subject });
            
            this.db.all(query, [grade, subject], (err, rows) => {
                if (err) {
                    console.error('❌ Error en getTasksByGradeAndSubject:', err);
                    reject(err);
                } else {
                    console.log('✅ Tareas encontradas:', rows.length);
                    resolve(rows || []);
                }
            });
        });
    }

    async createTask(taskData) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            console.log('📝 Creando tarea en BD:', taskData);
            
            const query = `
                INSERT INTO assignments (
                    title, description, due_date, max_points, percentage,
                    grade_level, subject_area
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            const values = [
                taskData.title,
                taskData.description || null,
                taskData.due_date || null,
                taskData.max_points || 100,
                taskData.percentage || 10,
                taskData.grade_level,
                taskData.subject_area
            ];
            
            console.log('📊 Valores para insertar:', values);
            
            this.db.run(query, values, function(err) {
                if (err) {
                    console.error('❌ Error insertando tarea:', err);
                    reject(err);
                } else {
                    console.log('✅ Tarea creada con ID:', this.lastID);
                    resolve({ 
                        id: this.lastID, 
                        changes: this.changes,
                        task: {
                            id: this.lastID,
                            ...taskData
                        }
                    });
                }
            });
        });
    }

    async updateTask(taskId, taskData) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE assignments SET 
                    title = ?, description = ?, due_date = ?,
                    max_points = ?, percentage = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            
            const values = [
                taskData.title,
                taskData.description || null,
                taskData.due_date || null,
                taskData.max_points || 100,
                taskData.percentage || 10,
                taskId
            ];
            
            this.db.run(query, values, function(err) {
                if (err) {
                    console.error('❌ Error actualizando tarea:', err);
                    reject(err);
                } else {
                    console.log('✅ Tarea actualizada:', taskId);
                    resolve({ 
                        id: taskId, 
                        changes: this.changes 
                    });
                }
            });
        });
    }

    async deleteTask(taskId) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');
                
                // Eliminar calificaciones primero
                this.db.run('DELETE FROM assignment_grades WHERE assignment_id = ?', [taskId], (err) => {
                    if (err) {
                        this.db.run('ROLLBACK');
                        console.error('❌ Error eliminando calificaciones:', err);
                        reject(err);
                        return;
                    }
                    
                    // Eliminar tarea
                    this.db.run('DELETE FROM assignments WHERE id = ?', [taskId], function(err) {
                        if (err) {
                            this.db.run('ROLLBACK');
                            console.error('❌ Error eliminando tarea:', err);
                            reject(err);
                        } else {
                            this.db.run('COMMIT', (err) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    console.log('✅ Tarea eliminada:', taskId);
                                    resolve({ 
                                        id: taskId, 
                                        changes: this.changes 
                                    });
                                }
                            });
                        }
                    });
                });
            });
        });
    }

    // ========================================
    // FUNCIONES DE CALIFICACIONES DE TAREAS (CORREGIDAS)
    // ========================================
    async getTaskGrades(taskId) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    ag.*,
                    s.first_name,
                    s.first_surname,
                    s.second_surname,
                    s.student_id as student_code,
                    a.max_points,
                    CASE 
                        WHEN ag.points_earned IS NOT NULL AND a.max_points > 0 
                        THEN ROUND((ag.points_earned * 100.0 / a.max_points), 1)
                        ELSE 0 
                    END as percentage
                FROM assignment_grades ag
                INNER JOIN students s ON ag.student_id = s.id
                INNER JOIN assignments a ON ag.assignment_id = a.id
                WHERE ag.assignment_id = ? AND s.status = 'active'
                ORDER BY s.first_surname, s.second_surname, s.first_name
            `;
            
            this.db.all(query, [taskId], (err, rows) => {
                if (err) {
                    console.error('❌ Error obteniendo calificaciones:', err);
                    reject(err);
                } else {
                    console.log('✅ Calificaciones encontradas:', rows.length);
                    resolve(rows || []);
                }
            });
        });
    }

    async saveTaskGrades(grades) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            if (!grades || grades.length === 0) {
                resolve({ savedCount: 0, errorCount: 0 });
                return;
            }
            
            console.log('💾 Guardando calificaciones:', grades.length);
            
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');
                
                let savedCount = 0;
                let errorCount = 0;
                let completedOperations = 0;
                
                grades.forEach((grade, index) => {
                    const checkQuery = `
                        SELECT id FROM assignment_grades 
                        WHERE assignment_id = ? AND student_id = ?
                    `;
                    
                    this.db.get(checkQuery, [grade.task_id, grade.student_id], (err, existing) => {
                        if (err) {
                            errorCount++;
                            completedOperations++;
                            console.error(`❌ Error verificando calificación para estudiante ${grade.student_id}:`, err);
                            checkCompletion();
                            return;
                        }
                        
                        if (existing) {
                            // Actualizar existente
                            const updateQuery = `
                                UPDATE assignment_grades SET 
                                    points_earned = ?, notes = ?,
                                    submitted_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `;
                            
                            this.db.run(updateQuery, [
                                grade.points_earned,
                                grade.notes || null,
                                existing.id
                            ], function(err) {
                                if (!err) {
                                    savedCount++;
                                    console.log(`✅ Calificación actualizada para estudiante ${grade.student_id}`);
                                } else {
                                    errorCount++;
                                    console.error(`❌ Error actualizando calificación:`, err);
                                }
                                
                                completedOperations++;
                                checkCompletion();
                            });
                        } else {
                            // Crear nuevo
                            const insertQuery = `
                                INSERT INTO assignment_grades (
                                    assignment_id, student_id, points_earned, notes,
                                    submitted_at
                                ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                            `;
                            
                            this.db.run(insertQuery, [
                                grade.task_id,
                                grade.student_id,
                                grade.points_earned,
                                grade.notes || null
                            ], function(err) {
                                if (!err) {
                                    savedCount++;
                                    console.log(`✅ Nueva calificación creada para estudiante ${grade.student_id}`);
                                } else {
                                    errorCount++;
                                    console.error(`❌ Error creando calificación:`, err);
                                }
                                
                                completedOperations++;
                                checkCompletion();
                            });
                        }
                    });
                });
                
                function checkCompletion() {
                    if (completedOperations === grades.length) {
                        if (errorCount === 0) {
                            this.db.run('COMMIT', (err) => {
                                if (err) {
                                    console.error('❌ Error en commit:', err);
                                    reject(err);
                                } else {
                                    console.log(`✅ Transacción completada: ${savedCount} guardadas, ${errorCount} errores`);
                                    resolve({ savedCount, errorCount });
                                }
                            });
                        } else {
                            this.db.run('ROLLBACK', (err) => {
                                console.log(`⚠️ Rollback ejecutado: ${savedCount} intentos, ${errorCount} errores`);
                                // Aún así devolver resultado parcial
                                resolve({ savedCount: 0, errorCount: errorCount });
                            });
                        }
                    }
                }
            });
        });
    }

    async getStudentTaskStats(studentId, grade, subject) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    COUNT(DISTINCT a.id) as total_tasks,
                    COUNT(ag.id) as completed_tasks,
                    AVG(ag.percentage) as avg_percentage,
                    SUM(a.percentage) as total_weight
                FROM assignments a
                LEFT JOIN assignment_grades ag ON a.id = ag.assignment_id AND ag.student_id = ?
                WHERE a.grade_level = ? AND a.subject_area = ?
            `;
            
            this.db.get(query, [studentId, grade, subject], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row || {
                        total_tasks: 0,
                        completed_tasks: 0,
                        avg_percentage: 0,
                        total_weight: 0
                    });
                }
            });
        });
    }

    // ========================================
    // CÁLCULOS DE ESTADÍSTICAS MEP
    // ========================================
    async calculateMEPAttendanceGrade(studentId, grade, subject = 'general', totalLessons = 200) {
        this.ensureConnection();
        
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    status,
                    COUNT(*) as count
                FROM attendance 
                WHERE student_id = ? AND grade_level = ? AND subject_area = ?
                GROUP BY status
            `;
            
            this.db.all(query, [studentId, grade, subject], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                
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
                
                // Convertir a escala 0-5 (nota final = nota_0_10 * 0.5)
                const notaAsistencia = nota0_10 * 0.5;
                
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
                    calculated_at: new Date().toISOString()
                };
                
                resolve(result);
            });
        });
    }
}





// Crear instancia única
const database = new Database();

module.exports = database;