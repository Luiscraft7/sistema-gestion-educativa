const express = require('express');
const path = require('path');
const cors = require('cors');
const database = require('./src/models/database');

const app = express();
const PORT = 3000;

// ========================================
// MIDDLEWARES
// ========================================
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ========================================
// INICIALIZACIÓN DE BASE DE DATOS
// ========================================
async function initializeDatabase() {
    try {
        console.log('🔄 Inicializando base de datos...');
        
        // ✅ ASEGURAR QUE LA INICIALIZACIÓN SE COMPLETE
        await database.initialize();
        
        // ✅ VERIFICAR QUE LA CONEXIÓN ESTÉ LISTA
        if (!database.db || !database.isInitialized) {
            throw new Error('Base de datos no se inicializó correctamente');
        }
        
        console.log('✅ Base de datos lista para usar');
        console.log('🔍 Estado de la conexión:', {
            hasDb: !!database.db,
            isInitialized: database.isInitialized
        });
        
    } catch (error) {
        console.error('❌ Error inicializando base de datos:', error);
        process.exit(1);
    }
}

// ========================================
// RUTA PRINCIPAL
// ========================================
app.get('/', (req, res) => {
    res.redirect('/index.html');
});

// ========================================
// RUTAS API PARA ESTUDIANTES
// ========================================

// Obtener todos los estudiantes
app.get('/api/students', async (req, res) => {
    try {
        const students = await database.getAllStudents();
        res.json({
            success: true,
            data: students,
            message: `${students.length} estudiantes encontrados`
        });
    } catch (error) {
        console.error('Error obteniendo estudiantes:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estudiantes',
            error: error.message
        });
    }
});

// Obtener estudiante por ID
app.get('/api/students/:id', async (req, res) => {
    try {
        const student = await database.getStudentById(req.params.id);
        if (student) {
            res.json({
                success: true,
                data: student
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Estudiante no encontrado'
            });
        }
    } catch (error) {
        console.error('Error obteniendo estudiante:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estudiante',
            error: error.message
        });
    }
});

// Agregar nuevo estudiante
app.post('/api/students', async (req, res) => {
    try {
        // ✅ Generar ID automático si no viene especificado
        if (!req.body.student_id) {
            req.body.student_id = await database.getNextStudentId();
            console.log(`🔢 ID generado automáticamente: ${req.body.student_id}`);
        }

        const result = await database.addStudent(req.body);
        res.json({
            success: true,
            data: result,
            message: 'Estudiante agregado correctamente'
        });
    } catch (error) {
        console.error('Error agregando estudiante:', error);
        res.status(500).json({
            success: false,
            message: 'Error agregando estudiante',
            error: error.message
        });
    }
});

// Actualizar estudiante
app.put('/api/students/:id', async (req, res) => {
    try {
        const result = await database.updateStudent(req.params.id, req.body);
        res.json({
            success: true,
            data: result,
            message: 'Estudiante actualizado correctamente'
        });
    } catch (error) {
        console.error('Error actualizando estudiante:', error);
        res.status(500).json({
            success: false,
            message: 'Error actualizando estudiante',
            error: error.message
        });
    }
});

// Eliminar estudiante
app.delete('/api/students/:id', async (req, res) => {
    try {
        const result = await database.deleteStudent(req.params.id);
        res.json({
            success: true,
            data: result,
            message: 'Estudiante eliminado correctamente'
        });
    } catch (error) {
        console.error('Error eliminando estudiante:', error);
        res.status(500).json({
            success: false,
            message: 'Error eliminando estudiante',
            error: error.message
        });
    }
});

// ========================================
// RUTAS API PARA GRADOS
// ========================================

// Obtener todos los grados
app.get('/api/grades', async (req, res) => {
    try {
        const grades = await database.getAllGrades();
        res.json({
            success: true,
            data: grades
        });
    } catch (error) {
        console.error('Error obteniendo grados:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo grados',
            error: error.message
        });
    }
});

// Agregar nuevo grado
app.post('/api/grades', async (req, res) => {
    try {
        const result = await database.addGrade(req.body);
        res.json({
            success: true,
            data: result,
            message: 'Grado agregado correctamente'
        });
    } catch (error) {
        console.error('Error agregando grado:', error);
        res.status(500).json({
            success: false,
            message: 'Error agregando grado',
            error: error.message
        });
    }
});

// Eliminar grado
app.delete('/api/grades/:id', async (req, res) => {
    try {
        const usageCheck = await database.checkGradeUsage(req.params.id);
        
        if (usageCheck.inUse) {
            return res.status(400).json({
                success: false,
                message: `No se puede eliminar el grado "${usageCheck.gradeName}" porque está siendo usado por ${usageCheck.studentCount} estudiante(s).`,
                inUse: true,
                studentCount: usageCheck.studentCount
            });
        }

        const result = await database.deleteGrade(req.params.id);
        res.json({
            success: true,
            data: result,
            message: 'Grado eliminado correctamente'
        });
    } catch (error) {
        console.error('Error eliminando grado:', error);
        res.status(500).json({
            success: false,
            message: 'Error eliminando grado',
            error: error.message
        });
    }
});

// ========================================
// RUTAS API PARA MATERIAS
// ========================================

// Obtener todas las materias (BD)
app.get('/api/subjects', async (req, res) => {
    try {
        const subjects = await database.getAllSubjects();
        res.json({
            success: true,
            data: subjects,
            message: `${subjects.length} materias encontradas`
        });
    } catch (error) {
        console.error('Error obteniendo materias:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo materias',
            error: error.message
        });
    }
});

// Obtener todas las materias personalizadas (hardcoded)
app.get('/api/custom-subjects', async (req, res) => {
    try {
        const subjects = await database.getAllCustomSubjects();
        res.json({
            success: true,
            data: subjects
        });
    } catch (error) {
        console.error('Error obteniendo materias:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo materias',
            error: error.message
        });
    }
});

// Agregar nueva materia personalizada
app.post('/api/custom-subjects', async (req, res) => {
    try {
        const result = await database.addCustomSubject(req.body);
        res.json({
            success: true,
            data: result,
            message: 'Materia agregada correctamente'
        });
    } catch (error) {
        console.error('Error agregando materia:', error);
        res.status(500).json({
            success: false,
            message: 'Error agregando materia',
            error: error.message
        });
    }
});

// Eliminar materia personalizada
app.delete('/api/custom-subjects/:id', async (req, res) => {
    try {
        const usageCheck = await database.checkSubjectUsage(req.params.id);
        
        if (usageCheck.inUse) {
            return res.status(400).json({
                success: false,
                message: `No se puede eliminar la materia "${usageCheck.subjectName}" porque está siendo usada por ${usageCheck.studentCount} estudiante(s).`,
                inUse: true,
                studentCount: usageCheck.studentCount
            });
        }

        const result = await database.deleteCustomSubject(req.params.id);
        res.json({
            success: true,
            data: result,
            message: 'Materia eliminada correctamente'
        });
    } catch (error) {
        console.error('Error eliminando materia:', error);
        res.status(500).json({
            success: false,
            message: 'Error eliminando materia',
            error: error.message
        });
    }
});

// ========================================
// RUTAS API PARA ASISTENCIAS
// ========================================

// Obtener asistencia por fecha y grado
app.get('/api/attendance', async (req, res) => {
    try {
        const { date, grade, subject } = req.query;
        
        console.log('📊 GET /api/attendance:', { date, grade, subject });
        
        if (!date || !grade) {
            return res.status(400).json({
                success: false,
                message: 'Fecha y grado son requeridos'
            });
        }
        
        const attendance = await database.getAttendanceByDate(date, grade, subject);
        res.json({
            success: true,
            data: attendance,
            message: `${attendance.length} registros de asistencia encontrados`
        });
    } catch (error) {
        console.error('❌ Error obteniendo asistencia:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo asistencia',
            error: error.message
        });
    }
});

// Marcar o actualizar asistencia
app.post('/api/attendance', async (req, res) => {
    try {
        console.log('📝 POST /api/attendance:', req.body);
        
        const result = await database.saveAttendance(req.body);
        res.json({
            success: true,
            data: result,
            message: 'Asistencia guardada correctamente'
        });
    } catch (error) {
        console.error('❌ Error guardando asistencia:', error);
        res.status(500).json({
            success: false,
            message: 'Error guardando asistencia',
            error: error.message
        });
    }
});

// Eliminar asistencia de un día específico
app.delete('/api/attendance', async (req, res) => {
    try {
        const { date, grade, subject } = req.query;
        
        console.log('🗑️ DELETE /api/attendance:', { date, grade, subject });
        
        if (!date || !grade) {
            return res.status(400).json({
                success: false,
                message: 'Fecha y grado son requeridos'
            });
        }
        
        const result = await database.deleteAttendanceByDate(date, grade, subject);
        res.json({
            success: true,
            data: result,
            message: 'Asistencia eliminada correctamente'
        });
    } catch (error) {
        console.error('❌ Error eliminando asistencia:', error);
        res.status(500).json({
            success: false,
            message: 'Error eliminando asistencia',
            error: error.message
        });
    }
});

// ========================================
// ESTADÍSTICAS MEP - ENDPOINTS CORREGIDOS ✅
// ========================================

// Obtener estadísticas de asistencia de un estudiante (MEJORADO)
app.get('/api/attendance/stats/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        const { grade, subject, totalLessons } = req.query;
        
        console.log('📊 Calculando estadísticas MEP para:', { studentId, grade, subject, totalLessons });
        
        if (!grade) {
            return res.status(400).json({
                success: false,
                message: 'Parámetro grade es requerido'
            });
        }
        
        // ✅ VERIFICAR ESTADO DE LA BASE DE DATOS
        if (!database.db || !database.isInitialized) {
            console.error('❌ Base de datos no está inicializada');
            return res.status(500).json({
                success: false,
                message: 'Base de datos no está disponible',
                debug: {
                    hasDb: !!database.db,
                    isInitialized: database.isInitialized
                }
            });
        }
        
        // ✅ LLAMAR A LA FUNCIÓN CON MANEJO DE ERRORES MEJORADO
        console.log('🔄 Llamando a calculateMEPAttendanceGrade...');
        
        const mepGrade = await database.calculateMEPAttendanceGrade(
            parseInt(studentId), 
            grade, 
            subject || 'general', 
            parseInt(totalLessons) || 200
        );
        
        console.log('✅ Estadísticas MEP calculadas exitosamente');
        
        res.json({
            success: true,
            data: mepGrade
        });
        
    } catch (error) {
        console.error('❌ Error completo en estadísticas MEP:', {
            message: error.message,
            stack: error.stack,
            studentId: req.params.studentId,
            query: req.query
        });
        
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estadísticas de asistencia',
            error: error.message
        });
    }
});

// Obtener estadísticas de toda la clase
app.get('/api/attendance/class-stats', async (req, res) => {
    try {
        const { grade, subject, totalLessons } = req.query;
        
        console.log('📊 Calculando estadísticas de clase para:', { grade, subject, totalLessons });
        
        if (!grade) {
            return res.status(400).json({
                success: false,
                message: 'Parámetro grade es requerido'
            });
        }
        
        // Obtener estudiantes del grado
        const students = await database.getAllStudents();
        const gradeStudents = students.filter(s => 
            s.grade_level === grade && 
            s.status === 'active' &&
            (!subject || s.subject_area === subject)
        );
        
        console.log(`👥 Estudiantes encontrados: ${gradeStudents.length}`);
        
        // Calcular estadísticas para cada estudiante
        const classStats = await Promise.all(
            gradeStudents.map(async (student) => {
                const mepGrade = await database.calculateMEPAttendanceGrade(
                    student.id, 
                    grade, 
                    subject || 'general', 
                    parseInt(totalLessons) || 200
                );
                return {
                    ...student,
                    mep_stats: mepGrade
                };
            })
        );
        
        const summary = {
            total_students: classStats.length,
            average_attendance: classStats.reduce((sum, s) => sum + s.mep_stats.attendance_percentage, 0) / classStats.length,
            average_grade: classStats.reduce((sum, s) => sum + s.mep_stats.nota_asistencia, 0) / classStats.length
        };
        
        console.log('✅ Estadísticas de clase calculadas:', summary);
        
        res.json({
            success: true,
            data: classStats,
            summary: summary
        });
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas de clase:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estadísticas de clase',
            error: error.message
        });
    }
});

// ========================================
// RUTAS API PARA CONFIGURACIÓN DE LECCIONES
// ========================================

// Obtener configuración de lecciones
app.get('/api/lesson-config', async (req, res) => {
    try {
        const { grade, subject } = req.query;
        
        if (!grade) {
            return res.status(400).json({
                success: false,
                message: 'Grado es requerido'
            });
        }
        
        const config = await database.getLessonConfig(grade, subject || 'general');
        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error('❌ Error obteniendo configuración de lecciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo configuración',
            error: error.message
        });
    }
});

// Guardar configuración de lecciones
app.post('/api/lesson-config', async (req, res) => {
    try {
        console.log('⚙️ POST /api/lesson-config:', req.body);
        
        const result = await database.saveLessonConfig(req.body);
        res.json({
            success: true,
            data: result,
            message: 'Configuración guardada correctamente'
        });
    } catch (error) {
        console.error('❌ Error guardando configuración de lecciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error guardando configuración',
            error: error.message
        });
    }
});



// ========================================
// AGREGAR ESTOS ENDPOINTS AL FINAL DE server.js (después de los existentes)
// ========================================

// ========================================
// RUTAS API PARA ASIGNACIÓN GRADOS-MATERIAS
// ========================================

// Asignar múltiples materias a un grado
app.post('/api/grade-subjects/assign', async (req, res) => {
    try {
        console.log('📚 POST /api/grade-subjects/assign:', req.body);
        
        const { gradeName, subjects, teacherName } = req.body;
        
        if (!gradeName || !subjects || !Array.isArray(subjects) || subjects.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Grado y materias son requeridos'
            });
        }
        
        const result = await database.assignSubjectsToGrade(req.body);
        res.json({
            success: true,
            data: result,
            message: result.message
        });
    } catch (error) {
        console.error('❌ Error asignando materias a grado:', error);
        res.status(500).json({
            success: false,
            message: 'Error asignando materias',
            error: error.message
        });
    }
});

// Asignar materias a múltiples grados
app.post('/api/grade-subjects/assign-multiple', async (req, res) => {
    try {
        console.log('📚 POST /api/grade-subjects/assign-multiple:', req.body);
        
        const { grades, subjects, teacherName } = req.body;
        
        if (!grades || !Array.isArray(grades) || grades.length === 0 ||
            !subjects || !Array.isArray(subjects) || subjects.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Grados y materias son requeridos'
            });
        }
        
        const result = await database.assignSubjectsToMultipleGrades(req.body);
        res.json({
            success: true,
            data: result,
            message: result.message
        });
    } catch (error) {
        console.error('❌ Error asignando materias a múltiples grados:', error);
        res.status(500).json({
            success: false,
            message: 'Error asignando materias',
            error: error.message
        });
    }
});

// Obtener materias de un grado
app.get('/api/grade-subjects/:gradeName', async (req, res) => {
    try {
        const { gradeName } = req.params;
        
        console.log('📖 GET /api/grade-subjects/' + gradeName);
        
        const subjects = await database.getSubjectsByGrade(gradeName);
        res.json({
            success: true,
            data: subjects,
            gradeName: gradeName,
            message: `${subjects.length} materias encontradas para ${gradeName}`
        });
    } catch (error) {
        console.error('❌ Error obteniendo materias del grado:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo materias',
            error: error.message
        });
    }
});

// Obtener todos los grados con sus materias
app.get('/api/grade-subjects', async (req, res) => {
    try {
        console.log('📚 GET /api/grade-subjects');
        
        const gradesWithSubjects = await database.getAllGradesWithSubjects();
        res.json({
            success: true,
            data: gradesWithSubjects,
            message: `${gradesWithSubjects.length} grados con materias obtenidos`
        });
    } catch (error) {
        console.error('❌ Error obteniendo grados con materias:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo datos',
            error: error.message
        });
    }
});

// Eliminar materia de un grado
app.delete('/api/grade-subjects/:gradeName/:subjectName', async (req, res) => {
    try {
        const { gradeName, subjectName } = req.params;
        
        console.log(`🗑️ DELETE /api/grade-subjects/${gradeName}/${subjectName}`);
        
        const result = await database.removeSubjectFromGrade(gradeName, subjectName);
        res.json({
            success: true,
            data: result,
            message: result.message
        });
    } catch (error) {
        console.error('❌ Error eliminando materia del grado:', error);
        res.status(500).json({
            success: false,
            message: 'Error eliminando asignación',
            error: error.message
        });
    }
});

// ========================================
// RUTAS PARA ELIMINACIÓN MASIVA
// ========================================

// Eliminar múltiples grados
app.delete('/api/grades/bulk', async (req, res) => {
    try {
        const { gradeIds } = req.body;
        
        console.log('🗑️ DELETE /api/grades/bulk:', gradeIds);
        
        if (!gradeIds || !Array.isArray(gradeIds) || gradeIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Array de IDs de grados es requerido'
            });
        }
        
        // Verificar uso de cada grado antes de eliminar
        const usageChecks = await Promise.all(
            gradeIds.map(id => database.checkGradeUsage(id))
        );
        
        const inUseGrades = usageChecks.filter(check => check.inUse);
        
        if (inUseGrades.length > 0) {
            const inUseNames = inUseGrades.map(g => `"${g.gradeName}" (${g.studentCount} estudiantes)`);
            return res.status(400).json({
                success: false,
                message: `No se pueden eliminar los siguientes grados porque están siendo usados:\n${inUseNames.join('\n')}`,
                inUseGrades: inUseGrades
            });
        }
        
        const result = await database.deleteMultipleGrades(gradeIds);
        res.json({
            success: true,
            data: result,
            message: result.message
        });
    } catch (error) {
        console.error('❌ Error eliminando grados:', error);
        res.status(500).json({
            success: false,
            message: 'Error eliminando grados',
            error: error.message
        });
    }
});

// Eliminar múltiples materias
app.delete('/api/custom-subjects/bulk', async (req, res) => {
    try {
        const { subjectIds } = req.body;
        
        console.log('🗑️ DELETE /api/custom-subjects/bulk:', subjectIds);
        
        if (!subjectIds || !Array.isArray(subjectIds) || subjectIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Array de IDs de materias es requerido'
            });
        }
        
        // Verificar uso de cada materia antes de eliminar
        const usageChecks = await Promise.all(
            subjectIds.map(id => database.checkSubjectUsage(id))
        );
        
        const inUseSubjects = usageChecks.filter(check => check.inUse);
        
        if (inUseSubjects.length > 0) {
            const inUseNames = inUseSubjects.map(s => `"${s.subjectName}" (${s.studentCount} estudiantes)`);
            return res.status(400).json({
                success: false,
                message: `No se pueden eliminar las siguientes materias porque están siendo usadas:\n${inUseNames.join('\n')}`,
                inUseSubjects: inUseSubjects
            });
        }
        
        const result = await database.deleteMultipleSubjects(subjectIds);
        res.json({
            success: true,
            data: result,
            message: result.message
        });
    } catch (error) {
        console.error('❌ Error eliminando materias:', error);
        res.status(500).json({
            success: false,
            message: 'Error eliminando materias',
            error: error.message
        });
    }
});


// ========================================
// ENDPOINTS DE DEBUG Y DIAGNÓSTICO
// ========================================

// Debug: Verificar conexión a base de datos
app.get('/api/debug/connection', async (req, res) => {
    try {
        const connectionStatus = {
            hasDatabase: !!database.db,
            isInitialized: database.isInitialized,
            canExecuteQuery: false
        };
        
        // Test simple de conexión
        if (database.db && database.isInitialized) {
            try {
                await new Promise((resolve, reject) => {
                    database.db.get('SELECT 1 as test', [], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });
                connectionStatus.canExecuteQuery = true;
            } catch (error) {
                console.error('❌ Error en test de conexión:', error);
            }
        }
        
        res.json({
            success: true,
            connection: connectionStatus,
            message: connectionStatus.canExecuteQuery ? 'Conexión OK' : 'Conexión con problemas'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Debug: Verificar módulo database
app.get('/api/debug/database', (req, res) => {
    try {
        const debug = {
            databaseType: typeof database,
            hasCalculateFunction: typeof database.calculateMEPAttendanceGrade === 'function',
            availableMethods: Object.getOwnPropertyNames(database),
            prototypeMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(database)),
            hasDbConnection: !!database.db,
            isInitialized: database.isInitialized
        };
        
        console.log('🐛 Debug database info:', debug);
        
        res.json({
            success: true,
            debug: debug
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Debug: Información de asistencia
app.get('/api/debug/attendance/:date/:grade', async (req, res) => {
    try {
        const { date, grade } = req.params;
        
        console.log('🐛 DEBUG: Verificando asistencia para:', { date, grade });
        
        // Obtener estudiantes del grado
        const students = await database.getAllStudents();
        const gradeStudents = students.filter(s => s.grade_level === grade && s.status === 'active');
        
        // Obtener asistencia
        const attendance = await database.getAttendanceByDate(date, grade);
        
        // Mostrar debug info
        const debugInfo = {
            date: date,
            grade: grade,
            studentsInGrade: gradeStudents.length,
            attendanceRecords: attendance.length,
            students: gradeStudents.map(s => ({
                id: s.id,
                name: `${s.first_name} ${s.first_surname}`,
                student_id: s.student_id
            })),
            attendance: attendance.map(a => ({
                student_id: a.student_id,
                status: a.status,
                student_name: `${a.first_name} ${a.first_surname}`
            }))
        };
        
        console.log('🐛 DEBUG INFO:', JSON.stringify(debugInfo, null, 2));
        
        res.json({
            success: true,
            debug: debugInfo
        });
    } catch (error) {
        console.error('❌ Error en debug:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Debug: Registros de asistencia de estudiante específico
app.get('/api/debug/student-attendance/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        const { grade, subject } = req.query;
        
        if (!database.db) {
            return res.status(500).json({ 
                success: false, 
                error: 'Base de datos no disponible' 
            });
        }
        
        const query = `
            SELECT * FROM attendance 
            WHERE student_id = ? AND grade_level = ? AND subject_area = ?
            ORDER BY date DESC
        `;
        
        database.db.all(query, [parseInt(studentId), grade, subject || 'general'], (err, rows) => {
            if (err) {
                res.status(500).json({ success: false, error: err.message });
            } else {
                res.json({
                    success: true,
                    student_id: studentId,
                    grade: grade,
                    subject: subject || 'general',
                    total_records: rows.length,
                    records: rows
                });
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


// En server.js - AGREGAR este endpoint de debug
app.get('/api/debug/subjects/:id', async (req, res) => {
    try {
        const subjectId = req.params.id;
        
        // Verificar si la materia existe
        const checkQuery = 'SELECT * FROM custom_subjects WHERE id = ?';
        
        database.db.get(checkQuery, [subjectId], async (err, subject) => {
            if (err) {
                return res.status(500).json({ success: false, error: err.message });
            }
            
            if (!subject) {
                return res.json({ 
                    success: true, 
                    exists: false, 
                    message: 'Materia no encontrada' 
                });
            }
            
            // Verificar uso de la materia
            const usageQuery = 'SELECT COUNT(*) as count FROM students WHERE subject_area = ? AND status = "active"';
            
            database.db.get(usageQuery, [subject.name], (err, usageResult) => {
                if (err) {
                    return res.status(500).json({ success: false, error: err.message });
                }
                
                res.json({
                    success: true,
                    exists: true,
                    subject: subject,
                    usage: usageResult.count,
                    canDelete: usageResult.count === 0
                });
            });
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// RUTAS API PARA TAREAS
// ========================================

// Obtener tareas por grado y materia
app.get('/api/tasks', async (req, res) => {
    try {
        const { grade, subject } = req.query;
        
        if (!grade || !subject) {
            return res.status(400).json({
                success: false,
                message: 'Grado y materia son requeridos'
            });
        }
        
        console.log('📝 GET /api/tasks:', { grade, subject });
        
        const tasks = await database.getTasksByGradeAndSubject(grade, subject);
        res.json({
            success: true,
            data: tasks,
            message: `${tasks.length} tareas encontradas`
        });
    } catch (error) {
        console.error('❌ Error obteniendo tareas:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo tareas',
            error: error.message
        });
    }
});

// Crear nueva tarea
app.post('/api/tasks', async (req, res) => {
    try {
        console.log('📝 POST /api/tasks:', req.body);
        
        const result = await database.createTask(req.body);
        res.json({
            success: true,
            data: result,
            message: 'Tarea creada correctamente'
        });
    } catch (error) {
        console.error('❌ Error creando tarea:', error);
        res.status(500).json({
            success: false,
            message: 'Error creando tarea',
            error: error.message
        });
    }
});

// Actualizar tarea
app.put('/api/tasks/:id', async (req, res) => {
    try {
        console.log('📝 PUT /api/tasks/' + req.params.id + ':', req.body);
        
        const result = await database.updateTask(req.params.id, req.body);
        res.json({
            success: true,
            data: result,
            message: 'Tarea actualizada correctamente'
        });
    } catch (error) {
        console.error('❌ Error actualizando tarea:', error);
        res.status(500).json({
            success: false,
            message: 'Error actualizando tarea',
            error: error.message
        });
    }
});

// Eliminar tarea
app.delete('/api/tasks/:id', async (req, res) => {
    try {
        console.log('🗑️ DELETE /api/tasks/' + req.params.id);
        
        const result = await database.deleteTask(req.params.id);
        res.json({
            success: true,
            data: result,
            message: 'Tarea eliminada correctamente'
        });
    } catch (error) {
        console.error('❌ Error eliminando tarea:', error);
        res.status(500).json({
            success: false,
            message: 'Error eliminando tarea',
            error: error.message
        });
    }
});

// ========================================
// RUTAS API PARA CALIFICACIONES DE TAREAS
// ========================================

// Obtener calificaciones de una tarea
app.get('/api/task-grades/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        
        console.log('📊 GET /api/task-grades/' + taskId);
        
        const grades = await database.getTaskGrades(taskId);
        res.json({
            success: true,
            data: grades,
            message: `${grades.length} calificaciones encontradas`
        });
    } catch (error) {
        console.error('❌ Error obteniendo calificaciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo calificaciones',
            error: error.message
        });
    }
});

// Guardar calificaciones de tarea
app.post('/api/task-grades', async (req, res) => {
    try {
        const { grades } = req.body;
        
        if (!grades || !Array.isArray(grades)) {
            return res.status(400).json({
                success: false,
                message: 'Array de calificaciones es requerido'
            });
        }
        
        console.log('💾 POST /api/task-grades:', grades.length, 'calificaciones');
        
        const result = await database.saveTaskGrades(grades);
        res.json({
            success: true,
            data: result,
            message: `${result.savedCount} calificaciones guardadas correctamente`
        });
    } catch (error) {
        console.error('❌ Error guardando calificaciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error guardando calificaciones',
            error: error.message
        });
    }
});

// Obtener estadísticas de tareas por estudiante
app.get('/api/task-stats/student/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        const { grade, subject } = req.query;
        
        console.log('📈 GET /api/task-stats/student/' + studentId);
        
        const stats = await database.getStudentTaskStats(studentId, grade, subject);
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estadísticas',
            error: error.message
        });
    }
});


// ========================================
// INICIAR SERVIDOR
// ========================================
async function startServer() {
    try {
        // Primero inicializar la base de datos
        await initializeDatabase();
        
        // Después iniciar el servidor
        app.listen(PORT, () => {
            console.log('🚀 Servidor corriendo en http://localhost:' + PORT);
            console.log('📊 API disponible en /api/students, /api/subjects, /api/attendance');
            console.log('🐛 Debug endpoints: /api/debug/connection, /api/debug/database');
        });
    } catch (error) {
        console.error('❌ Error iniciando servidor:', error);
    }
}

// Iniciar todo
startServer();

// Cerrar base de datos al terminar el proceso
process.on('SIGINT', () => {
    console.log('🔄 Cerrando servidor...');
    database.close();
    process.exit(0);
});