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

// Guardar escala máxima de notas
app.put('/api/grade-scale', async (req, res) => {
    try {
        const { grade, subject, maxScale } = req.body;
        
        if (!grade || !subject || maxScale === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Grado, materia y escala máxima son requeridos'
            });
        }
        
        if (maxScale <= 0 || maxScale > 100) {
            return res.status(400).json({
                success: false,
                message: 'La escala debe estar entre 0.1 y 100'
            });
        }
        
        await database.saveGradeScale(grade, subject, maxScale);
        
        res.json({
            success: true,
            message: 'Escala de notas guardada correctamente'
        });
    } catch (error) {
        console.error('Error guardando escala:', error);
        res.status(500).json({
            success: false,
            message: 'Error guardando escala',
            error: error.message
        });
    }
});

// Obtener escala máxima actual
app.get('/api/grade-scale', async (req, res) => {
    try {
        const { grade, subject } = req.query;
        
        if (!grade || !subject) {
            return res.status(400).json({
                success: false,
                message: 'Grado y materia son requeridos'
            });
        }
        
        const maxScale = await database.getGradeScale(grade, subject);
        
        res.json({
            success: true,
            max_scale: maxScale
        });
    } catch (error) {
        res.status(500).json({
            success: false,
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
            average_grade: classStats.reduce((sum, s) => sum + s.mep_stats.nota_asistencia, 0) / classStats.length,
            max_scale: classStats.length > 0 ? classStats[0].mep_stats.max_scale || 5.0 : 5.0  // ✅ AGREGAR ESTA LÍNEA
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

// Contar lecciones reales dadas
app.get('/api/attendance/lesson-count', async (req, res) => {
    try {
        const { grade } = req.query;
        
        if (!grade) {
            return res.status(400).json({
                success: false,
                message: 'Grado es requerido'
            });
        }
        
        database.ensureConnection();
        
        const query = `
            SELECT COUNT(DISTINCT date) as total_lessons
            FROM attendance 
            WHERE grade_level = ? 
            AND status IN ('present', 'late_justified', 'late_unjustified', 'absent_justified', 'absent_unjustified')
        `;
        
        const result = await new Promise((resolve, reject) => {
            database.db.get(query, [grade], (err, row) => {
                if (err) reject(err);
                else resolve(row || { total_lessons: 0 });
            });
        });
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('❌ Error contando lecciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error contando lecciones',
            error: error.message
        });
    }
});


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
// RUTAS API PARA EVALUACIONES - CORREGIDAS ✅
// ========================================

// Obtener evaluaciones por grado y materia
app.get('/api/evaluations', async (req, res) => {
    try {
        const { grade, subject } = req.query;
        
        if (!grade || !subject) {
            return res.status(400).json({
                success: false,
                message: 'Grado y materia son requeridos'
            });
        }
        
        console.log('📝 GET /api/evaluations:', { grade, subject });
        
        const evaluations = await database.getEvaluationsByGradeAndSubject(grade, subject);
        res.json({
            success: true,
            data: evaluations,
            message: `${evaluations.length} evaluaciones encontradas`
        });
    } catch (error) {
        console.error('❌ Error obteniendo evaluaciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo evaluaciones',
            error: error.message
        });
    }
});

// Crear nueva evaluación
app.post('/api/evaluations', async (req, res) => {
    try {
        console.log('📝 POST /api/evaluations:', req.body);
        
        const result = await database.createEvaluation(req.body);
        res.json({
            success: true,
            data: result,
            message: 'Evaluación creada correctamente'
        });
    } catch (error) {
        console.error('❌ Error creando evaluación:', error);
        res.status(500).json({
            success: false,
            message: 'Error creando evaluación',
            error: error.message
        });
    }
});

// Actualizar evaluación
app.put('/api/evaluations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📝 PUT /api/evaluations/${id}:`, req.body);
        
        const result = await database.updateEvaluation(id, req.body);
        res.json({
            success: true,
            data: result,
            message: 'Evaluación actualizada correctamente'
        });
    } catch (error) {
        console.error('❌ Error actualizando evaluación:', error);
        res.status(500).json({
            success: false,
            message: 'Error actualizando evaluación',
            error: error.message
        });
    }
});

// Eliminar evaluación
app.delete('/api/evaluations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🗑️ DELETE /api/evaluations/${id}`);
        
        const result = await database.deleteEvaluation(id);
        res.json({
            success: true,
            data: result,
            message: 'Evaluación eliminada correctamente'
        });
    } catch (error) {
        console.error('❌ Error eliminando evaluación:', error);
        res.status(500).json({
            success: false,
            message: 'Error eliminando evaluación',
            error: error.message
        });
    }
});

// ========================================
// RUTAS API PARA CALIFICACIONES DE EVALUACIONES - CORREGIDAS ✅
// ========================================

// Obtener calificaciones de una evaluación
app.get('/api/evaluation-grades/:evaluationId', async (req, res) => {
    try {
        const { evaluationId } = req.params;
        console.log('📊 GET /api/evaluation-grades/' + evaluationId);
        
        const grades = await database.getEvaluationGrades(evaluationId);
        res.json({
            success: true,
            data: grades,
            message: `${grades.length} estudiantes encontrados`
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

// Guardar calificaciones de evaluación
app.post('/api/evaluation-grades', async (req, res) => {
    try {
        const { grades } = req.body;
        
        if (!grades || !Array.isArray(grades)) {
            return res.status(400).json({
                success: false,
                message: 'Array de calificaciones es requerido'
            });
        }
        
        console.log('💾 POST /api/evaluation-grades:', grades.length, 'calificaciones');
        
        const result = await database.saveEvaluationGrades(grades);
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

// ========================================
// RUTAS PARA DASHBOARD DE EVALUACIONES - CORREGIDAS ✅
// ========================================

// Resumen general de evaluaciones
app.get('/api/evaluations/summary', async (req, res) => {
    try {
        console.log('📊 GET /api/evaluations/summary');
        
        const summary = await database.getEvaluationsSummary();
        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('❌ Error obteniendo resumen:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo resumen',
            error: error.message
        });
    }
});

// Estadísticas por tipo de evaluación
app.get('/api/evaluations/stats/types', async (req, res) => {
    try {
        console.log('📊 GET /api/evaluations/stats/types');
        
        const stats = await database.getEvaluationTypeStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas por tipo:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estadísticas por tipo',
            error: error.message
        });
    }
});

// Estadísticas por grado
app.get('/api/evaluations/stats/grades', async (req, res) => {
    try {
        console.log('📊 GET /api/evaluations/stats/grades');
        
        const stats = await database.getEvaluationGradeStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas por grado:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estadísticas por grado',
            error: error.message
        });
    }
});

// Progreso de evaluaciones
app.get('/api/evaluations/progress', async (req, res) => {
    try {
        console.log('📊 GET /api/evaluations/progress');
        
        const progress = await database.getEvaluationProgress();
        res.json({
            success: true,
            data: progress
        });
    } catch (error) {
        console.error('❌ Error obteniendo progreso:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo progreso',
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

// Debug: Verificar materia específica
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

// Debug: Ver qué devuelve getEvaluationGrades
app.get('/api/debug/evaluation-grades/:evaluationId', async (req, res) => {
    try {
        const { evaluationId } = req.params;
        
        console.log('🐛 DEBUG: Obteniendo evaluation grades para evaluación', evaluationId);
        
        const grades = await database.getEvaluationGrades(evaluationId);
        
        res.json({
            success: true,
            debug: {
                evaluation_id: evaluationId,
                total_students: grades.length,
                students: grades.map(g => ({
                    student_id: g.student_id,
                    name: `${g.first_surname} ${g.first_name}`,
                    has_grade: !!g.grade_id,
                    points: g.points_earned || 'Sin calificar'
                }))
            },
            data: grades
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
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
            console.log('📝 Evaluaciones disponibles en /api/evaluations, /api/evaluation-grades');
            console.log('🐛 Debug endpoints: /api/debug/connection, /api/debug/database');
        });
    } catch (error) {
        console.error('❌ Error iniciando servidor:', error);
    }
}

// ========================================
// APIs DEL MÓDULO DE COTIDIANO (VERSIÓN FINAL)
// ========================================

// Obtener indicadores por grado y materia
app.get('/api/cotidiano/indicators', async (req, res) => {
    try {
        const { grade, subject } = req.query;
        
        if (!grade || !subject) {
            return res.status(400).json({ 
                success: false, 
                message: 'Grade and subject are required' 
            });
        }
        
        const indicators = await database.getIndicatorsByGradeAndSubject(grade, subject);
        
        res.json({
            success: true,
            data: indicators,
            message: `${indicators.length} indicadores encontrados`
        });
        
    } catch (error) {
        console.error('Error in cotidiano indicators API:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error obteniendo indicadores',
            error: error.message 
        });
    }
});

// Crear nuevo indicador
app.post('/api/cotidiano/indicators', async (req, res) => {
    try {
        const { grade_level, subject_area, indicator_name, parent_indicator_id } = req.body;
        
        if (!grade_level || !subject_area || !indicator_name) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields: grade_level, subject_area, indicator_name' 
            });
        }
        
        const result = await database.createIndicator(req.body);
        
        res.json({ 
            success: true,
            data: result, 
            message: 'Indicador creado exitosamente' 
        });
        
    } catch (error) {
        console.error('Error in create indicator API:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error creando indicador',
            error: error.message 
        });
    }
});

// Crear múltiples indicadores de una vez
app.post('/api/cotidiano/indicators/bulk', async (req, res) => {
    try {
        const result = await database.createBulkIndicators(req.body);
        
        res.json({ 
            success: result.summary.success > 0,
            data: result,
            message: `${result.summary.success} indicadores creados, ${result.summary.errors} errores` 
        });
        
    } catch (error) {
        console.error('Error in bulk create indicators API:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error creando indicadores múltiples',
            error: error.message 
        });
    }
});

// Eliminar indicador
app.delete('/api/cotidiano/indicators/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        database.ensureConnection();
        
        const query = 'DELETE FROM daily_indicators WHERE id = ?';
        
        database.db.run(query, [id], function(err) {
            if (err) {
                console.error('Error deleting indicator:', err);
                res.status(500).json({ 
                    success: false, 
                    message: 'Error eliminando indicador',
                    error: err.message 
                });
            } else {
                res.json({ 
                    success: true,
                    data: { deleted: this.changes },
                    message: 'Indicador eliminado exitosamente' 
                });
            }
        });
        
    } catch (error) {
        console.error('Error in delete indicator API:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error eliminando indicador',
            error: error.message 
        });
    }
});

// Cargar evaluación existente - CORREGIDO
app.get('/api/cotidiano/evaluation', async (req, res) => {
    try {
        const { grade_level, subject_area, evaluation_date } = req.query;
        
        if (!grade_level || !subject_area || !evaluation_date) {
            return res.status(400).json({ 
                success: false, 
                message: 'Grado, materia y fecha son requeridos' 
            });
        }
        
        console.log('📖 Cargando evaluación cotidiano:', { grade_level, subject_area, evaluation_date });
        
        database.ensureConnection();
        
        // 1. Cargar indicadores para este grado y materia
        const indicatorsQuery = `
            SELECT * FROM daily_indicators 
            WHERE grade_level = ? AND subject_area = ?
            ORDER BY parent_indicator_id, id
        `;
        
        const indicators = await new Promise((resolve, reject) => {
            database.db.all(indicatorsQuery, [grade_level, subject_area], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        console.log(`📋 Indicadores encontrados: ${indicators.length}`);
        
        // 2. Cargar evaluaciones de estudiantes para esta fecha
        const evaluationsQuery = `
            SELECT 
                de.id as evaluation_id,
                de.student_id,
                de.evaluation_date,
                de.grade_level,
                de.subject_area,
                s.first_surname,
                s.second_surname,
                s.first_name,
                dis.indicator_id,
                dis.score,
                dis.notes
            FROM daily_evaluations de
            LEFT JOIN students s ON de.student_id = s.id
            LEFT JOIN daily_indicator_scores dis ON de.id = dis.daily_evaluation_id
            WHERE de.grade_level = ? AND de.subject_area = ? AND de.evaluation_date = ?
            ORDER BY s.first_surname, s.first_name, dis.indicator_id
        `;
        
        const evaluations = await new Promise((resolve, reject) => {
            database.db.all(evaluationsQuery, [grade_level, subject_area, evaluation_date], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        console.log(`👥 Evaluaciones encontradas: ${evaluations.length} registros`);
        
        // 3. Organizar datos por estudiante
        const studentsData = {};
        evaluations.forEach(row => {
            if (row.student_id && row.first_surname) {
                const studentName = `${row.first_surname} ${row.second_surname || ''} ${row.first_name}`.trim();
                
                if (!studentsData[studentName]) {
                    studentsData[studentName] = {};
                }
                
                if (row.indicator_id && row.score !== null) {
                    studentsData[studentName][row.indicator_id] = row.score;
                }
            }
        });
        
        console.log(`📊 Estudiantes con calificaciones: ${Object.keys(studentsData).length}`);
        if (Object.keys(studentsData).length > 0) {
            console.log('👥 Estudiantes encontrados:', Object.keys(studentsData));
        }
        
        res.json({
            success: true,
            data: {
                indicators: indicators,
                students: studentsData
            },
            message: `Evaluación cargada: ${indicators.length} indicadores, ${Object.keys(studentsData).length} estudiantes`
        });
        
    } catch (error) {
        console.error('❌ Error cargando evaluación cotidiano:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error cargando evaluación',
            error: error.message 
        });
    }
});

// Guardar evaluación del cotidiano
app.post('/api/cotidiano/evaluation', async (req, res) => {
    try {
        const { grade_level, subject_area, evaluation_date, main_indicator, indicators, students } = req.body;
        
        if (!grade_level || !subject_area || !evaluation_date) {
            return res.status(400).json({ 
                success: false, 
                message: 'Grado, materia y fecha son requeridos' 
            });
        }
        
        console.log('💾 Guardando evaluación cotidiano:', {
            grade_level,
            subject_area,
            evaluation_date,
            indicators: indicators?.length || 0,
            students: Object.keys(students || {}).length
        });
        
        database.ensureConnection();
        
        // 1. Guardar/actualizar indicadores
        const indicatorPromises = [];
        
        if (main_indicator) {
            const mainPromise = new Promise((resolve, reject) => {
                const mainQuery = `
                    INSERT OR REPLACE INTO daily_indicators 
                    (id, grade_level, subject_area, indicator_name, parent_indicator_id, created_at)
                    VALUES (?, ?, ?, ?, NULL, datetime('now'))
                `;
                database.db.run(mainQuery, [main_indicator.id, grade_level, subject_area, main_indicator.text], function(err) {
                    if (err) reject(err);
                    else resolve(this);
                });
            });
            indicatorPromises.push(mainPromise);
        }
        
        if (indicators && indicators.length > 0) {
            indicators.forEach(indicator => {
                const promise = new Promise((resolve, reject) => {
                    const query = `
                        INSERT OR REPLACE INTO daily_indicators 
                        (id, grade_level, subject_area, indicator_name, parent_indicator_id, created_at)
                        VALUES (?, ?, ?, ?, ?, datetime('now'))
                    `;
                    const parentId = indicator.isSubIndicator ? indicator.parentId : null;
                    database.db.run(query, [indicator.id, grade_level, subject_area, indicator.text, parentId], function(err) {
                        if (err) reject(err);
                        else resolve(this);
                    });
                });
                indicatorPromises.push(promise);
            });
        }
        
        await Promise.all(indicatorPromises);
        console.log('✅ Indicadores guardados');
        
        // 2. Guardar evaluaciones de estudiantes
        let savedStudents = 0;
        const studentPromises = [];
        
        if (students && Object.keys(students).length > 0) {
            for (const [studentName, scores] of Object.entries(students)) {
                const studentPromise = new Promise((resolve, reject) => {
                    console.log(`🔍 Buscando estudiante: "${studentName}"`);
                    
                    // ✅ CONSULTA CORREGIDA - Sin second_name
                    const studentQuery = `
                        SELECT id, 
                            (first_surname || ' ' || COALESCE(second_surname, '') || ' ' || first_name) as full_name
                        FROM students 
                        WHERE grade_level = ?
                    `;
                    
                    database.db.all(studentQuery, [grade_level], (err, studentsInGrade) => {
                        if (err) {
                            console.error('❌ Error buscando estudiantes:', err);
                            reject(err);
                            return;
                        }
                        
                        console.log(`📋 Encontrados ${studentsInGrade.length} estudiantes en grado ${grade_level}`);
                        
                        // Buscar coincidencia exacta o cercana
                        const normalizedSearchName = studentName.trim().toLowerCase().replace(/\s+/g, ' ');
                        let foundStudent = null;
                        
                        for (let student of studentsInGrade) {
                            const normalizedDbName = student.full_name.trim().toLowerCase().replace(/\s+/g, ' ');
                            
                            console.log(`🔍 Comparando: "${normalizedSearchName}" vs "${normalizedDbName}"`);
                            
                            if (normalizedDbName === normalizedSearchName || 
                                normalizedDbName.includes(normalizedSearchName) ||
                                normalizedSearchName.includes(normalizedDbName)) {
                                foundStudent = student;
                                break;
                            }
                        }
                        
                        if (!foundStudent) {
                            console.log(`⚠️ Estudiante no encontrado: "${studentName}"`);
                            console.log(`📋 Estudiantes disponibles en ${grade_level}:`, 
                                studentsInGrade.map(s => `"${s.full_name}"`));
                            resolve(null);
                            return;
                        }
                        
                        console.log(`✅ Estudiante encontrado: ${foundStudent.full_name} (ID: ${foundStudent.id})`);
                        
                        // Crear/actualizar evaluación del estudiante
                        const evalQuery = `
                            INSERT OR REPLACE INTO daily_evaluations 
                            (student_id, grade_level, subject_area, evaluation_date, created_at)
                            VALUES (?, ?, ?, ?, datetime('now'))
                        `;
                        
                        database.db.run(evalQuery, [foundStudent.id, grade_level, subject_area, evaluation_date], function(evalErr) {
                            if (evalErr) {
                                console.error('❌ Error creando evaluación:', evalErr);
                                reject(evalErr);
                                return;
                            }
                            
                            const evaluationId = this.lastID;
                            console.log(`📝 Evaluación creada con ID: ${evaluationId}`);
                            
                            // Guardar calificaciones por indicador
                            const scorePromises = [];
                            
                            for (const [indicatorId, score] of Object.entries(scores)) {
                                const scorePromise = new Promise((scoreResolve, scoreReject) => {
                                    const scoreQuery = `
                                        INSERT OR REPLACE INTO daily_indicator_scores 
                                        (daily_evaluation_id, indicator_id, score, created_at)
                                        VALUES (?, ?, ?, datetime('now'))
                                    `;
                                    database.db.run(scoreQuery, [evaluationId, indicatorId, score], function(scoreErr) {
                                        if (scoreErr) {
                                            console.error('❌ Error guardando calificación:', scoreErr);
                                            scoreReject(scoreErr);
                                        } else {
                                            console.log(`✅ Calificación guardada: Indicador ${indicatorId} = ${score}`);
                                            scoreResolve();
                                        }
                                    });
                                });
                                scorePromises.push(scorePromise);
                            }
                            
                            Promise.all(scorePromises)
                                .then(() => {
                                    console.log(`✅ Todas las calificaciones guardadas para ${foundStudent.full_name}`);
                                    savedStudents++;
                                    resolve(foundStudent);
                                })
                                .catch(reject);
                        });
                    });
                });
                
                studentPromises.push(studentPromise);
            }
        }
        
        // ✅ ESPERAR a que se guarden TODOS los estudiantes
        const results = await Promise.allSettled(studentPromises);
        const successfulSaves = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
        
        console.log(`💾 Proceso completado: ${successfulSaves} estudiantes guardados de ${Object.keys(students || {}).length} enviados`);
        
        res.json({ 
            success: true,
            data: {
                saved_students: successfulSaves,
                total_sent: Object.keys(students || {}).length,
                date: evaluation_date,
                grade: grade_level,
                subject: subject_area,
                indicators: indicators?.length || 0
            },
            message: `Evaluación guardada: ${successfulSaves} estudiantes, ${indicators?.length || 0} indicadores` 
        });
        
    } catch (error) {
        console.error('❌ Error guardando evaluación cotidiano:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error guardando evaluación',
            error: error.message 
        });
    }
});


// Cargar evaluación existente (AGREGAR DESPUÉS del endpoint de guardar)
app.get('/api/cotidiano/evaluation', async (req, res) => {
    try {
        const { grade_level, subject_area, evaluation_date } = req.query;
        
        if (!grade_level || !subject_area || !evaluation_date) {
            return res.status(400).json({ 
                success: false, 
                message: 'Grado, materia y fecha son requeridos' 
            });
        }
        
        console.log('📖 Cargando evaluación cotidiano:', { grade_level, subject_area, evaluation_date });
        
        database.ensureConnection();
        
        // Cargar indicadores
        const indicatorsQuery = `
            SELECT * FROM daily_indicators 
            WHERE grade_level = ? AND subject_area = ?
            ORDER BY parent_indicator_id, id
        `;
        
        const indicators = await new Promise((resolve, reject) => {
            database.db.all(indicatorsQuery, [grade_level, subject_area], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        // Cargar evaluaciones de estudiantes
        const evaluationsQuery = `
            SELECT de.*, dis.indicator_id, dis.score, s.first_surname, s.second_surname, s.first_name
            FROM daily_evaluations de
            LEFT JOIN daily_indicator_scores dis ON de.id = dis.daily_evaluation_id
            LEFT JOIN students s ON de.student_id = s.id
            WHERE de.grade_level = ? AND de.subject_area = ? AND de.evaluation_date = ?
        `;
        
        const evaluations = await new Promise((resolve, reject) => {
            database.db.all(evaluationsQuery, [grade_level, subject_area, evaluation_date], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        // Organizar datos por estudiante
        const studentsData = {};
        evaluations.forEach(row => {
            if (row.student_id) {
                const studentName = `${row.first_surname} ${row.second_surname || ''} ${row.first_name}`.trim();
                
                if (!studentsData[studentName]) {
                    studentsData[studentName] = {};
                }
                
                if (row.indicator_id && row.score !== null) {
                    studentsData[studentName][row.indicator_id] = row.score;
                }
            }
        });
        
        res.json({
            success: true,
            data: {
                indicators: indicators,
                students: studentsData
            },
            message: `Evaluación cargada: ${indicators.length} indicadores, ${Object.keys(studentsData).length} estudiantes`
        });
        
    } catch (error) {
        console.error('❌ Error cargando evaluación cotidiano:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error cargando evaluación',
            error: error.message 
        });
    }
});

// Obtener historial de evaluaciones
app.get('/api/cotidiano/history', async (req, res) => {
    try {
        const { grade, subject } = req.query;
        
        if (!grade || !subject) {
            return res.status(400).json({ 
                success: false, 
                message: 'Grade and subject are required' 
            });
        }
        
        const history = await database.getCotidianoHistory(grade, subject);
        
        res.json({
            success: true,
            data: history,
            message: `${history.length} evaluaciones encontradas en el historial`
        });
        
    } catch (error) {
        console.error('Error in get history API:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error obteniendo historial',
            error: error.message 
        });
    }
});


// ========================================
// MÓDULO SEA - Sistema de Evaluación Académica
// AGREGAR ESTE CÓDIGO AL FINAL DE server.js (ANTES DE startServer())
// ========================================

// Endpoint para obtener lista de grados y materias disponibles para SEA
app.get('/api/sea/grade-subjects', async (req, res) => {
    try {
        console.log('🎯 GET /api/sea/grade-subjects');
        
        database.ensureConnection();
        
        const query = `
            SELECT DISTINCT grade_level, subject_area
            FROM assignments 
            WHERE is_active = 1
            ORDER BY grade_level, subject_area
        `;
        
        const gradeSubjects = await new Promise((resolve, reject) => {
            database.db.all(query, [], (err, rows) => {
                if (err) {
                    console.error('❌ Error obteniendo grados-materias:', err);
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });

        console.log(`📚 Grados-materias encontrados: ${gradeSubjects.length}`);

        res.json({
            success: true,
            data: gradeSubjects,
            message: `${gradeSubjects.length} combinaciones grado-materia encontradas`
        });
        
    } catch (error) {
        console.error('❌ Error en /api/sea/grade-subjects:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo datos',
            error: error.message
        });
    }
});

// Endpoint principal para datos consolidados del SEA
app.get('/api/sea/consolidated', async (req, res) => {
    try {
        const { grade, subject } = req.query;
        
        if (!grade || !subject) {
            return res.status(400).json({
                success: false,
                message: 'Grado y materia son requeridos'
            });
        }

        console.log(`🎯 GET /api/sea/consolidated - Grado: ${grade}, Materia: ${subject}`);

        database.ensureConnection();

        // 1. Obtener todas las evaluaciones activas del grado/materia
        const evaluations = await new Promise((resolve, reject) => {
            const evaluationsQuery = `
                SELECT id, title, percentage, max_points, type, due_date
                FROM assignments 
                WHERE grade_level = ? AND subject_area = ? AND is_active = 1
                ORDER BY created_at DESC
            `;
            
            database.db.all(evaluationsQuery, [grade, subject], (err, rows) => {
                if (err) {
                    console.error('❌ Error obteniendo evaluaciones:', err);
                    reject(err);
                } else {
                    console.log(`📝 Evaluaciones encontradas: ${rows?.length || 0}`);
                    resolve(rows || []);
                }
            });
        });

        // 2. Obtener todos los estudiantes activos del grado
        const students = await new Promise((resolve, reject) => {
            const studentsQuery = `
                SELECT id, first_name, first_surname, second_surname, student_id
                FROM students 
                WHERE grade_level = ? AND status = 'active'
                ORDER BY first_surname, first_name
            `;
            
            database.db.all(studentsQuery, [grade], (err, rows) => {
                if (err) {
                    console.error('❌ Error obteniendo estudiantes:', err);
                    reject(err);
                } else {
                    console.log(`👥 Estudiantes encontrados: ${rows?.length || 0}`);
                    resolve(rows || []);
                }
            });
        });

        // 3. Para cada estudiante, obtener todas sus notas
        const studentsWithSEA = [];
        
        for (const student of students) {
            const studentName = `${student.first_surname} ${student.second_surname || ''} ${student.first_name}`.trim();
            
            try {
                // 3.1 Calificaciones en evaluaciones
                const evaluationGrades = {};
                let totalWeightedGrade = 0;
                let totalPercentage = 0;
                
                for (const evaluation of evaluations) {
                    const gradeResult = await new Promise((resolve, reject) => {
                        const gradeQuery = `
                            SELECT points_earned, grade, percentage 
                            FROM assignment_grades 
                            WHERE assignment_id = ? AND student_id = ?
                        `;
                        
                        database.db.get(gradeQuery, [evaluation.id, student.id], (err, row) => {
                            if (err) {
                                console.error(`❌ Error obteniendo calificación estudiante ${student.id}, evaluación ${evaluation.id}:`, err);
                                resolve(null); // No fallar por un estudiante
                            } else {
                                resolve(row);
                            }
                        });
                    });
                    
                    if (gradeResult && gradeResult.points_earned !== null) {
                        const studentGrade = (gradeResult.points_earned / evaluation.max_points) * 100;
                        totalWeightedGrade += studentGrade * (evaluation.percentage / 100);
                        totalPercentage += evaluation.percentage;
                        
                        evaluationGrades[evaluation.title] = {
                            grade: studentGrade.toFixed(1),
                            percentage: evaluation.percentage,
                            points: `${gradeResult.points_earned}/${evaluation.max_points}`
                        };
                    } else {
                        evaluationGrades[evaluation.title] = {
                            grade: 'Sin calificar',
                            percentage: evaluation.percentage,
                            points: '-'
                        };
                    }
                }

                // 3.2 Nota de cotidiano total (la más reciente o promedio)
                const cotidianoResult = await new Promise((resolve, reject) => {
                    const cotidianoQuery = `
                        SELECT final_grade as cotidiano_total, evaluation_date
                        FROM daily_evaluations 
                        WHERE student_id = ? AND grade_level = ? AND subject_area = ?
                        ORDER BY evaluation_date DESC
                        LIMIT 1
                    `;
                    
                    database.db.get(cotidianoQuery, [student.id, grade, subject], (err, row) => {
                        if (err) {
                            console.error(`❌ Error obteniendo cotidiano estudiante ${student.id}:`, err);
                            resolve(null);
                        } else {
                            resolve(row);
                        }
                    });
                });

                // 3.3 Nota de asistencia (usando función existente)
                let attendanceStats = null;
                try {
                    attendanceStats = await database.getAttendanceStats(student.id, grade, subject);
                } catch (error) {
                    console.error(`❌ Error obteniendo asistencia estudiante ${student.id}:`, error);
                }

                // 3.4 Calcular nota SEA de evaluaciones
                const seaEvaluationsGrade = totalPercentage > 0 ? (totalWeightedGrade / totalPercentage * 100) : 0;

                studentsWithSEA.push({
                    student_id: student.id,
                    student_code: student.student_id,
                    student_name: studentName,
                    
                    // Evaluaciones individuales
                    evaluations: evaluationGrades,
                    evaluations_summary: {
                        weighted_grade: seaEvaluationsGrade.toFixed(1),
                        total_percentage: totalPercentage,
                        completed_evaluations: Object.values(evaluationGrades).filter(e => e.grade !== 'Sin calificar').length,
                        total_evaluations: evaluations.length
                    },
                    
                    // Nota de cotidiano total
                    cotidiano: {
                        total_grade: cotidianoResult?.cotidiano_total ? cotidianoResult.cotidiano_total.toFixed(1) : 'Sin datos',
                        last_evaluation_date: cotidianoResult?.evaluation_date || null
                    },
                    
                    // Nota de asistencia (solo una columna)
                    attendance: {
                        grade_0_5: attendanceStats?.nota_asistencia ? attendanceStats.nota_asistencia.toFixed(1) : 'Sin datos',
                        total_lessons: attendanceStats?.total_lessons || 0,
                        attendance_percentage: attendanceStats?.attendance_percentage ? attendanceStats.attendance_percentage.toFixed(1) : 'Sin datos'
                    }
                });

            } catch (studentError) {
                console.error(`❌ Error procesando estudiante ${student.id}:`, studentError);
                // Continuar con el siguiente estudiante
            }
        }

        // 4. Obtener configuración de pesos (valores que suman hacia 100)
        const weightConfig = {
            cotidiano_weight: 65, // 65 puntos del total
            attendance_weight: 10,  // 10 puntos del total 
            evaluations_weight: 25 // 25 puntos restantes (o lo que tengan configurado las evaluaciones)
        };

        console.log(`✅ SEA procesado: ${studentsWithSEA.length} estudiantes completados`);

        res.json({
            success: true,
            data: {
                students: studentsWithSEA,
                evaluations_list: evaluations,
                weight_config: weightConfig,
                summary: {
                    total_students: students.length,
                    total_evaluations: evaluations.length,
                    grade_level: grade,
                    subject_area: subject,
                    total_percentage_configured: evaluations.reduce((sum, e) => sum + e.percentage, 0),
                    cotidiano_weight: weightConfig.cotidiano_weight,
                    attendance_weight: weightConfig.attendance_weight
                }
            },
            message: `Datos SEA cargados: ${students.length} estudiantes, ${evaluations.length} evaluaciones`
        });
        
    } catch (error) {
        console.error('❌ Error en /api/sea/consolidated:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo datos SEA',
            error: error.message
        });
    }
});

// Iniciar todo
startServer();

// Cerrar base de datos al terminar el proceso
process.on('SIGINT', () => {
    console.log('🔄 Cerrando servidor...');
    database.close();
    process.exit(0);
});